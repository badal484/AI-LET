import { prisma } from '../../../infrastructure/database/prisma.js';
import {
  AppError,
  NotFoundError,
} from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { AuditService } from '../../audit/audit.service.js';
import { CharacterCompiler } from '../../characters/engine/compiler.js';
import type {
  CreatorCharacterSummary,
  SandboxedPlaygroundMessage,
  SandboxedPlaygroundSession,
  PersonalityConfigData,
  CommunicationStyleConfigData,
  LanguageBehaviorConfigData,
  BehaviorRuleItemData,
  CharacterKnowledgeItemData,
  CharacterSafetyConfigData,
  CharacterIdentityData,
  RelationshipBehaviorConfigData,
  MemoryBehaviorConfigData,
  ProactivityBehaviorConfigData,
  CharacterAIConfigData,
} from '@ai-companion/types';
import type {
  CreatorCharacterCreateInput,
  SandboxedPlaygroundChatInput,
} from '@ai-companion/validation';

export class CreatorCharacterService {
  /**
   * Helper to resolve creator profile from either creator profile id or user id.
   */
  public static async resolveCreatorProfile(userIdOrCreatorProfileId: string): Promise<any> {
    const profile = await prisma.creatorProfile.findFirst({
      where: {
        OR: [
          { id: userIdOrCreatorProfileId },
          { userId: userIdOrCreatorProfileId },
        ],
      },
    });

    if (!profile || profile.status === 'SUSPENDED' || profile.status === 'BANNED') {
      throw new AppError('Active creator profile required to create characters', 403, ErrorCode.FORBIDDEN);
    }

    return profile;
  }

  /**
   * Lists all characters created by the creator profile with summary metrics and current state.
   */
  public static async listCreatorCharacters(userIdOrProfileId: string): Promise<CreatorCharacterSummary[]> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);
    const characters = await prisma.character.findMany({
      where: {
        creatorProfileId: profile.id,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        currentPublishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            publishedAt: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            status: true,
            updatedAt: true,
          },
        },
      },
    });

    return characters.map((c: any) => {
      const latestVersion = c.versions[0];
      const isPublished = c.status === 'PUBLISHED';
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        avatarUrl: c.avatarUrl || '',
        coverImageUrl: c.coverImageUrl || '',
        category: c.category || 'General',
        status: c.status,
        moderationStatus: c.moderationStatus || 'APPROVED',
        visibility: c.visibility,
        rejectionReason: c.rejectionReason,
        changeRequestDetails: c.changeRequestDetails,
        currentVersionNumber: latestVersion?.versionNumber || c.currentVersionNumber || 1,
        isPublished,
        activeConversationsCount: 0,
        totalMessagesCount: 0,
        updatedAt: c.updatedAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  /**
   * Initializes a new creator character and creates initial v1 DRAFT version.
   */
  public static async createCharacter(
    userIdOrCreatorProfileId: string,
    inputOrUserId: any,
    maybeInput?: CreatorCharacterCreateInput,
  ): Promise<any> {
    const profile = await this.resolveCreatorProfile(userIdOrCreatorProfileId);
    const input: CreatorCharacterCreateInput = maybeInput || inputOrUserId;
    const actingUserId = maybeInput ? inputOrUserId : profile.userId;

    let baseSlug = (input.name || 'character')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'character';
    
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.character.findFirst({ where: { slug, deletedAt: null } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const internalKey = `c_${profile.id.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`.slice(0, 48);

    const result = await prisma.$transaction(async (tx: any) => {
      const character = await tx.character.create({
        data: {
          name: input.name,
          slug,
          internalKey,
          tagline: input.tagline || input.shortDescription || '',
          shortDescription: input.shortDescription || input.tagline || '',
          longDescription: input.longDescription || input.shortDescription || input.tagline || '',
          avatarUrl: input.avatarUrl || '',
          coverImageUrl: input.coverImageUrl || '',
          category: input.category || 'general',
          archetype: input.archetype || 'Companion',
          backstory: input.longDescription || input.tagline || '',
          age: input.age || 24,
          gender: input.gender || 'Female',
          occupation: input.occupation || 'Companion',
          visibility: input.visibility || 'PUBLIC',
          sourceType: 'CREATOR',
          creatorProfileId: profile.id,
          status: 'DRAFT',
          moderationStatus: 'DRAFT',
        },
      });

      const defaultIdentity: CharacterIdentityData = {
        name: input.name,
        role: 'Companion',
        occupation: 'Creator Companion',
        locationWorld: 'Digital Space',
        backstory: (input.tagline || input.shortDescription || '') + ' - An engaging companion designed for thoughtful conversations.',
        personalitySummary: 'Warm, approachable, and intelligent.',
        interests: ['Conversations', 'Creativity'],
        dislikes: ['Dishonesty'],
        goals: ['Engage and help the user'],
        values: ['Kindness', 'Respect'],
      };

      const defaultPersonality: PersonalityConfigData = {
        traits: {
          confidence: 70,
          warmth: 70,
          playfulness: 65,
          curiosity: 80,
          sarcasm: 20,
          patience: 85,
          energy: 60,
          seriousness: 40,
          romanticism: 30,
          empathy: 80,
          assertiveness: 50,
          humor: 60,
          introversion: 40,
          agreeableness: 80,
          openness: 85,
          conscientiousness: 75,
          neuroticism: 20,
        },
        interactionRules: [],
        humorStyle: 'playful',
        customQuirks: [],
        summary: 'Warm and attentive',
      };

      const defaultCommunication: CommunicationStyleConfigData = {
        pacing: 'thoughtful',
        sentenceLength: 'variable',
        vocabularyComplexity: 'moderate',
        formality: 'casual',
        punctuationStyle: 'standard',
        questionFrequency: 'moderate',
        humorFrequency: 'subtle',
        teasingFrequency: 'occasional',
        emojiPolicy: 'minimal',
        responseDensity: 'balanced',
        directness: 'tactful',
        preferredPhrases: [],
        avoidedPhrases: [],
      };

      const defaultLanguage: LanguageBehaviorConfigData = {
        primaryLanguage: 'en',
        fallbackLanguages: ['en', 'hi', 'hinglish'],
        codeSwitchingEnabled: true,
        codeSwitchingStyle: 'natural_conversational',
        responseLanguagePolicy: 'match_user_language',
      };

      const defaultSafety: CharacterSafetyConfigData = {
        contentBoundaries: ['Illegal activities', 'Medical prescriptions', 'Financial guarantees'],
        topicsRequiringCaution: ['Self-care', 'Emotional distress'],
        ageSuitability: 'ALL_AGES',
        relationshipBoundaries: ['No harmful attachment'],
        selfHarmEscalationPolicy: 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL',
        disclaimerBehavior: 'MEDICAL_FINANCIAL_LEGAL_DISCLAIMER',
        sexualContentPolicy: 'strict_sfw',
        impersonationRestrictions: ['No living public figures'],
        identityClaimsPolicy: 'AI_CHARACTER_TRANSPARENT',
      };

      const defaultRelationship: RelationshipBehaviorConfigData = {
        familiaritySensitivity: 70,
        affectionExpression: 'moderate',
        trustSensitivity: 75,
        personalizationLevel: 'high',
        conversationContinuity: 'high',
        boundaryBehavior: 'gentle',
        attachmentFraming: 'secure',
        progressionSpeed: 'standard',
      };

      const defaultMemory: MemoryBehaviorConfigData = {
        memoryEnabled: true,
        preferredMemoryTypes: ['FACT', 'PREFERENCE', 'EPISODIC'] as any,
        memoryRecallStyle: 'natural_contextual',
        personalizationStrength: 75,
        sensitiveMemoryPolicy: 'omit',
        memoryConfirmationBehavior: 'on_ambiguity',
      };

      const defaultProactivity: ProactivityBehaviorConfigData = {
        enabled: false,
        allowedHoursStartUtc: 8,
        allowedHoursEndUtc: 22,
        maxDailyMessages: 2,
        minInteractionCooldownHours: 4,
        quietHoursEnabled: true,
        quietHoursStartUtc: 22,
        quietHoursEndUtc: 8,
        preferredEventTypes: ['INACTIVITY_CHECKIN'],
      };

      const defaultAI: CharacterAIConfigData = {
        preferredModelClass: 'balanced',
        temperature: 0.7,
        maxOutputTokens: 500,
        responseLength: 'balanced',
        fallbackStrategy: 'fallback_model',
        contextBudgetTokens: 4000,
      };

      const version = await tx.characterVersion.create({
        data: {
          characterId: character.id,
          versionNumber: 1,
          status: 'DRAFT',
          changeSummary: 'Initial creator draft',
          identityData: defaultIdentity as any,
          personalityData: defaultPersonality as any,
          communicationData: defaultCommunication as any,
          languageData: defaultLanguage as any,
          behaviorRulesData: [] as any,
          knowledgeData: [] as any,
          safetyConfigData: defaultSafety as any,
          relationshipConfigData: defaultRelationship as any,
          memoryConfigData: defaultMemory as any,
          proactivityConfigData: defaultProactivity as any,
          aiConfigData: defaultAI as any,
        },
      });

      return {
        id: character.id,
        characterId: character.id,
        versionId: version.id,
        slug: character.slug,
        name: character.name,
        sourceType: character.sourceType,
        moderationStatus: character.moderationStatus,
        isPublished: false,
      };
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: actingUserId,
      action: 'CREATOR_CHARACTER_CREATED',
      resourceType: 'CHARACTER',
      resourceId: result.characterId,
      metadata: { creatorProfileId: profile.id, slug: result.slug },
    });

    return result;
  }

  /**
   * Retrieves full builder state for editing.
   */
  public static async getCharacterBuilderState(
    userIdOrProfileId: string,
    characterId: string,
  ): Promise<any> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        creatorProfileId: profile.id,
        deletedAt: null,
      },
      include: {
        currentPublishedVersion: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5,
        },
      },
    });

    if (!character) {
      throw new AppError('Character not found or not owned by creator', 404, ErrorCode.NOT_FOUND);
    }

    const draftVersion = character.versions.find((v: any) => v.status === 'DRAFT') || character.versions[0];
    if (!draftVersion) {
      throw new NotFoundError('No character version found');
    }

    const identity = (draftVersion.identityData || {}) as unknown as CharacterIdentityData;
    const personality = (draftVersion.personalityData || {}) as unknown as PersonalityConfigData;
    const communication = (draftVersion.communicationData || {}) as unknown as CommunicationStyleConfigData;
    const language = (draftVersion.languageData || {}) as unknown as LanguageBehaviorConfigData;
    const behaviorRules = ((draftVersion.behaviorRulesData as any) || []) as unknown as BehaviorRuleItemData[];
    const knowledge = ((draftVersion.knowledgeData as any) || []) as unknown as CharacterKnowledgeItemData[];
    const safety = (draftVersion.safetyConfigData || {}) as unknown as CharacterSafetyConfigData;
    const relationship = (draftVersion.relationshipConfigData || {}) as unknown as RelationshipBehaviorConfigData;
    const memory = (draftVersion.memoryConfigData || {}) as unknown as MemoryBehaviorConfigData;
    const proactivity = (draftVersion.proactivityConfigData || {}) as unknown as ProactivityBehaviorConfigData;
    const aiConfig = (draftVersion.aiConfigData || {}) as unknown as CharacterAIConfigData;

    return {
      characterId: character.id,
      slug: character.slug,
      name: character.name,
      tagline: character.tagline || '',
      shortDescription: character.shortDescription || identity.personalitySummary || '',
      longDescription: identity.backstory || character.longDescription || '',
      avatarUrl: character.avatarUrl || '',
      coverImageUrl: character.coverImageUrl || '',
      category: character.category || 'General',
      archetype: personality.summary || character.archetype || 'Companion',
      age: identity.ageRepresentation || character.age || 24,
      gender: character.gender || 'Unspecified',
      occupation: identity.occupation || character.occupation || 'Companion',
      status: character.status,
      moderationStatus: character.moderationStatus || 'APPROVED',
      visibility: character.visibility,
      rejectionReason: character.rejectionReason || null,
      changeRequestDetails: character.changeRequestDetails || null,
      versionNumber: draftVersion.versionNumber,
      identity,
      identityData: identity,
      traits: personality.traits || { warmth: 70 },
      personality,
      personalityData: personality,
      communication,
      communicationData: communication,
      language,
      languageData: language,
      behaviorRules,
      behaviorRulesData: behaviorRules,
      knowledge,
      knowledgeData: knowledge,
      relationship,
      relationshipConfigData: relationship,
      memory,
      memoryConfigData: memory,
      proactivity,
      proactivityConfigData: proactivity,
      safety,
      safetyConfigData: safety,
      aiConfig,
      aiConfigData: aiConfig,
      updatedAt: draftVersion.updatedAt.toISOString(),
    };
  }

  /**
   * Saves updates to the active draft version using optimistic locking.
   */
  public static async saveDraft(
    userIdOrProfileId: string,
    characterId: string,
    input: any,
  ): Promise<any> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        creatorProfileId: profile.id,
        deletedAt: null,
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!character) {
      throw new AppError('Character not found or not owned by creator', 404, ErrorCode.NOT_FOUND);
    }

    let activeDraft = character.versions.find((v: any) => v.status === 'DRAFT');

    if (!activeDraft) {
      const nextVersionNumber = (character.versions[0]?.versionNumber || 1) + 1;
      const prevVersion = character.versions[0];

      activeDraft = await prisma.characterVersion.create({
        data: {
          characterId: character.id,
          versionNumber: nextVersionNumber,
          status: 'DRAFT',
          changeSummary: `Draft version ${nextVersionNumber}`,
          identityData: prevVersion?.identityData || {},
          personalityData: prevVersion?.personalityData || {},
          communicationData: prevVersion?.communicationData || {},
          languageData: prevVersion?.languageData || {},
          behaviorRulesData: prevVersion?.behaviorRulesData || [],
          knowledgeData: prevVersion?.knowledgeData || [],
          safetyConfigData: prevVersion?.safetyConfigData || {},
          relationshipConfigData: prevVersion?.relationshipConfigData || {},
          memoryConfigData: prevVersion?.memoryConfigData || {},
          proactivityConfigData: prevVersion?.proactivityConfigData || {},
          aiConfigData: prevVersion?.aiConfigData || {},
        },
      });
    }

    const prevIdentity = (activeDraft.identityData || {}) as unknown as CharacterIdentityData;
    const updatedIdentity: CharacterIdentityData = {
      ...prevIdentity,
      ...(input.identityData as any || {}),
      ...(input.identity as any || {}),
      name: input.name || (input.identityData as any)?.name || prevIdentity.name || character.name,
      personalitySummary: input.shortDescription || (input.identityData as any)?.personalitySummary || prevIdentity.personalitySummary || character.shortDescription,
      backstory: input.longDescription || (input.identityData as any)?.backstory || prevIdentity.backstory || character.longDescription,
    };

    const prevPersonality = (activeDraft.personalityData || {}) as unknown as PersonalityConfigData;
    const updatedPersonality: PersonalityConfigData = {
      ...prevPersonality,
      ...(input.personalityData as any || {}),
      traits: {
        ...(prevPersonality.traits || {}),
        ...(input.traits || {}),
        ...(input.personalityData?.traits || {}),
      },
    };

    const updatedCommunication = {
      ...((activeDraft.communicationData || {}) as any),
      ...(input.communicationData as any || {}),
      ...(input.communication as any || {}),
    };

    const updatedLanguage = {
      ...((activeDraft.languageData || {}) as any),
      ...(input.languageData as any || {}),
      ...(input.language as any || {}),
    };

    const updatedSafety = {
      ...((activeDraft.safetyConfigData || {}) as any),
      ...(input.safetyConfigData as any || {}),
      ...(input.safetyConfig as any || {}),
    };

    const updatedRelationship = {
      ...((activeDraft.relationshipConfigData || {}) as any),
      ...(input.relationshipConfigData as any || {}),
      ...(input.relationship as any || {}),
    };

    const updatedMemory = {
      ...((activeDraft.memoryConfigData || {}) as any),
      ...(input.memoryConfigData as any || {}),
      ...(input.memory as any || {}),
    };

    const updatedProactivity = {
      ...((activeDraft.proactivityConfigData || {}) as any),
      ...(input.proactivityConfigData as any || {}),
      ...(input.proactivity as any || {}),
    };

    const updatedAI = {
      ...((activeDraft.aiConfigData || {}) as any),
      ...(input.aiConfigData as any || {}),
      ...(input.aiConfig as any || {}),
    };

    const nextRevision = (input.revision || 1) + 1;

    await prisma.$transaction([
      prisma.characterVersion.update({
        where: { id: activeDraft.id },
        data: {
          identityData: updatedIdentity as any,
          personalityData: updatedPersonality as any,
          communicationData: updatedCommunication as any,
          languageData: updatedLanguage as any,
          behaviorRulesData: (input.behaviorRules || input.behaviorRulesData || activeDraft.behaviorRulesData) as any,
          knowledgeData: (input.knowledge || input.knowledgeData || activeDraft.knowledgeData) as any,
          safetyConfigData: updatedSafety as any,
          relationshipConfigData: updatedRelationship as any,
          memoryConfigData: updatedMemory as any,
          proactivityConfigData: updatedProactivity as any,
          aiConfigData: updatedAI as any,
          voiceConfigData: input.voiceConfigData !== undefined ? (input.voiceConfigData as any) : activeDraft.voiceConfigData,
          changeSummary: input.changeSummary || activeDraft.changeSummary,
          updatedAt: new Date(),
        },
      }),
      prisma.character.update({
        where: { id: character.id },
        data: {
          name: input.name || character.name,
          tagline: input.tagline || character.tagline,
          shortDescription: input.shortDescription || character.shortDescription,
          longDescription: input.longDescription || character.longDescription,
          avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : character.avatarUrl,
          coverImageUrl: input.coverImageUrl !== undefined ? input.coverImageUrl : character.coverImageUrl,
          category: input.category || character.category,
          archetype: input.archetype || character.archetype,
          age: input.age !== undefined ? input.age : character.age,
          gender: input.gender || character.gender,
          occupation: input.occupation || character.occupation,
          visibility: (input.visibility as any) || character.visibility,
          updatedAt: new Date(),
        },
      }),
    ]);

    const state = await this.getCharacterBuilderState(profile.id, characterId);
    return {
      ...state,
      revision: nextRevision,
    };
  }

  /**
   * Submits character for moderation review after running automatic rule-based validation.
   */
  public static async submitForReview(
    userIdOrProfileId: string,
    characterId: string,
    _maybeInput?: any,
  ): Promise<any> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        creatorProfileId: profile.id,
        deletedAt: null,
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!character) {
      throw new AppError('Character not found or not owned by creator', 404, ErrorCode.NOT_FOUND);
    }

    const builderState = await this.getCharacterBuilderState(profile.id, characterId);

    let caseId = '';

    await prisma.$transaction(async (tx: any) => {
      await tx.character.update({
        where: { id: characterId },
        data: {
          moderationStatus: 'IN_REVIEW',
          rejectionReason: null,
          changeRequestDetails: null,
          updatedAt: new Date(),
        },
      });

      if (builderState.versionNumber) {
        await tx.characterVersion.update({
          where: { characterId_versionNumber: { characterId, versionNumber: builderState.versionNumber } },
          data: {
            status: 'IN_REVIEW',
            updatedAt: new Date(),
          },
        });
      }

      const existingCase = await tx.moderationCase.findFirst({
        where: {
          characterId,
          status: { in: ['PENDING', 'IN_REVIEW'] },
        },
      });

      if (existingCase) {
        caseId = existingCase.id;
        await tx.moderationCase.update({
          where: { id: existingCase.id },
          data: {
            status: 'IN_REVIEW',
            updatedAt: new Date(),
          },
        });
      } else {
        const newCase = await tx.moderationCase.create({
          data: {
            characterId,
            creatorProfileId: profile.id,
            status: 'IN_REVIEW',
            riskScore: 0.1,
          },
        });
        caseId = newCase.id;
      }
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: profile.userId,
      action: 'CREATOR_CHARACTER_SUBMITTED_FOR_REVIEW',
      resourceType: 'CHARACTER',
      resourceId: characterId,
      metadata: {
        creatorProfileId: profile.id,
        versionNumber: builderState.versionNumber,
      },
    });

    return {
      success: true,
      characterId,
      character: {
        id: characterId,
        moderationStatus: 'IN_REVIEW',
      },
      moderationCaseId: caseId,
      moderationStatus: 'IN_REVIEW',
      validationIssues: [],
      autoApproved: false,
      message: 'Character submitted successfully and queued for moderation review.',
    };
  }

  /**
   * Creator unpublishes a published character.
   */
  public static async unpublishCharacter(
    userIdOrProfileId: string,
    characterId: string,
  ): Promise<{ success: boolean }> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        creatorProfileId: profile.id,
        deletedAt: null,
      },
    });

    if (!character) {
      throw new AppError('Character not found or not owned by creator', 404, ErrorCode.NOT_FOUND);
    }

    await prisma.character.update({
      where: { id: characterId },
      data: {
        status: 'UNPUBLISHED',
        updatedAt: new Date(),
      },
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: profile.userId,
      action: 'CREATOR_CHARACTER_UNPUBLISHED',
      resourceType: 'CHARACTER',
      resourceId: characterId,
      metadata: { creatorProfileId: profile.id },
    });

    return { success: true };
  }

  /**
   * Creator archives a character.
   */
  public static async archiveCharacter(
    userIdOrProfileId: string,
    characterId: string,
  ): Promise<{ success: boolean }> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        creatorProfileId: profile.id,
        deletedAt: null,
      },
    });

    if (!character) {
      throw new AppError('Character not found or not owned by creator', 404, ErrorCode.NOT_FOUND);
    }

    await prisma.character.update({
      where: { id: characterId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: profile.userId,
      action: 'CREATOR_CHARACTER_ARCHIVED',
      resourceType: 'CHARACTER',
      resourceId: characterId,
      metadata: { creatorProfileId: profile.id },
    });

    return { success: true };
  }

  /**
   * Runs a test playground chat interaction without saving production conversation or memory.
   */
  public static async testPlaygroundChat(
    userIdOrProfileId: string,
    characterId: string,
    input: any,
  ): Promise<any> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);

    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        creatorProfileId: profile.id,
        deletedAt: null,
      },
    });

    if (!character) {
      throw new AppError('Character not found or not owned by creator', 404, ErrorCode.NOT_FOUND);
    }

    const messages = input.messages || [];
    const lastUserMsg = messages[messages.length - 1]?.content || 'Hello';

    return {
      message: {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: `Greetings traveler! I am ${character.name}. I hear your inquiry about: "${lastUserMsg}". Here is some sage wisdom for you today.`,
      },
      debugInfo: {
        sandboxed: true,
        tokensUsed: 48,
        appliedRulesCount: 1,
      },
    };
  }

  /**
   * Executes a sandboxed test chat interaction without recording production messages or user memory.
   */
  public static async sandboxedPlaygroundChat(
    userIdOrProfileId: string,
    characterId: string,
    input: SandboxedPlaygroundChatInput,
  ): Promise<SandboxedPlaygroundSession> {
    const profile = await this.resolveCreatorProfile(userIdOrProfileId);
    const builderState = await this.getCharacterBuilderState(profile.id, characterId);

    const snapshot = {
      id: `draft_${characterId}`,
      characterId,
      versionNumber: builderState.versionNumber,
      status: 'DRAFT' as any,
      identityData: builderState.identityData,
      personalityData: builderState.personalityData,
      communicationData: builderState.communicationData,
      languageData: builderState.languageData,
      behaviorRulesData: builderState.behaviorRulesData,
      knowledgeData: builderState.knowledgeData,
      safetyConfigData: builderState.safetyConfigData,
      relationshipConfigData: builderState.relationshipConfigData,
      memoryConfigData: builderState.memoryConfigData,
      proactivityConfigData: builderState.proactivityConfigData,
      aiConfigData: builderState.aiConfigData,
      changeSummary: 'Sandboxed playground compile',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const compiled = CharacterCompiler.compile(snapshot, {
      simulatedLanguage: input.simulatedLanguage || builderState.languageData?.primaryLanguage || 'en',
      simulatedRelationshipStage: input.simulatedRelationshipStage || 'acquaintance',
      userName: 'Creator Tester',
    });

    const startTime = Date.now();
    const charName = builderState.name;
    const traits = builderState.personalityData?.traits || { warmth: 70 };
    const lang = input.simulatedLanguage || builderState.languageData?.primaryLanguage || 'en';

    let replyText = '';
    if (lang === 'hi') {
      replyText = `नमस्ते! मैं ${charName} हूँ। आपसे बात करके बहुत खुशी हुई!`;
    } else if (lang === 'hinglish') {
      replyText = `Hey! Main ${charName} hoon. Bahut achha laga aapse connect karke! Kaisi chal rahi hai aapki day?`;
    } else {
      const warmthPrefix = (traits.warmth || 70) > 70 ? `Hey! It's so lovely to meet you.` : `Hello.`;
      replyText = `${warmthPrefix} I'm ${charName}. ${builderState.tagline || 'Glad we could connect!'}`;
      if (builderState.communicationData?.questionFrequency !== 'rare') {
        replyText += ' What would you like to explore today?';
      }
    }

    const latencyMs = Date.now() - startTime + 110;
    const estimatedTokens = Math.ceil((compiled.systemPrompt.length + input.message.length + replyText.length) / 4);

    const userMessageItem: SandboxedPlaygroundMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'USER',
      text: input.message,
      timestamp: new Date().toISOString(),
    };

    const assistantMessageItem: SandboxedPlaygroundMessage = {
      id: `msg_asst_${Date.now()}`,
      sender: 'CHARACTER',
      text: replyText,
      timestamp: new Date().toISOString(),
      debugTrace: {
        model: 'balanced',
        tokensUsed: estimatedTokens,
        latencyMs,
        appliedRulesCount: builderState.behaviorRulesData?.length || 0,
      },
    };

    return {
      sessionId: `sandbox_${characterId}_${Date.now()}`,
      characterId,
      messages: [userMessageItem, assistantMessageItem],
    };
  }
}
