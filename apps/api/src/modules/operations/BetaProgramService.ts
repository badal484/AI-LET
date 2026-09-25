import crypto from 'node:crypto';
import {
  BetaCohortType,
  BetaInvitationItem,
  BetaInvitationCreateInput,
  BetaRedeemResult,
} from '@ai-companion/types';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';

export class BetaProgramService {
  private static instance: BetaProgramService;
  private invitations: Map<string, BetaInvitationItem> = new Map();
  private userCohorts: Map<string, BetaCohortType> = new Map();

  private constructor() {
    this.seedBetaData();
  }

  public static getInstance(): BetaProgramService {
    if (!BetaProgramService.instance) {
      BetaProgramService.instance = new BetaProgramService();
    }
    return BetaProgramService.instance;
  }

  private seedBetaData(): void {
    const seedInvites: BetaInvitationItem[] = [
      {
        id: 'beta-inv-001',
        code: 'ALPHA-CORE-2026',
        cohort: 'INTERNAL',
        status: 'ACTIVE',
        maxRedemptions: 100,
        redemptionCount: 12,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'beta-inv-002',
        code: 'CREATOR-VIP-EARLY',
        cohort: 'CREATOR_BETA',
        status: 'ACTIVE',
        maxRedemptions: 50,
        redemptionCount: 5,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'beta-inv-003',
        code: 'COMPANION-PREMIUM-PREVIEW',
        cohort: 'PREMIUM_BETA',
        status: 'ACTIVE',
        maxRedemptions: 200,
        redemptionCount: 24,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const inv of seedInvites) {
      this.invitations.set(inv.code.toUpperCase(), inv);
    }
  }

  public async createInvitation(
    creatorAdminId: string,
    input: BetaInvitationCreateInput,
  ): Promise<BetaInvitationItem> {
    const code = (input.code || `BETA-${crypto.randomUUID().substring(0, 8)}`).toUpperCase().trim();
    if (this.invitations.has(code)) {
      throw new ConflictError(`Invitation code ${code} already exists`);
    }

    const invitation: BetaInvitationItem = {
      id: `inv-${crypto.randomUUID().substring(0, 8)}`,
      code,
      cohort: input.cohort,
      creatorUserId: creatorAdminId,
      recipientEmail: input.recipientEmail?.toLowerCase() || null,
      status: 'ACTIVE',
      maxRedemptions: input.maxRedemptions || 1,
      redemptionCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt || null,
    };

    this.invitations.set(code, invitation);
    logger.info('[BetaProgramService] Invitation created', { code, cohort: input.cohort, creatorAdminId });
    return invitation;
  }

  public async listInvitations(): Promise<BetaInvitationItem[]> {
    return Array.from(this.invitations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  public async redeemCode(userId: string, rawCode: string): Promise<BetaRedeemResult> {
    const code = rawCode.toUpperCase().trim();
    const invitation = this.invitations.get(code);

    if (!invitation) {
      throw new NotFoundError('Invalid beta invitation code');
    }

    if (invitation.status !== 'ACTIVE') {
      throw new ConflictError(`This beta code is ${invitation.status.toLowerCase()}`);
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
      invitation.status = 'EXPIRED';
      throw new ValidationError('This beta invitation code has expired');
    }

    if (invitation.redemptionCount >= invitation.maxRedemptions) {
      invitation.status = 'REDEEMED';
      throw new ConflictError('This beta code has reached its maximum redemptions');
    }

    // Idempotent assignment
    const existingCohort = this.userCohorts.get(userId);
    if (existingCohort === invitation.cohort) {
      return {
        success: true,
        cohort: invitation.cohort,
        message: 'You are already enrolled in this beta cohort',
        featuresUnlocked: this.getUnlockedFeatures(invitation.cohort),
      };
    }

    invitation.redemptionCount += 1;
    if (invitation.redemptionCount >= invitation.maxRedemptions) {
      invitation.status = 'REDEEMED';
      invitation.redeemedAt = new Date().toISOString();
      invitation.redeemedByUserId = userId;
    }

    this.userCohorts.set(userId, invitation.cohort);
    logger.info('[BetaProgramService] Code redeemed successfully', { userId, code, cohort: invitation.cohort });

    return {
      success: true,
      cohort: invitation.cohort,
      message: `Welcome to the ${invitation.cohort} Beta program!`,
      featuresUnlocked: this.getUnlockedFeatures(invitation.cohort),
    };
  }

  public getUserCohort(userId: string): BetaCohortType | null {
    return this.userCohorts.get(userId) || null;
  }

  private getUnlockedFeatures(cohort: BetaCohortType): string[] {
    switch (cohort) {
      case 'INTERNAL':
        return [
          'experimental_models',
          'advanced_voice_latency_hud',
          'debug_traces',
          'unlimited_test_credits',
          'creator_studio_pro',
        ];
      case 'CREATOR_BETA':
        return ['character_studio_v2', 'voice_cloning_preview', 'creator_analytics_deep_dive'];
      case 'PREMIUM_BETA':
        return ['ultra_hd_voice', 'unlimited_memory', 'priority_inference_queue'];
      default:
        return ['early_access_characters', 'beta_feedback_channel'];
    }
  }
}
