import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { ConversationService } from '../../conversations/services/conversation.service.js';
import { ActivationFunnelService } from './ActivationFunnelService.js';
import { UserPreferenceService } from './UserPreferenceService.js';
import type {
  OnboardingProgress,
  OnboardingStepKey,
  OnboardingStatus,
  ConversationStyle,
  OnboardingStarterCharacterItem,
} from '@ai-companion/types';
import type {
  OnboardingStepCompleteInput,
  OnboardingCompleteInput,
} from '@ai-companion/validation';

export class OnboardingService {
  private static readonly STEP_ORDER: OnboardingStepKey[] = [
    'WELCOME',
    'LANGUAGE',
    'INTERESTS',
    'STYLE',
    'CHARACTER_SELECTION',
    'COMPLETED',
  ];

  /**
   * Retrieves the user's current durable onboarding state and starter options.
   */
  public static async getOnboardingState(userId: string): Promise<{
    progress: OnboardingProgress;
    starterCharacters: OnboardingStarterCharacterItem[];
  }> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError('User profile not found', 404, ErrorCode.NOT_FOUND);
    }

    const progress: OnboardingProgress = {
      status: (profile.onboardingStatus as OnboardingStatus) || 'NOT_STARTED',
      version: profile.onboardingVersion || 1,
      currentStep: (profile.onboardingCurrentStep as OnboardingStepKey) || 'WELCOME',
      completedSteps: (profile.onboardingCompletedSteps as string[]) || [],
      startedAt: profile.onboardingStartedAt?.toISOString() || null,
      completedAt: profile.onboardingCompletedAt?.toISOString() || null,
      conversationStyle: (profile.conversationStyle as ConversationStyle) || 'CASUAL',
    };

    const starterCharacters = await this.getStarterCharacters(userId);

    return {
      progress,
      starterCharacters,
    };
  }

  /**
   * Begins or resumes the onboarding flow for a user.
   */
  public static async startOnboarding(userId: string): Promise<OnboardingProgress> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError('User profile not found', 404, ErrorCode.NOT_FOUND);
    }

    const now = new Date();
    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        onboardingStatus: 'IN_PROGRESS',
        onboardingStartedAt: profile.onboardingStartedAt || now,
        onboardingCurrentStep: profile.onboardingCurrentStep || 'WELCOME',
      },
    });

    // Track funnel event
    await ActivationFunnelService.trackFunnelEvent(
      {
        eventType: 'ONBOARDING_STARTED',
        stepKey: 'WELCOME',
        onboardingVersion: updated.onboardingVersion,
      },
      userId,
    );

    // Initialize UserFirstSession if not present
    await prisma.userFirstSession.upsert({
      where: { userId },
      create: { userId, lastActiveAt: now },
      update: { lastActiveAt: now },
    });

    return {
      status: 'IN_PROGRESS',
      version: updated.onboardingVersion,
      currentStep: (updated.onboardingCurrentStep as OnboardingStepKey) || 'WELCOME',
      completedSteps: (updated.onboardingCompletedSteps as string[]) || [],
      startedAt: updated.onboardingStartedAt?.toISOString() || null,
      completedAt: updated.onboardingCompletedAt?.toISOString() || null,
      conversationStyle: (updated.conversationStyle as ConversationStyle) || 'CASUAL',
    };
  }

  /**
   * Records completion of an individual onboarding step idempotently.
   */
  public static async completeStep(
    userId: string,
    input: OnboardingStepCompleteInput,
  ): Promise<{
    progress: OnboardingProgress;
    nextStep: OnboardingStepKey;
  }> {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError('User profile not found', 404, ErrorCode.NOT_FOUND);
    }

    const currentCompleted = Array.isArray(profile.onboardingCompletedSteps)
      ? (profile.onboardingCompletedSteps as string[])
      : [];

    const newCompleted = currentCompleted.includes(input.stepKey)
      ? currentCompleted
      : [...currentCompleted, input.stepKey];

    // Determine next step index
    const currentIdx = this.STEP_ORDER.indexOf(input.stepKey);
    const nextStepKey: OnboardingStepKey =
      currentIdx >= 0 && currentIdx < this.STEP_ORDER.length - 1
        ? (this.STEP_ORDER[currentIdx + 1] as OnboardingStepKey)
        : 'COMPLETED';

    // Apply any explicit preferences provided in step
    if (input.language) {
      await UserPreferenceService.updatePreferences(userId, { preferredLanguage: input.language });
    }
    if (input.conversationStyle) {
      await UserPreferenceService.updatePreferences(userId, {
        conversationStyle: input.conversationStyle,
      });
    }
    if (input.categoryIds || input.tagIds) {
      await UserPreferenceService.updatePreferences(userId, {
        preferredCategoryIds: input.categoryIds,
        preferredTagIds: input.tagIds,
      });
    }

    const isFinished = nextStepKey === 'COMPLETED';
    const now = new Date();

    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        onboardingCompletedSteps: newCompleted,
        onboardingCurrentStep: nextStepKey,
        ...(isFinished && {
          onboardingStatus: 'COMPLETED',
          onboardingCompletedAt: now,
          onboardingCompleted: true,
        }),
      },
    });

    // Track funnel event
    await ActivationFunnelService.trackFunnelEvent(
      {
        eventType: input.skipped ? 'ONBOARDING_STEP_SKIPPED' : 'ONBOARDING_STEP_COMPLETED',
        stepKey: input.stepKey,
        characterId: input.selectedCharacterId,
        onboardingVersion: updated.onboardingVersion,
      },
      userId,
    );

    if (isFinished) {
      await ActivationFunnelService.trackFunnelEvent(
        {
          eventType: 'ONBOARDING_COMPLETED',
          characterId: input.selectedCharacterId,
          onboardingVersion: updated.onboardingVersion,
        },
        userId,
      );
    }

    const progress: OnboardingProgress = {
      status: (updated.onboardingStatus as OnboardingStatus) || 'IN_PROGRESS',
      version: updated.onboardingVersion,
      currentStep: (updated.onboardingCurrentStep as OnboardingStepKey) || nextStepKey,
      completedSteps: newCompleted,
      startedAt: updated.onboardingStartedAt?.toISOString() || null,
      completedAt: updated.onboardingCompletedAt?.toISOString() || null,
      conversationStyle: (updated.conversationStyle as ConversationStyle) || 'CASUAL',
    };

    return {
      progress,
      nextStep: nextStepKey,
    };
  }

  /**
   * Skips onboarding and unlocks full default experience.
   */
  public static async skipOnboarding(userId: string): Promise<OnboardingProgress> {
    const now = new Date();
    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        onboardingStatus: 'SKIPPED',
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        onboardingCurrentStep: 'COMPLETED',
      },
    });

    await ActivationFunnelService.trackFunnelEvent(
      {
        eventType: 'ONBOARDING_STEP_SKIPPED',
        stepKey: 'ALL',
        onboardingVersion: updated.onboardingVersion,
      },
      userId,
    );

    return {
      status: 'SKIPPED',
      version: updated.onboardingVersion,
      currentStep: 'COMPLETED',
      completedSteps: (updated.onboardingCompletedSteps as string[]) || [],
      startedAt: updated.onboardingStartedAt?.toISOString() || null,
      completedAt: now.toISOString(),
      conversationStyle: (updated.conversationStyle as ConversationStyle) || 'CASUAL',
    };
  }

  /**
   * Finalizes onboarding, creates/opens the first conversation, and logs activation milestones.
   */
  public static async completeOnboarding(
    userId: string,
    input: OnboardingCompleteInput,
  ): Promise<{
    progress: OnboardingProgress;
    conversationId?: string;
    character?: OnboardingStarterCharacterItem | null;
  }> {
    const now = new Date();

    // 1. Update preferences if supplied
    if (
      input.preferredLanguage ||
      input.conversationStyle ||
      input.categoryIds ||
      input.tagIds
    ) {
      await UserPreferenceService.updatePreferences(userId, {
        preferredLanguage: input.preferredLanguage,
        conversationStyle: input.conversationStyle,
        preferredCategoryIds: input.categoryIds,
        preferredTagIds: input.tagIds,
      });
    }

    // 2. Mark profile as completed
    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        onboardingStatus: 'COMPLETED',
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        onboardingCurrentStep: 'COMPLETED',
      },
    });

    let conversationId: string | undefined;
    let selectedCharacter: OnboardingStarterCharacterItem | null = null;

    // 3. If user selected a starter character -> create conversation & record activation signals
    if (input.selectedCharacterId) {
      try {
        const charResult = await ConversationService.createConversation(
          userId,
          input.selectedCharacterId,
        );
        conversationId = charResult.detail.id;

        const charRecord = await prisma.character.findUnique({
          where: { id: input.selectedCharacterId },
        });

        if (charRecord) {
          selectedCharacter = {
            id: charRecord.id,
            slug: charRecord.slug,
            name: charRecord.name,
            tagline: charRecord.tagline,
            shortDescription: charRecord.shortDescription,
            avatarUrl: charRecord.avatarUrl,
            coverImageUrl: charRecord.coverImageUrl,
            category: charRecord.category,
            categoryDisplayName: charRecord.category,
            conversationStyleTag: 'Adaptive',
            personalityHook: charRecord.tagline || 'Intriguing companion',
          };
        }

        // Record first session milestone
        await ActivationFunnelService.trackFunnelEvent(
          {
            eventType: 'CHARACTER_SELECTED',
            characterId: input.selectedCharacterId,
            onboardingVersion: updated.onboardingVersion,
          },
          userId,
        );

        await ActivationFunnelService.trackFunnelEvent(
          {
            eventType: 'CONVERSATION_STARTED',
            characterId: input.selectedCharacterId,
            onboardingVersion: updated.onboardingVersion,
          },
          userId,
        );

        await ActivationFunnelService.recordMessageActivity(
          userId,
          input.selectedCharacterId,
          conversationId,
        );
      } catch (err) {
        logger.warn(`Failed to create initial conversation during onboarding for user ${userId}`, {
          error: err,
        });
      }
    }

    // 4. Log Onboarding Completed funnel event
    await ActivationFunnelService.trackFunnelEvent(
      {
        eventType: 'ONBOARDING_COMPLETED',
        characterId: input.selectedCharacterId,
        onboardingVersion: updated.onboardingVersion,
      },
      userId,
    );

    const progress: OnboardingProgress = {
      status: 'COMPLETED',
      version: updated.onboardingVersion,
      currentStep: 'COMPLETED',
      completedSteps: (updated.onboardingCompletedSteps as string[]) || [],
      startedAt: updated.onboardingStartedAt?.toISOString() || null,
      completedAt: now.toISOString(),
      conversationStyle: (updated.conversationStyle as ConversationStyle) || 'CASUAL',
    };

    return {
      progress,
      conversationId,
      character: selectedCharacter,
    };
  }

  /**
   * Retrieves curated starter companion recommendations for onboarding.
   */
  public static async getStarterCharacters(
    _userId?: string,
  ): Promise<OnboardingStarterCharacterItem[]> {
    const characters = await prisma.character.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        discoveryConfig: {
          isDiscoverable: true,
        },
      },
      take: 4,
      orderBy: [
        { isFeatured: 'desc' },
        { discoveryConfig: { editorialPriority: 'desc' } },
        { createdAt: 'desc' },
      ],
      include: {
        currentPublishedVersion: true,
        categoryRef: true,
        discoveryConfig: true,
      },
    });

    if (characters.length === 0) {
      // Fallback query if discoveryConfig isn't populated
      const fallback = await prisma.character.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        take: 4,
      });

      return fallback.map(c => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        shortDescription: c.shortDescription,
        avatarUrl: c.avatarUrl,
        coverImageUrl: c.coverImageUrl,
        category: c.category,
        categoryDisplayName: c.category.toUpperCase(),
        conversationStyleTag: 'Engaging',
        personalityHook: c.tagline || 'Intriguing companion',
        starterPromptPill: `Ask ${c.name} about their world`,
        isLocked: c.accessType !== 'free',
      }));
    }

    return characters.map(c => {
      const starters = (c.discoveryConfig?.conversationStarters as string[]) || [];
      const primaryStarter =
        starters.length > 0 ? starters[0] : `Say hello to ${c.name} and explore their story`;

      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        shortDescription: c.shortDescription,
        avatarUrl: c.avatarUrl,
        coverImageUrl: c.coverImageUrl,
        category: c.category,
        categoryDisplayName: c.categoryRef?.displayName || c.category.toUpperCase(),
        conversationStyleTag: c.archetype || 'Adaptive',
        personalityHook: c.tagline || 'Distinctive personality',
        starterPromptPill: primaryStarter,
        isLocked: c.accessType !== 'free',
      };
    });
  }
}
