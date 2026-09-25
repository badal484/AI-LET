import { SkillItem } from '@ai-companion/types';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';

export class SkillRegistryService {
  private static instance: SkillRegistryService;

  private readonly cache: Map<string, SkillItem> = new Map();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): SkillRegistryService {
    if (!SkillRegistryService.instance) {
      SkillRegistryService.instance = new SkillRegistryService();
    }
    return SkillRegistryService.instance;
  }

  /**
   * Initializes default skills in the database and warms the local cache.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const existing = await prisma.skillRecord.findMany();
      if (existing.length === 0) {
        await this.seedDefaultDatabaseSkills();
      } else {
        for (const item of existing) {
          this.cache.set(item.slug, this.mapToItem(item));
        }
      }
      this.isInitialized = true;
      logger.info(`SkillRegistryService: initialized with ${this.cache.size} cached skills`);
    } catch (err: any) {
      logger.warn(`SkillRegistryService: DB init warning (${err.message}), falling back to memory defaults`);
      this.seedInMemoryDefaults();
      this.isInitialized = true;
    }
  }

  /**
   * Registers or updates a skill in the catalog
   */
  public async registerSkill(skill: SkillItem, creatorId?: string): Promise<SkillItem> {
    // Creator skill sandbox guardrails
    if (creatorId) {
      if (skill.maxSteps > 10) {
        throw new ForbiddenError('Creator skills cannot exceed 10 maxSteps', ErrorCode.FORBIDDEN);
      }
      if (skill.maxCostUsd > 0.50) {
        throw new ForbiddenError('Creator skills cannot exceed $0.50 maxCostUsd', ErrorCode.FORBIDDEN);
      }
    }

    try {
      const record = await prisma.skillRecord.upsert({
        where: { slug: skill.slug },
        update: {
          name: skill.name,
          description: skill.description,
          category: skill.category,
          status: skill.status,
          requiredCapabilities: skill.requiredCapabilities as any,
          requiredToolSlugs: skill.requiredToolSlugs as any,
          maxSteps: skill.maxSteps,
          maxCostUsd: skill.maxCostUsd,
          isCreatorSkill: !!creatorId,
          creatorId: creatorId || null,
        },
        create: {
          id: skill.id || `skill_${skill.slug}`,
          slug: skill.slug,
          name: skill.name,
          description: skill.description,
          category: skill.category,
          status: skill.status,
          requiredCapabilities: skill.requiredCapabilities as any,
          requiredToolSlugs: skill.requiredToolSlugs as any,
          maxSteps: skill.maxSteps,
          maxCostUsd: skill.maxCostUsd,
          isCreatorSkill: !!creatorId,
          creatorId: creatorId || null,
        },
      });

      const item = this.mapToItem(record);
      this.cache.set(item.slug, item);
      return item;
    } catch (err: any) {
      logger.error(`SkillRegistryService: DB error during registerSkill, updating memory cache: ${err.message}`);
      this.cache.set(skill.slug, skill);
      return skill;
    }
  }

  /**
   * Retrieves a skill by slug
   */
  public getSkill(slug: string): SkillItem | undefined {
    return this.cache.get(slug);
  }

  /**
   * Lists all approved or published skills
   */
  public listSkills(): SkillItem[] {
    return Array.from(this.cache.values());
  }

  /**
   * Assigns a skill to a character
   */
  public async assignSkillToCharacter(
    characterId: string,
    skillSlug: string,
    assignmentType: 'default' | 'optional' | 'premium' | 'creator' | 'disabled' = 'default',
    isEnabled: boolean = true,
    customConfig?: Record<string, unknown>
  ): Promise<void> {
    const skill = this.getSkill(skillSlug);
    if (!skill) {
      throw new NotFoundError(`Skill '${skillSlug}' does not exist in registry.`, ErrorCode.NOT_FOUND);
    }

    await prisma.characterSkill.upsert({
      where: {
        characterId_skillSlug: {
          characterId,
          skillSlug,
        },
      },
      update: {
        assignmentType,
        isEnabled,
        customConfig: (customConfig as any) || undefined,
      },
      create: {
        characterId,
        skillSlug,
        assignmentType,
        isEnabled,
        customConfig: (customConfig as any) || undefined,
      },
    });

    logger.info(`SkillRegistryService: assigned skill '${skillSlug}' to character '${characterId}' (${assignmentType})`);
  }

  /**
   * Retrieves all enabled skills for a character
   */
  public async getCharacterSkills(characterId: string): Promise<SkillItem[]> {
    try {
      const assigned = await prisma.characterSkill.findMany({
        where: { characterId, isEnabled: true },
      });

      const result: SkillItem[] = [];
      for (const a of assigned) {
        const item = this.getSkill(a.skillSlug);
        if (item && item.status === 'published') {
          result.push(item);
        }
      }
      return result;
    } catch {
      // Fallback: return default productivity skills for baseline characters
      return this.listSkills().slice(0, 3);
    }
  }

  private async seedDefaultDatabaseSkills(): Promise<void> {
    const defaults = this.getDefaultSkillItems();
    for (const d of defaults) {
      const record = await prisma.skillRecord.create({
        data: {
          id: d.id,
          slug: d.slug,
          name: d.name,
          description: d.description,
          category: d.category,
          status: d.status,
          requiredCapabilities: d.requiredCapabilities as any,
          requiredToolSlugs: d.requiredToolSlugs as any,
          maxSteps: d.maxSteps,
          maxCostUsd: d.maxCostUsd,
          isCreatorSkill: false,
        },
      });

      // Also create initial v1.0.0 version
      await prisma.skillVersionRecord.create({
        data: {
          skillId: record.id,
          version: '1.0.0',
          config: { maxSteps: d.maxSteps, maxCostUsd: d.maxCostUsd } as any,
          status: 'published',
          changelog: 'Initial baseline skill release',
        },
      });

      this.cache.set(d.slug, this.mapToItem(record));
    }
  }

  private seedInMemoryDefaults(): void {
    for (const d of this.getDefaultSkillItems()) {
      this.cache.set(d.slug, d);
    }
  }

  private getDefaultSkillItems(): SkillItem[] {
    return [
      {
        id: 'skill_travel_planner',
        name: 'Travel & Itinerary Planner',
        slug: 'travel_planner',
        description: 'Searches travel guides, plans multi-day schedules, and adds events to your calendar.',
        version: '1.0.0',
        category: 'Productivity',
        status: 'published',
        requiredCapabilities: ['browser.read', 'calendar.write'],
        requiredToolSlugs: ['browser.read', 'calendar.read', 'calendar.create_event'],
        maxSteps: 8,
        maxCostUsd: 0.15,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'skill_study_assistant',
        name: 'Document & Study Assistant',
        slug: 'study_assistant',
        description: 'Analyzes research papers, lecture notes, and study guides with grounded citations.',
        version: '1.0.0',
        category: 'Education',
        status: 'published',
        requiredCapabilities: ['document.analyze'],
        requiredToolSlugs: ['document.analyze'],
        maxSteps: 5,
        maxCostUsd: 0.10,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'skill_calendar_manager',
        name: 'Personal Scheduling & Calendar Assistant',
        slug: 'calendar_manager',
        description: 'Reviews daily schedule, spots scheduling conflicts, and creates events seamlessly.',
        version: '1.0.0',
        category: 'Productivity',
        status: 'published',
        requiredCapabilities: ['calendar.read', 'calendar.write'],
        requiredToolSlugs: ['calendar.read', 'calendar.create_event'],
        maxSteps: 6,
        maxCostUsd: 0.08,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'skill_email_assistant',
        name: 'Email Communications Assistant',
        slug: 'email_assistant',
        description: 'Drafts emails in the character voice and sends messages upon explicit user confirmation.',
        version: '1.0.0',
        category: 'Communication',
        status: 'published',
        requiredCapabilities: ['email.draft', 'email.send'],
        requiredToolSlugs: ['email.draft', 'email.send'],
        maxSteps: 4,
        maxCostUsd: 0.12,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private mapToItem(record: any): SkillItem {
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      version: '1.0.0',
      category: record.category,
      status: record.status as any,
      requiredCapabilities: record.requiredCapabilities as string[],
      requiredToolSlugs: record.requiredToolSlugs as string[],
      maxSteps: record.maxSteps,
      maxCostUsd: record.maxCostUsd,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
