import { Request, Response } from 'express';
import { AgentTaskService } from './AgentTaskService.js';
import { UserConsentService } from './UserConsentService.js';
import { MultimodalContextService } from './MultimodalContextService.js';
import { ToolRegistry } from './ToolRegistry.js';
import { SkillRegistryService } from './SkillRegistryService.js';
import { CharacterCapabilityService } from './CharacterCapabilityService.js';
import { AgentTraceService } from './AgentTraceService.js';
import { ExperienceRuntimeService } from './ExperienceRuntimeService.js';
import { UserGoalService } from '../characters/engine/UserGoalService.js';
import { CharacterRuntimeSnapshotService } from '../characters/engine/CharacterRuntimeSnapshotService.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import {
  createAgentTaskSchema,
  confirmAgentStepSchema,
  grantUserConsentSchema,
  toolRegistryItemSchema,
  skillItemSchema,
  multimodalUploadMetadataSchema,
} from '@ai-companion/validation';

export class AgentsController {
  private readonly taskService = AgentTaskService.getInstance();
  private readonly consentService = UserConsentService.getInstance();
  private readonly multimodalService = MultimodalContextService.getInstance();
  private readonly toolRegistry = ToolRegistry.getInstance();
  private readonly skillRegistry = SkillRegistryService.getInstance();
  private readonly capabilityService = CharacterCapabilityService.getInstance();
  private readonly traceService = AgentTraceService.getInstance();
  private readonly experienceService = ExperienceRuntimeService.getInstance();
  private readonly goalService = UserGoalService.getInstance();
  private readonly snapshotService = CharacterRuntimeSnapshotService.getInstance();

  // ---------------------------------------------------------------------------
  // User Task Handlers
  // ---------------------------------------------------------------------------

  public createTask = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const parsed = createAgentTaskSchema.parse(req.body);
    const result = await this.taskService.createTask(userId, parsed as any);
    res.status(201).json({ success: true, data: result });
  };

  public getTask = async (req: Request, res: Response): Promise<void> => {
    const taskId = String(req.params['taskId'] || '');
    const result = await this.taskService.getTask(taskId);
    if (!result) {
      res.status(404).json({ success: false, error: `Task '${taskId}' not found.` });
      return;
    }
    res.json({ success: true, data: result });
  };

  public confirmStep = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const taskId = String(req.params['taskId'] || '');
    const parsed = confirmAgentStepSchema.parse(req.body);
    const result = await this.taskService.confirmTaskStep(userId, taskId, {
      token: parsed.token,
      action: parsed.action as any,
    });
    res.json({ success: true, data: result });
  };

  public cancelTask = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const taskId = String(req.params['taskId'] || '');
    const cancelled = await this.taskService.cancelTask(taskId, userId);
    res.json({ success: true, data: cancelled });
  };

  public listTasks = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const tasks = await this.taskService.listUserTasks(userId);
    res.json({ success: true, data: tasks });
  };

  // ---------------------------------------------------------------------------
  // User Skills & Experiences Handlers
  // ---------------------------------------------------------------------------

  public listSkills = async (_req: Request, res: Response): Promise<void> => {
    await this.skillRegistry.initialize();
    const skills = this.skillRegistry.listSkills();
    res.json({ success: true, data: skills });
  };

  public getSkill = async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params['slug'] || '');
    const skill = this.skillRegistry.getSkill(slug);
    if (!skill) {
      res.status(404).json({ success: false, error: `Skill '${slug}' not found.` });
      return;
    }
    res.json({ success: true, data: skill });
  };

  public listExperiences = async (_req: Request, res: Response): Promise<void> => {
    await this.experienceService.initialize();
    const experiences = this.experienceService.listExperiences();
    res.json({ success: true, data: experiences });
  };

  public getExperience = async (req: Request, res: Response): Promise<void> => {
    const slug = String(req.params['slug'] || '');
    const experience = this.experienceService.getExperience(slug);
    if (!experience) {
      res.status(404).json({ success: false, error: `Experience '${slug}' not found.` });
      return;
    }
    res.json({ success: true, data: experience });
  };

  public startExperience = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const slug = String(req.params['slug'] || '');
    const characterId = typeof req.body?.characterId === 'string' ? req.body.characterId : '';
    const conversationId = req.body.conversationId ? String(req.body.conversationId) : undefined;
    if (!characterId) throw new BadRequestError('characterId is required to start an experience');
    // The companion must be one the user can actually talk to: published, or their own draft.
    const character = await prisma.character.findFirst({
      where: { id: characterId, OR: [{ status: 'PUBLISHED' }, { creatorProfile: { userId } }] },
      select: { id: true },
    });
    if (!character) throw new NotFoundError('Character not found');

    const result = await this.experienceService.startExperience(userId, characterId, slug, conversationId);
    res.status(201).json({ success: true, data: result });
  };

  // ---------------------------------------------------------------------------
  // User Goals Handlers
  // ---------------------------------------------------------------------------

  public listGoals = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const status = req.query['status'] ? String(req.query['status']) : undefined;
    const goals = await this.goalService.listUserGoals(userId, status);
    res.json({ success: true, data: goals });
  };

  public getActiveGoal = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const characterId = req.query['characterId'] ? String(req.query['characterId']) : undefined;
    const active = await this.goalService.getActiveGoal(userId, characterId);
    res.json({ success: true, data: active });
  };

  public createGoal = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const goal = await this.goalService.createGoal(userId, req.body);
    res.status(201).json({ success: true, data: goal });
  };

  public pauseGoal = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const goalId = String(req.params['goalId'] || '');
    const goal = await this.goalService.pauseGoal(goalId, userId);
    res.json({ success: true, data: goal });
  };

  public resumeGoal = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const goalId = String(req.params['goalId'] || '');
    const goal = await this.goalService.resumeGoal(goalId, userId);
    res.json({ success: true, data: goal });
  };

  public cancelGoal = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const goalId = String(req.params['goalId'] || '');
    const goal = await this.goalService.cancelGoal(goalId, userId);
    res.json({ success: true, data: goal });
  };

  // ---------------------------------------------------------------------------
  // Generation Explainability Handler
  // ---------------------------------------------------------------------------

  public explainGeneration = async (req: Request, res: Response): Promise<void> => {
    const messageId = String(req.params['messageId'] || '');
    // Admin router: any generation (admin session, AGENTS_READ). User router: own conversations only.
    const snapshot = req.admin
      ? await this.snapshotService.explainGeneration(messageId)
      : await this.snapshotService.explainGeneration(messageId, req.user!.userId);
    if (!snapshot) {
      res.status(404).json({ success: false, error: `Generation snapshot for message '${messageId}' not found.` });
      return;
    }
    res.json({ success: true, data: snapshot });
  };

  // ---------------------------------------------------------------------------
  // User Consent Handlers
  // ---------------------------------------------------------------------------

  public getConsents = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const consents = this.consentService.getUserConsents(userId);
    res.json({ success: true, data: consents });
  };

  public grantConsent = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const parsed = grantUserConsentSchema.parse(req.body);
    const consent = await this.consentService.grantConsent(
      userId,
      parsed.capabilitySlug,
      parsed.provider,
      parsed.scope,
      parsed.durationDays
    );
    res.status(201).json({ success: true, data: consent });
  };

  public revokeConsent = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const capabilitySlug = String(req.params['capabilitySlug'] || req.body.capabilitySlug || '');
    const revoked = await this.consentService.revokeConsent(userId, capabilitySlug);
    res.json({ success: true, data: { revoked } });
  };

  // ---------------------------------------------------------------------------
  // Multimodal Handlers
  // ---------------------------------------------------------------------------

  public uploadMultimodal = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const parsed = multimodalUploadMetadataSchema.parse(req.body);
    const attachment = await this.multimodalService.processUpload(
      userId,
      parsed.partType,
      parsed.mimeType,
      parsed.originalFilename,
      parsed.fileSizeBytes
    );
    res.status(201).json({ success: true, data: attachment });
  };

  // ---------------------------------------------------------------------------
  // Admin Handlers (Tools, Skills, Capabilities, Traces)
  // ---------------------------------------------------------------------------

  public adminListTools = async (_req: Request, res: Response): Promise<void> => {
    const tools = this.toolRegistry.listTools(false);
    res.json({ success: true, data: tools });
  };

  public adminRegisterTool = async (req: Request, res: Response): Promise<void> => {
    const parsed = toolRegistryItemSchema.parse(req.body);
    const item = this.toolRegistry.registerTool({
      ...parsed,
      id: `tool_${parsed.slug.replace(/\./g, '_')}`,
      status: (parsed as any).status || 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: item });
  };

  public adminListSkills = async (_req: Request, res: Response): Promise<void> => {
    await this.skillRegistry.initialize();
    const skills = this.skillRegistry.listSkills();
    res.json({ success: true, data: skills });
  };

  public adminRegisterSkill = async (req: Request, res: Response): Promise<void> => {
    const parsed = skillItemSchema.parse(req.body);
    const skill = await this.skillRegistry.registerSkill({
      ...parsed,
      id: `skill_${parsed.slug}`,
      status: 'published',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: skill });
  };

  public adminGetCharacterCapabilities = async (req: Request, res: Response): Promise<void> => {
    const characterId = String(req.params['characterId'] || '');
    const caps = this.capabilityService.getCharacterCapabilities(characterId);
    res.json({ success: true, data: caps });
  };

  public adminSetCharacterCapability = async (req: Request, res: Response): Promise<void> => {
    const characterId = String(req.params['characterId'] || '');
    const { capabilitySlug, isEnabled, permissionScope } = req.body;
    const cap = this.capabilityService.setCapability(characterId, capabilitySlug, isEnabled, permissionScope);
    res.json({ success: true, data: cap });
  };

  public adminListTraces = async (_req: Request, res: Response): Promise<void> => {
    const traces = this.traceService.listRecentTraces();
    res.json({ success: true, data: traces });
  };

  public adminGetTrace = async (req: Request, res: Response): Promise<void> => {
    const taskId = String(req.params['taskId'] || '');
    const trace = this.traceService.getTrace(taskId);
    if (!trace) {
      res.status(404).json({ success: false, error: `Trace for task '${taskId}' not found.` });
      return;
    }
    res.json({ success: true, data: trace });
  };
}
