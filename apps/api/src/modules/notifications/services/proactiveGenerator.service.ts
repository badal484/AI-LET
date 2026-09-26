import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { CharacterService } from '../../characters/services/character.service.js';
import { ContextBuilder } from '../../conversations/engine/contextBuilder.js';
import { RelationshipContextProvider } from '../../relationships/services/relationshipContext.provider.js';
import { ProactiveEligibilityService } from './proactiveEligibility.service.js';
import { ProactiveDecisionEngine } from './proactiveDecisionEngine.service.js';
import { ProactiveSafetyValidator } from './proactiveSafetyValidator.service.js';
import { NotificationService } from './notification.service.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import type {
  ProactiveActionData,
  ProactiveIntentType,
  AIMessagePayload,
} from '@ai-companion/types';

export interface ProactiveGenerationParams {
  userId: string;
  characterId: string;
  characterVersionId?: string;
  forcedIntent?: ProactiveIntentType;
  dryRun?: boolean;
}

export interface ProactiveGenerationResult {
  actionId?: string;
  isExecuted: boolean;
  decision: 'SEND' | 'WAIT' | 'SKIP';
  reason: string;
  intentType?: ProactiveIntentType | null;
  generatedMessage?: string | null;
  notificationDispatched?: boolean;
  proactiveAction?: ProactiveActionData | null;
}

export class ProactiveGeneratorService {
  /**
   * Orchestrates the complete proactive AI pipeline from eligibility to generation, validation, and delivery.
   */
  public static async processProactiveOutreach(
    params: ProactiveGenerationParams,
  ): Promise<ProactiveGenerationResult> {
    const { userId, characterId, characterVersionId, forcedIntent, dryRun = false } = params;

    // 1. Evaluate Multi-tier Eligibility Rules
    const eligibility = await ProactiveEligibilityService.evaluateEligibility(userId, characterId);
    if (!eligibility.isEligible) {
      await prisma.proactiveDecisionLog.create({
        data: {
          userId,
          characterId,
          decision: 'SKIP',
          reasonCode: eligibility.skipReason || 'INELIGIBLE',
          confidence: 0.0,
          metadata: { reason: eligibility.reason },
        },
      });

      return {
        isExecuted: false,
        decision: 'SKIP',
        reason: eligibility.reason,
      };
    }

    // 2. Fetch Character Details & Runtime
    const characterRuntime = await CharacterService.resolveRuntime(
      characterId,
      characterVersionId || eligibility.characterVersionId,
    );

    // 3. Evaluate Decision Engine & Formulate Intent
    const decisionResult = await ProactiveDecisionEngine.evaluateDecision({
      userId,
      characterId,
      characterName: characterRuntime.name,
      characterRole: characterRuntime.identity.role,
      proactivityConfig: characterRuntime.proactivityConfig,
    });

    const activeIntent = forcedIntent || decisionResult.suggestedIntent;

    if (decisionResult.decision !== 'SEND' && !forcedIntent) {
      await prisma.proactiveDecisionLog.create({
        data: {
          userId,
          characterId,
          decision: decisionResult.decision,
          reasonCode: decisionResult.skipReason || 'NO_TRIGGER',
          confidence: decisionResult.confidence,
          metadata: { reason: decisionResult.reason },
        },
      });

      return {
        isExecuted: false,
        decision: decisionResult.decision,
        reason: decisionResult.reason,
        intentType: decisionResult.suggestedIntent,
      };
    }

    if (!activeIntent) {
      return {
        isExecuted: false,
        decision: 'SKIP',
        reason: 'No valid proactive intent could be formulated.',
      };
    }

    // 4. Resolve / Initialize Conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          characterId,
          characterVersionId: characterRuntime.versionId,
          title: `Conversation with ${characterRuntime.name}`,
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    // 5. Construct Proactive Generation Prompt
    const intentInstruction = this.getIntentInstruction(activeIntent, characterRuntime.name);
    const relationshipProvider = new RelationshipContextProvider();
    const context = await ContextBuilder.buildModelContext({
      characterRuntime,
      recentMessages: [],
      currentUserMessage: `[PROACTIVE_SYSTEM_EVENT: Initiate a natural, non-coercive conversation turn adhering to intent: "${activeIntent}". ${intentInstruction}]`,
      userContext: {
        userId,
        userName: user?.profile?.displayName || 'User',
      },
      conversationId: conversation.id,
      relationshipProvider,
      maxTokenBudget: 3000,
    });

    // 6. Generate Message via AI Gateway
    const messages: AIMessagePayload[] = [
      { role: 'system', content: `${context.systemPrompt}\n\nIMPORTANT PROACTIVE RULES: Keep this outreach turn concise (1-3 sentences). Fit your unique personality naturally. Do NOT act needy, guilty, or demanding. Never claim to have seen the user in the real world.` },
      { role: 'user', content: `Initiate proactive interaction: ${intentInstruction}` },
    ];

    let generatedText = '';
    try {
      const activeProvider = ((characterRuntime.aiConfig as any)?.provider || 'google').toLowerCase() as any;
      const activeModel = characterRuntime.aiConfig?.customModelName || 'gemini-2.5-flash';

      const response = await AIOrchestrator.executeText(
        activeProvider,
        activeModel,
        messages,
        {
          temperature: 0.85,
          maxTokens: 120,
        },
      );
      generatedText = response.content.trim();
    } catch (err: any) {
      logger.error(`Proactive AI generation failed: ${err.message}`);
      return {
        isExecuted: false,
        decision: 'SKIP',
        reason: `AI generation failed: ${err.message}`,
        intentType: activeIntent,
      };
    }

    // 7. Fetch Recent Proactive Messages for Anti-Spam Repetition Validation
    const priorActions = await prisma.proactiveAction.findMany({
      where: {
        userId,
        characterId,
        status: { in: ['SENT', 'DELIVERED', 'GENERATED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { reason: true },
    });

    const recentMessageSnippets = priorActions.map(a => a.reason);

    // 8. Safety & Repetition Validation
    const safetyResult = ProactiveSafetyValidator.validateProactiveMessage(
      generatedText,
      recentMessageSnippets,
    );

    if (!safetyResult.isValid) {
      logger.warn(`Proactive generation rejected by safety validator: ${safetyResult.rejectionReason}`);

      await prisma.proactiveDecisionLog.create({
        data: {
          userId,
          characterId,
          decision: 'SKIP',
          reasonCode: 'SAFETY_CHECK_FAILED',
          intentType: activeIntent,
          confidence: decisionResult.confidence,
          metadata: { rejectionReason: safetyResult.rejectionReason, generatedSnippet: generatedText.slice(0, 100) },
        },
      });

      return {
        isExecuted: false,
        decision: 'SKIP',
        reason: `Rejected by safety validator: ${safetyResult.rejectionReason}`,
        intentType: activeIntent,
        generatedMessage: generatedText,
      };
    }

    // If dry-run mode, stop before persisting and sending
    if (dryRun) {
      return {
        isExecuted: true,
        decision: 'SEND',
        reason: 'Dry run simulation executed successfully.',
        intentType: activeIntent,
        generatedMessage: generatedText,
        notificationDispatched: false,
      };
    }

    // 9. Persist Message into Conversation History
    const lastMsg = await prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const nextSeq = (lastMsg?.sequenceNumber || 0) + 1;

    const savedMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'CHARACTER',
        role: 'assistant',
        content: generatedText,
        status: 'SENT',
        sequenceNumber: nextSeq,
        isProactive: true,
        source: 'proactive',
        characterVersionId: characterRuntime.versionId,
      },
    });

    // Update conversation lastMessage metadata
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessageSnippet: generatedText.slice(0, 100),
        unreadCount: { increment: 1 },
      },
    });

    // 10. Persist Proactive Action Record
    const expiresAt = new Date(Date.now() + SYSTEM_CONSTANTS.PROACTIVITY.INTENT_DEFAULT_EXPIRY_HOURS * 3600 * 1000);

    const action = await prisma.proactiveAction.create({
      data: {
        userId,
        characterId,
        characterVersionId: characterRuntime.versionId,
        conversationId: conversation.id,
        intentType: activeIntent,
        reason: decisionResult.reason,
        status: 'GENERATED',
        expiresAt,
        generatedMessageId: savedMessage.id,
        decisionMetadata: {
          confidence: decisionResult.confidence,
          supportingContextIds: decisionResult.supportingContextIds,
        },
      },
    });

    // 11. Dispatch Push Notification
    const pushResult = await NotificationService.dispatchPushToUser({
      userId,
      characterName: characterRuntime.name,
      messageContent: generatedText,
      category: activeIntent === 'USER_REQUESTED_REMINDER' ? 'user_reminder' : 'character_message',
      conversationId: conversation.id,
      characterId,
      proactiveActionId: action.id,
    });

    const finalStatus = pushResult.sentCount > 0 ? 'SENT' : 'DELIVERED';

    const updatedAction = await prisma.proactiveAction.update({
      where: { id: action.id },
      data: {
        status: finalStatus,
        sentAt: new Date(),
      },
    });

    // 12. Record Structured Decision Log
    await prisma.proactiveDecisionLog.create({
      data: {
        userId,
        characterId,
        decision: 'SEND',
        reasonCode: activeIntent,
        intentType: activeIntent,
        confidence: decisionResult.confidence,
        metadata: {
          actionId: action.id,
          messageId: savedMessage.id,
          pushSentCount: pushResult.sentCount,
        },
      },
    });

    return {
      actionId: updatedAction.id,
      isExecuted: true,
      decision: 'SEND',
      reason: decisionResult.reason,
      intentType: activeIntent,
      generatedMessage: generatedText,
      notificationDispatched: pushResult.sentCount > 0,
      proactiveAction: {
        id: updatedAction.id,
        userId: updatedAction.userId,
        characterId: updatedAction.characterId,
        characterVersionId: updatedAction.characterVersionId,
        conversationId: updatedAction.conversationId,
        intentType: updatedAction.intentType as ProactiveIntentType,
        reason: updatedAction.reason,
        status: updatedAction.status as any,
        expiresAt: updatedAction.expiresAt.toISOString(),
        generatedMessageId: updatedAction.generatedMessageId,
        sentAt: updatedAction.sentAt?.toISOString() || null,
        createdAt: updatedAction.createdAt.toISOString(),
        updatedAt: updatedAction.updatedAt.toISOString(),
      },
    };
  }

  private static getIntentInstruction(intent: ProactiveIntentType, charName: string): string {
    switch (intent) {
      case 'FOLLOW_UP_ON_TOPIC':
        return `Politely follow up on a meaningful personal topic or event the user previously mentioned.`;
      case 'ASK_ABOUT_PREVIOUS_GOAL':
        return `Ask warmly about progress on the personal or professional goal the user shared earlier.`;
      case 'OFFER_RELEVANT_INFORMATION':
        return `Share a brief, engaging thought or insight connected to the user's known interests.`;
      case 'USER_REQUESTED_REMINDER':
        return `Deliver the reminder the user previously asked you to remember.`;
      case 'CHARACTER_TOPIC_PROMPT':
        return `Introduce an intriguing topic or question relevant to your backstory and expertise.`;
      case 'REENGAGEMENT_CHECKIN':
        return `Say a brief, warm hello to check in without asking where the user has been.`;
      case 'INVITE_LIGHT_CONVERSATION':
      default:
        return `Share a friendly, lighthearted remark or pleasant greeting appropriate for ${charName}.`;
    }
  }
}
