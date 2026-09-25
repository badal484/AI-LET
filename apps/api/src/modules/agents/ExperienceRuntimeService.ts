import { CharacterExperienceItem } from '@ai-companion/types';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import { UserGoalService } from '../characters/engine/UserGoalService.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export interface StartExperienceResult {
  experience: CharacterExperienceItem;
  goalId: string;
  initialPrompt: string;
}

export class ExperienceRuntimeService {
  private static instance: ExperienceRuntimeService;
  private readonly goalService = UserGoalService.getInstance();
  private readonly cache: Map<string, CharacterExperienceItem> = new Map();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ExperienceRuntimeService {
    if (!ExperienceRuntimeService.instance) {
      ExperienceRuntimeService.instance = new ExperienceRuntimeService();
    }
    return ExperienceRuntimeService.instance;
  }

  /**
   * Initializes default experiences in the database and warms the local cache.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const existing = await prisma.characterExperience.findMany();
      if (existing.length === 0) {
        await this.seedDefaultExperiences();
      } else {
        for (const item of existing) {
          this.cache.set(item.slug, this.mapToItem(item));
        }
      }
      this.isInitialized = true;
      logger.info(`ExperienceRuntimeService: initialized with ${this.cache.size} cached experiences`);
    } catch (err: any) {
      logger.warn(`ExperienceRuntimeService: DB init warning (${err.message}), seeding memory defaults`);
      this.seedInMemoryDefaults();
      this.isInitialized = true;
    }
  }

  /**
   * Lists all published experiences.
   */
  public listExperiences(): CharacterExperienceItem[] {
    return Array.from(this.cache.values()).filter((e) => e.status === 'published');
  }

  /**
   * Retrieves an experience by slug.
   */
  public getExperience(slug: string): CharacterExperienceItem | undefined {
    return this.cache.get(slug);
  }

  /**
   * Starts a guided multi-turn experience for a user and character.
   */
  public async startExperience(
    userId: string,
    characterId: string,
    experienceSlug: string,
    conversationId?: string
  ): Promise<StartExperienceResult> {
    const experience = this.getExperience(experienceSlug);
    if (!experience) {
      throw new NotFoundError(`Experience '${experienceSlug}' not found.`, ErrorCode.NOT_FOUND);
    }

    // Create corresponding active UserGoal
    const goal = await this.goalService.createGoal(userId, {
      characterId,
      conversationId: conversationId || null,
      category: experience.category,
      title: `${experience.name} Session`,
      constraints: { experienceSlug },
      metadata: {
        goalTemplate: experience.goalTemplate,
        requiredSkillSlugs: experience.requiredSkillSlugs,
      },
    });

    logger.info(`ExperienceRuntimeService: started '${experienceSlug}' for user '${userId}' (Goal: ${goal.id})`);

    return {
      experience,
      goalId: goal.id,
      initialPrompt: experience.initialPrompt,
    };
  }

  private async seedDefaultExperiences(): Promise<void> {
    const defaults = this.getDefaultExperiences();
    for (const d of defaults) {
      const created = await prisma.characterExperience.create({
        data: {
          id: d.id,
          slug: d.slug,
          name: d.name,
          description: d.description,
          category: d.category,
          goalTemplate: d.goalTemplate,
          requiredSkillSlugs: d.requiredSkillSlugs as any,
          initialPrompt: d.initialPrompt,
          uiConfig: d.uiConfig as any,
          status: 'published',
          version: '1.0.0',
        },
      });
      this.cache.set(d.slug, this.mapToItem(created));
    }
  }

  private seedInMemoryDefaults(): void {
    for (const d of this.getDefaultExperiences()) {
      this.cache.set(d.slug, d);
    }
  }

  private getDefaultExperiences(): CharacterExperienceItem[] {
    return [
      {
        id: 'exp_study_session',
        slug: 'study_session',
        name: 'Interactive Study & Research Session',
        description: 'Deep-dive into academic topics, analyze reference documents, and answer targeted comprehension questions.',
        category: 'education',
        goalTemplate: 'study_session',
        requiredSkillSlugs: ['study_assistant'],
        initialPrompt: 'Welcome to our study session! Share your topic, document, or key questions to get started.',
        uiConfig: { showDocUpload: true, quizModeAvailable: true },
        status: 'published',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp_interview_prep',
        slug: 'interview_prep',
        name: 'Mock Interview & Career Coaching',
        description: 'Simulate behavioral and technical interviews with constructive real-time feedback and rubric evaluation.',
        category: 'career',
        goalTemplate: 'interview_prep',
        requiredSkillSlugs: ['study_assistant'],
        initialPrompt: "Let's prepare for your upcoming interview. What role and industry are you targeting today?",
        uiConfig: { rubricScorecard: true, timedResponses: true },
        status: 'published',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp_travel_planner',
        slug: 'travel_planner',
        name: 'Curated Travel & Itinerary Designer',
        description: 'Plan comprehensive travel schedules, discover destinations, and schedule events directly to your calendar.',
        category: 'productivity',
        goalTemplate: 'travel_planning',
        requiredSkillSlugs: ['travel_planner', 'calendar_manager'],
        initialPrompt: "Ready for an adventure! Where are you thinking of traveling, what are your dates, and what's your target vibe?",
        uiConfig: { mapIntegration: true, calendarSync: true },
        status: 'published',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'exp_coding_mentor',
        slug: 'coding_mentor',
        name: 'Interactive Coding & Architecture Mentor',
        description: 'Pair program, review architecture decisions, and debug complex problems with step-by-step guidance.',
        category: 'technical',
        goalTemplate: 'coding_session',
        requiredSkillSlugs: ['study_assistant'],
        initialPrompt: "What are we building or debugging today? Paste in your code or architecture challenge to begin.",
        uiConfig: { codeHighlighter: true, diffViewer: true },
        status: 'published',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  private mapToItem(record: any): CharacterExperienceItem {
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
      category: record.category,
      characterId: record.characterId,
      creatorId: record.creatorId,
      goalTemplate: record.goalTemplate,
      requiredSkillSlugs: record.requiredSkillSlugs as string[],
      initialPrompt: record.initialPrompt,
      uiConfig: record.uiConfig as Record<string, unknown> | null,
      evaluationCriteria: record.evaluationCriteria as Record<string, unknown> | null,
      status: record.status as any,
      version: record.version,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
