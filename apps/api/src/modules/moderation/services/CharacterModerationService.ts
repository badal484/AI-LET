import { prisma } from '../../../infrastructure/database/prisma.js';
import { ErrorCode } from '@ai-companion/config';
import {
  NotFoundError,
  ConflictError,
} from '../../../shared/errors/AppError.js';
import { AuditService } from '../../audit/audit.service.js';
import type {
  CharacterModerationQueueItem,
} from '@ai-companion/types';
import type {
  ModerationDecisionInput,
  CharacterReportCreateInput,
} from '@ai-companion/validation';

export class CharacterModerationService {
  /**
   * Retrieves characters/cases queued for moderation review with filter & pagination.
   */
  public static async listModerationQueue(params: {
    status?: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    page?: number;
    limit?: number;
  }): Promise<{ items: CharacterModerationQueueItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) {
      where.status = params.status;
    } else {
      where.status = { in: ['PENDING', 'IN_REVIEW'] };
    }

    if (params.riskLevel === 'HIGH') {
      where.riskScore = { gte: 70 };
    } else if (params.riskLevel === 'MEDIUM') {
      where.riskScore = { gte: 30, lt: 70 };
    } else if (params.riskLevel === 'LOW') {
      where.riskScore = { lt: 30 };
    }

    const [cases, total] = await Promise.all([
      prisma.moderationCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
        include: {
          character: {
            select: {
              id: true,
              slug: true,
              name: true,
              tagline: true,
              avatarUrl: true,
              category: true,
              sourceType: true,
              status: true,
            },
          },
          creatorProfile: {
            select: {
              id: true,
              username: true,
              displayName: true,
              verificationStatus: true,
            },
          },
          reports: {
            select: { id: true },
          },
        },
      }),
      prisma.moderationCase.count({ where }),
    ]);

    const items: CharacterModerationQueueItem[] = cases.map((c: any) => ({
      id: c.id,
      characterId: c.character?.id || c.characterId,
      character: {
        id: c.character?.id || c.characterId,
        slug: c.character?.slug || '',
        name: c.character?.name || 'Unknown',
        tagline: c.character?.tagline || '',
        avatarUrl: c.character?.avatarUrl || '',
        category: c.character?.category || 'General',
        sourceType: c.character?.sourceType || 'CREATOR',
      },
      characterVersionId: c.characterVersionId,
      creatorProfile: c.creatorProfile
        ? {
            id: c.creatorProfile.id,
            displayName: c.creatorProfile.displayName,
            username: c.creatorProfile.username,
            verificationStatus: c.creatorProfile.verificationStatus,
          }
        : null,
      source: c.source,
      status: c.status,
      riskScore: c.riskScore,
      automatedFlags: c.automatedFlags as any,
      decision: c.decision,
      rejectionReason: c.rejectionReason,
      changeRequestDetails: c.changeRequestDetails,
      moderatorNotes: c.moderatorNotes,
      reportsCount: c.reports?.length || 0,
      createdAt: c.createdAt.toISOString(),
    }));

    return { items, total };
  }

  /**
   * Retrieves full moderation case details including snapshot config, risk analysis, and report history.
   */
  public static async getModerationCaseDetail(caseId: string) {
    const moderationCase = await prisma.moderationCase.findUnique({
      where: { id: caseId },
      include: {
        character: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 3,
            },
          },
        },
        creatorProfile: true,
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!moderationCase) {
      throw new NotFoundError('Moderation case not found', ErrorCode.NOT_FOUND);
    }

    const version =
      moderationCase.character?.versions?.find((v: any) => v.id === moderationCase.characterVersionId) ||
      moderationCase.character?.versions?.[0];

    return {
      caseId: moderationCase.id,
      status: moderationCase.status,
      riskScore: moderationCase.riskScore,
      automatedFlags: moderationCase.automatedFlags,
      decision: moderationCase.decision,
      rejectionReasonCode: moderationCase.rejectionReason,
      internalNotes: moderationCase.moderatorNotes,
      character: moderationCase.character
        ? {
            id: moderationCase.character.id,
            name: moderationCase.character.name,
            slug: moderationCase.character.slug,
            tagline: moderationCase.character.tagline,
            avatarUrl: moderationCase.character.avatarUrl,
            category: moderationCase.character.category,
            status: moderationCase.character.status,
            moderationStatus: moderationCase.character.moderationStatus,
            rejectionReason: moderationCase.character.rejectionReason,
            changeRequestDetails: moderationCase.character.changeRequestDetails,
          }
        : null,
      creator: moderationCase.creatorProfile
        ? {
            id: moderationCase.creatorProfile.id,
            username: moderationCase.creatorProfile.username,
            displayName: moderationCase.creatorProfile.displayName,
            bio: moderationCase.creatorProfile.bio,
            status: moderationCase.creatorProfile.status,
            verificationStatus: moderationCase.creatorProfile.verificationStatus,
            publishedCharactersCount: moderationCase.creatorProfile.publishedCharactersCount,
          }
        : null,
      versionSnapshot: version
        ? {
            id: version.id,
            versionNumber: version.versionNumber,
            status: version.status,
            identity: version.identityData,
            personality: version.personalityData,
            communication: version.communicationData,
            language: version.languageData,
            behaviorRules: version.behaviorRulesData,
            knowledge: version.knowledgeData,
            safety: version.safetyConfigData,
            relationship: version.relationshipConfigData,
          }
        : null,
      reports: moderationCase.reports.map((r: any) => ({
        id: r.id,
        reasonCode: r.reasonCode,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
      appeals: moderationCase.appeals.map((a: any) => ({
        id: a.id,
        characterId: a.characterId,
        appealReason: a.appealReason,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      })),
      createdAt: moderationCase.createdAt.toISOString(),
      updatedAt: moderationCase.updatedAt.toISOString(),
    };
  }

  /**
   * Applies an administrative moderation decision (APPROVE, REJECT, REQUEST_CHANGES, SUSPEND).
   */
  public static async reviewCharacter(
    moderatorId: string,
    caseId: string,
    input: ModerationDecisionInput,
  ): Promise<{ success: boolean; characterStatus: string; moderationStatus: string; status?: string }> {
    const moderationCase = await prisma.moderationCase.findUnique({
      where: { id: caseId },
      include: {
        character: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        },
        creatorProfile: true,
      },
    });

    if (!moderationCase || !moderationCase.character) {
      throw new NotFoundError('Moderation case or character not found', ErrorCode.NOT_FOUND);
    }

    const character = moderationCase.character;
    const targetVersionId = moderationCase.characterVersionId || character.versions[0]?.id;

    const moderatorUser = moderatorId
      ? await prisma.user.findUnique({ where: { id: moderatorId } })
      : null;
    const reviewedByAdminId = moderatorUser ? moderatorId : null;

    if (input.decision === 'APPROVE') {
      await prisma.$transaction(async (tx: any) => {
        if (targetVersionId) {
          await tx.characterVersion.update({
            where: { id: targetVersionId },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }

        await tx.character.update({
          where: { id: character.id },
          data: {
            status: 'PUBLISHED',
            moderationStatus: 'APPROVED',
            currentPublishedVersionId: targetVersionId,
            rejectionReason: null,
            changeRequestDetails: null,
            updatedAt: new Date(),
          },
        });

        if (moderationCase.creatorProfileId) {
          await tx.creatorProfile.update({
            where: { id: moderationCase.creatorProfileId },
            data: {
              publishedCharactersCount: { increment: 1 },
            },
          });
        }

        await tx.moderationCase.update({
          where: { id: caseId },
          data: {
            status: 'APPROVED',
            decision: 'APPROVE',
            reviewedByAdminId,
            moderatorNotes: input.moderatorNotes || null,
            reviewedAt: new Date(),
          },
        });
      });
    } else if (input.decision === 'REJECT') {
      await prisma.$transaction(async (tx: any) => {
        if (targetVersionId) {
          await tx.characterVersion.update({
            where: { id: targetVersionId },
            data: {
              status: 'DRAFT',
              updatedAt: new Date(),
            },
          });
        }

        await tx.character.update({
          where: { id: character.id },
          data: {
            status: 'DRAFT',
            moderationStatus: 'REJECTED',
            rejectionReason: input.rejectionReason || 'PROHIBITED_CONTENT',
            changeRequestDetails: input.changeRequestDetails || null,
            updatedAt: new Date(),
          },
        });

        await tx.moderationCase.update({
          where: { id: caseId },
          data: {
            status: 'REJECTED',
            decision: 'REJECT',
            rejectionReason: input.rejectionReason || 'PROHIBITED_CONTENT',
            reviewedByAdminId,
            moderatorNotes: input.moderatorNotes || null,
            reviewedAt: new Date(),
          },
        });
      });
    } else if (input.decision === 'REQUEST_CHANGES') {
      await prisma.$transaction(async (tx: any) => {
        if (targetVersionId) {
          await tx.characterVersion.update({
            where: { id: targetVersionId },
            data: {
              status: 'DRAFT',
              updatedAt: new Date(),
            },
          });
        }

        await tx.character.update({
          where: { id: character.id },
          data: {
            status: 'DRAFT',
            moderationStatus: 'CHANGES_REQUESTED',
            changeRequestDetails: input.changeRequestDetails || 'Please adjust character configuration',
            updatedAt: new Date(),
          },
        });

        await tx.moderationCase.update({
          where: { id: caseId },
          data: {
            status: 'CHANGES_REQUESTED',
            decision: 'REQUEST_CHANGES',
            reviewedByAdminId,
            moderatorNotes: input.moderatorNotes || null,
            reviewedAt: new Date(),
          },
        });
      });
    } else if (input.decision === 'SUSPEND') {
      await prisma.$transaction(async (tx: any) => {
        await tx.character.update({
          where: { id: character.id },
          data: {
            status: 'UNPUBLISHED',
            moderationStatus: 'SUSPENDED',
            rejectionReason: input.rejectionReason || 'SAFETY_CONFIGURATION',
            updatedAt: new Date(),
          },
        });

        await tx.moderationCase.update({
          where: { id: caseId },
          data: {
            status: 'SUSPENDED',
            decision: 'SUSPEND',
            rejectionReason: input.rejectionReason || 'SAFETY_CONFIGURATION',
            reviewedByAdminId,
            moderatorNotes: input.moderatorNotes || null,
            reviewedAt: new Date(),
          },
        });
      });
    }

    await AuditService.log({
      actorType: 'ADMIN',
      actorId: moderatorId,
      action: `CHARACTER_MODERATION_${input.decision}`,
      resourceType: 'CHARACTER',
      resourceId: character.id,
      metadata: {
        caseId,
        decision: input.decision,
        rejectionReason: input.rejectionReason,
      },
    });

    return {
      success: true,
      status: 'RESOLVED',
      characterStatus: input.decision === 'APPROVE' ? 'PUBLISHED' : input.decision === 'SUSPEND' ? 'SUSPENDED' : 'DRAFT',
      moderationStatus: input.decision === 'APPROVE' ? 'APPROVED' : input.decision === 'REJECT' ? 'REJECTED' : input.decision === 'REQUEST_CHANGES' ? 'CHANGES_REQUESTED' : 'SUSPENDED',
    };
  }

  /**
   * Alias for reviewCharacter to support reviewCase
   */
  public static async reviewCase(
    moderatorId: string,
    input: {
      caseId: string;
      decision: any;
      rejectionReason?: any;
      changeRequestDetails?: string;
      internalNotes?: string;
      moderatorNotes?: string;
    },
  ): Promise<any> {
    return this.reviewCharacter(moderatorId, input.caseId, {
      decision: input.decision,
      rejectionReason: input.rejectionReason,
      changeRequestDetails: input.changeRequestDetails,
      moderatorNotes: input.internalNotes || input.moderatorNotes,
    });
  }

  /**
   * Submits a user report against a character. Creates or links to an active ModerationCase.
   */
  public static async submitUserReport(
    reporterUserId: string,
    input: CharacterReportCreateInput,
  ): Promise<{ reportId: string; status: string; id: string; characterId: string; reasonCode: string; details: string }> {
    const character = await prisma.character.findFirst({
      where: { id: input.characterId, deletedAt: null },
      include: { creatorProfile: true },
    });

    if (!character) {
      throw new NotFoundError('Character not found', ErrorCode.NOT_FOUND);
    }

    let moderationCase = await prisma.moderationCase.findFirst({
      where: {
        characterId: character.id,
        status: { in: ['PENDING', 'IN_REVIEW'] },
      },
    });

    if (!moderationCase) {
      moderationCase = await prisma.moderationCase.create({
        data: {
          characterId: character.id,
          creatorProfileId: character.creatorProfileId || null,
          status: 'IN_REVIEW',
          riskScore: 40,
          automatedFlags: ['USER_REPORTED'],
        },
      });
    } else {
      await prisma.moderationCase.update({
        where: { id: moderationCase.id },
        data: {
          riskScore: { increment: 15 },
          status: 'IN_REVIEW',
          updatedAt: new Date(),
        },
      });
    }

    const report = await prisma.characterReport.create({
      data: {
        characterId: character.id,
        reporterUserId,
        moderationCaseId: moderationCase.id,
        reasonCode: input.reasonCode,
        details: input.details,
        status: 'PENDING',
      },
    });

    await AuditService.log({
      actorType: 'USER',
      actorId: reporterUserId,
      action: 'CHARACTER_REPORTED',
      resourceType: 'CHARACTER',
      resourceId: character.id,
      metadata: { reasonCode: input.reasonCode, reportId: report.id },
    });

    return {
      id: report.id,
      reportId: report.id,
      characterId: input.characterId,
      reasonCode: input.reasonCode,
      details: input.details,
      status: 'SUBMITTED',
    };
  }

  /**
   * Alias for reportCharacter
   */
  public static async reportCharacter(
    reporterUserId: string,
    input: CharacterReportCreateInput,
  ): Promise<any> {
    return this.submitUserReport(reporterUserId, input);
  }

  /**
   * Creator submits an appeal for a rejected or suspended character.
   */
  public static async submitAppeal(
    _userIdOrProfileId: string,
    inputOrCaseId: any,
    maybeInput?: any,
  ): Promise<any> {
    let caseId: string;
    let characterId: string | undefined;
    let appealReason: string;

    if (maybeInput) {
      caseId = inputOrCaseId;
      appealReason = maybeInput.appealReason || maybeInput.reason;
    } else {
      characterId = inputOrCaseId.characterId;
      appealReason = inputOrCaseId.reason || inputOrCaseId.appealReason;
      const modCase = await prisma.moderationCase.findFirst({
        where: { characterId },
        orderBy: { createdAt: 'desc' },
      });
      if (!modCase) {
        throw new NotFoundError('Moderation case not found', ErrorCode.NOT_FOUND);
      }
      caseId = modCase.id;
    }

    const moderationCase = await prisma.moderationCase.findUnique({
      where: { id: caseId },
      include: {
        character: true,
        creatorProfile: true,
      },
    });

    if (!moderationCase) {
      throw new NotFoundError('Moderation case not found', ErrorCode.NOT_FOUND);
    }

    const activeAppeal = await prisma.moderationAppeal.findFirst({
      where: {
        moderationCaseId: caseId,
        status: 'PENDING',
      },
    });

    if (activeAppeal) {
      throw new ConflictError('An active appeal is already pending review for this case', ErrorCode.CONFLICT);
    }

    const creatorProfileId = moderationCase.creatorProfileId || moderationCase.character.creatorProfileId;
    if (!creatorProfileId) {
      throw new ConflictError('Cannot submit appeal for character without creator profile', ErrorCode.BAD_REQUEST);
    }

    const appeal = await prisma.moderationAppeal.create({
      data: {
        moderationCaseId: caseId,
        characterId: moderationCase.characterId,
        creatorProfileId,
        appealReason,
        status: 'PENDING',
      },
    });

    await prisma.moderationCase.update({
      where: { id: caseId },
      data: { status: 'IN_REVIEW', updatedAt: new Date() },
    });

    return {
      id: appeal.id,
      moderationCaseId: appeal.moderationCaseId,
      characterId: appeal.characterId,
      characterName: moderationCase.character.name,
      creatorUsername: moderationCase.creatorProfile?.username || 'unknown',
      appealReason: appeal.appealReason,
      status: appeal.status,
      createdAt: appeal.createdAt.toISOString(),
    };
  }

  /**
   * Moderator reviews and decides on an appeal.
   */
  public static async reviewAppeal(
    moderatorId: string,
    appealId: string,
    decision: 'UPHELD' | 'OVERTURNED' | 'APPROVED' | 'REJECTED',
    notes?: string,
  ): Promise<any> {
    const appeal = await prisma.moderationAppeal.findUnique({
      where: { id: appealId },
      include: { moderationCase: true },
    });

    if (!appeal) {
      throw new NotFoundError('Appeal not found', ErrorCode.NOT_FOUND);
    }

    const isApproved = decision === 'APPROVED' || decision === 'OVERTURNED';

    const moderatorUser = moderatorId
      ? await prisma.user.findUnique({ where: { id: moderatorId } })
      : null;
    const reviewedByAdminId = moderatorUser ? moderatorId : null;

    await prisma.moderationAppeal.update({
      where: { id: appealId },
      data: {
        status: isApproved ? 'APPROVED' : 'REJECTED',
        reviewedByAdminId,
        reviewedAt: new Date(),
      },
    });

    if (isApproved) {
      await prisma.$transaction([
        prisma.moderationCase.update({
          where: { id: appeal.moderationCaseId },
          data: { status: 'APPROVED', decision: 'APPROVE', updatedAt: new Date() },
        }),
        prisma.character.update({
          where: { id: appeal.characterId },
          data: {
            status: 'PUBLISHED',
            moderationStatus: 'APPROVED',
            rejectionReason: null,
            updatedAt: new Date(),
          },
        }),
      ]);
    }

    await AuditService.log({
      actorType: 'ADMIN',
      actorId: moderatorId,
      action: `MODERATION_APPEAL_${decision}`,
      resourceType: 'MODERATION_CASE',
      resourceId: appeal.moderationCaseId,
      metadata: { appealId, decision, notes },
    });

    return {
      id: appealId,
      status: isApproved ? 'APPROVED' : 'REJECTED',
      success: true,
      decision,
    };
  }

  /**
   * Alias for reviewAppeal
   */
  public static async processAppeal(
    moderatorId: string,
    appealId: string,
    input: { status: any; reviewerNotes?: string },
  ): Promise<any> {
    return this.reviewAppeal(moderatorId, appealId, input.status, input.reviewerNotes);
  }
}
