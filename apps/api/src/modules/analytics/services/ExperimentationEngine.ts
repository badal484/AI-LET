import { createHash } from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import type {
  ExperimentItem,
  ExperimentCreateInput,
  ExperimentUpdateInput,
  ExperimentAnalysisResult,
  ExperimentVariantAnalysis,
} from '@ai-companion/types';

export class ExperimentationEngine {
  /**
   * Deterministic hashing function using SHA-256 for stable user variant assignment.
   * Produces an integer in [0, 99].
   */
  public static hashBucket(subjectId: string, experimentId: string): number {
    const hash = createHash('sha256').update(`${subjectId}:${experimentId}`).digest('hex');
    const sub = hash.substring(0, 8);
    const intVal = parseInt(sub, 16);
    return intVal % 100;
  }

  /**
   * Evaluates targeting rules against user context.
   */
  public static matchesTargeting(targeting: any, userContext?: Record<string, unknown>): boolean {
    if (!targeting || Object.keys(targeting).length === 0) return true;
    if (!userContext) return true;

    if (targeting.platform && Array.isArray(targeting.platform)) {
      if (userContext['platform'] && !targeting.platform.includes(userContext['platform'])) {
        return false;
      }
    }

    if (targeting.subscription && Array.isArray(targeting.subscription)) {
      if (userContext['subscription'] && !targeting.subscription.includes(userContext['subscription'])) {
        return false;
      }
    }

    if (targeting.languages && Array.isArray(targeting.languages)) {
      if (userContext['language'] && !targeting.languages.includes(userContext['language'])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Retrieves or assigns a deterministic variant for a subject in an active experiment.
   */
  public static async getOrAssignVariant(
    experimentId: string,
    subjectId: string,
    userContext?: Record<string, unknown>,
  ): Promise<{ variantKey: string; configuration: Record<string, unknown> | null } | null> {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { variants: true },
    });

    if (!experiment || experiment.status !== 'RUNNING') {
      return null;
    }

    // Check existing assignment
    const existing = await prisma.experimentAssignment.findUnique({
      where: {
        experimentId_subjectId: {
          experimentId,
          subjectId,
        },
      },
    });

    if (existing) {
      const assignedVariant = experiment.variants.find(v => v.key === existing.variantKey);
      return {
        variantKey: existing.variantKey,
        configuration: (assignedVariant?.configuration as Record<string, unknown>) || null,
      };
    }

    // Check targeting
    if (!this.matchesTargeting(experiment.targeting, userContext)) {
      return null;
    }

    // Check traffic allocation
    const bucket = this.hashBucket(subjectId, experimentId);
    if (bucket >= experiment.allocation) {
      // Subject falls outside allocated traffic percent
      return null;
    }

    // Determine variant based on cumulative allocation percentage
    let cumulative = 0;
    // Map bucket [0, allocation - 1] to [0, 99] for variant distribution
    const normalizedBucket = Math.floor((bucket / Math.max(experiment.allocation, 1)) * 100);

    let chosenVariant = experiment.variants[0];
    for (const v of experiment.variants) {
      cumulative += v.allocationPercentage;
      if (normalizedBucket < cumulative) {
        chosenVariant = v;
        break;
      }
    }

    if (!chosenVariant) {
      return null;
    }

    // Persist assignment
    try {
      await prisma.experimentAssignment.create({
        data: {
          experimentId,
          subjectId,
          variantKey: chosenVariant.key,
        },
      });
    } catch {
      // Handled if concurrent request created assignment
      logger.debug('Concurrent assignment insert handled', { experimentId, subjectId });
    }

    return {
      variantKey: chosenVariant.key,
      configuration: (chosenVariant.configuration as Record<string, unknown>) || null,
    };
  }

  /**
   * Records that a subject was actually exposed to the experiment.
   */
  public static async recordExposure(
    experimentId: string,
    subjectId: string,
    variantKey: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await prisma.experimentExposure.upsert({
        where: {
          experimentId_subjectId: {
            experimentId,
            subjectId,
          },
        },
        create: {
          experimentId,
          subjectId,
          variantKey,
          context: (context as any) || null,
        },
        update: {},
      });
    } catch (err) {
      logger.error('Failed to record experiment exposure', { err, experimentId, subjectId });
    }
  }

  /**
   * Statistical analysis of an experiment calculating conversion, uplift, Z-score, and p-value.
   */
  public static async analyzeExperiment(experimentId: string): Promise<ExperimentAnalysisResult> {
    const experiment = await prisma.experiment.findUnique({
      where: { id: experimentId },
      include: {
        variants: true,
        assignments: true,
        exposures: true,
      },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const assignmentsByVariant: Record<string, number> = {};
    const exposuresByVariant: Record<string, number> = {};
    const exposedSubjectIdsByVariant: Record<string, string[]> = {};

    for (const v of experiment.variants) {
      assignmentsByVariant[v.key] = 0;
      exposuresByVariant[v.key] = 0;
      exposedSubjectIdsByVariant[v.key] = [];
    }

    for (const a of experiment.assignments) {
      if (assignmentsByVariant[a.variantKey] !== undefined) {
        assignmentsByVariant[a.variantKey] = (assignmentsByVariant[a.variantKey] || 0) + 1;
      }
    }

    for (const exp of experiment.exposures) {
      if (exposuresByVariant[exp.variantKey] !== undefined) {
        exposuresByVariant[exp.variantKey] = (exposuresByVariant[exp.variantKey] || 0) + 1;
        exposedSubjectIdsByVariant[exp.variantKey]?.push(exp.subjectId);
      }
    }

    // Query primary metric events for exposed subjects
    const allExposedSubjects = experiment.exposures.map(e => e.subjectId);
    const convertedEvents = allExposedSubjects.length > 0
      ? await prisma.analyticsEvent.findMany({
          where: {
            eventName: experiment.primaryMetric,
            userId: { in: allExposedSubjects },
          },
          select: { userId: true },
        })
      : [];

    const convertedUserSet = new Set(convertedEvents.map(e => e.userId));

    // Control variant baseline
    const controlVariant = experiment.variants.find(v => v.key === 'control') || experiment.variants[0]!;
    const controlExposed = exposuresByVariant[controlVariant.key] || 0;
    const controlConversions = exposedSubjectIdsByVariant[controlVariant.key]?.filter(id => convertedUserSet.has(id)).length || 0;
    const controlRate = controlExposed > 0 ? controlConversions / controlExposed : 0;

    const variantAnalyses: ExperimentVariantAnalysis[] = [];

    for (const variant of experiment.variants) {
      const assigned = assignmentsByVariant[variant.key] || 0;
      const exposed = exposuresByVariant[variant.key] || 0;
      const converted = exposedSubjectIdsByVariant[variant.key]?.filter(id => convertedUserSet.has(id)).length || 0;
      const rate = exposed > 0 ? converted / exposed : 0;

      let uplift = 0;
      let zScore = 0;
      let pValue = 1.0;
      let isSignificant = false;
      let ciLower = rate;
      let ciUpper = rate;

      if (exposed > 0) {
        // Standard error for 95% CI
        const se = Math.sqrt((rate * (1 - rate)) / exposed);
        ciLower = Math.max(0, rate - 1.96 * se);
        ciUpper = Math.min(1, rate + 1.96 * se);
      }

      if (variant.key !== controlVariant.key && controlExposed > 0 && exposed > 0) {
        uplift = controlRate > 0 ? ((rate - controlRate) / controlRate) * 100 : 0;

        // Pooled two-proportion Z-test
        const pooledP = (controlConversions + converted) / (controlExposed + exposed);
        const sePooled = Math.sqrt(pooledP * (1 - pooledP) * (1 / controlExposed + 1 / exposed));
        zScore = sePooled > 0 ? (rate - controlRate) / sePooled : 0;

        // Two-tailed p-value approximation from Z
        const absZ = Math.abs(zScore);
        pValue = Math.exp(-0.717 * absZ - 0.416 * absZ * absZ); // Standard standard normal CDF approx
        isSignificant = pValue < 0.05 && exposed >= 50;
      }

      variantAnalyses.push({
        variantKey: variant.key,
        assignedUsers: assigned,
        exposedUsers: exposed,
        primaryMetricValue: converted,
        primaryMetricRate: Number(rate.toFixed(4)),
        upliftVsControl: Number(uplift.toFixed(2)),
        zScore: Number(zScore.toFixed(3)),
        pValue: Number(pValue.toFixed(4)),
        confidenceInterval: [Number(ciLower.toFixed(4)), Number(ciUpper.toFixed(4))],
        isSignificant,
        guardrails: {},
      });
    }

    // Recommendation logic
    let recommendation: 'CONTINUE_RUNNING' | 'INCONCLUSIVE' | 'ROLLOUT_TREATMENT' | 'ROLLBACK' = 'CONTINUE_RUNNING';
    const totalExposed = experiment.exposures.length;

    if (totalExposed < 100) {
      recommendation = 'CONTINUE_RUNNING';
    } else {
      const bestTreatment = variantAnalyses.find(v => v.variantKey !== controlVariant.key && v.isSignificant && v.upliftVsControl > 0);
      const harmfulTreatment = variantAnalyses.find(v => v.variantKey !== controlVariant.key && v.isSignificant && v.upliftVsControl < -5);

      if (harmfulTreatment) {
        recommendation = 'ROLLBACK';
      } else if (bestTreatment) {
        recommendation = 'ROLLOUT_TREATMENT';
      } else {
        recommendation = 'INCONCLUSIVE';
      }
    }

    return {
      experimentId: experiment.id,
      status: experiment.status,
      totalSubjects: experiment.assignments.length,
      totalExposed,
      primaryMetric: experiment.primaryMetric,
      variants: variantAnalyses,
      recommendation,
    };
  }

  /**
   * Creates a new experiment with its variants.
   */
  public static async createExperiment(input: ExperimentCreateInput, adminId?: string): Promise<ExperimentItem> {
    const created = await prisma.experiment.create({
      data: {
        id: input.id,
        name: input.name,
        description: input.description,
        targeting: (input.targeting as any) || null,
        primaryMetric: input.primaryMetric,
        secondaryMetrics: (input.secondaryMetrics as any) || null,
        guardrailMetrics: (input.guardrailMetrics as any) || null,
        allocation: input.allocation ?? 100,
        createdByAdminId: adminId || null,
        variants: {
          create: input.variants.map(v => ({
            key: v.key,
            name: v.name,
            configuration: (v.configuration as any) || null,
            allocationPercentage: v.allocationPercentage,
          })),
        },
      },
      include: { variants: true },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      status: created.status as any,
      targeting: created.targeting as any,
      primaryMetric: created.primaryMetric,
      secondaryMetrics: created.secondaryMetrics as any,
      guardrailMetrics: created.guardrailMetrics as any,
      allocation: created.allocation,
      startAt: created.startAt?.toISOString() || null,
      endAt: created.endAt?.toISOString() || null,
      variants: created.variants.map(v => ({
        id: v.id,
        experimentId: v.experimentId,
        key: v.key,
        name: v.name,
        configuration: v.configuration as any,
        allocationPercentage: v.allocationPercentage,
      })),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an existing experiment.
   */
  public static async updateExperiment(id: string, input: ExperimentUpdateInput): Promise<ExperimentItem> {
    const updated = await prisma.experiment.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        targeting: (input.targeting as any) || undefined,
        allocation: input.allocation,
        startAt: input.startAt ? new Date(input.startAt) : undefined,
        endAt: input.endAt ? new Date(input.endAt) : undefined,
      },
      include: { variants: true },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      status: updated.status as any,
      targeting: updated.targeting as any,
      primaryMetric: updated.primaryMetric,
      secondaryMetrics: updated.secondaryMetrics as any,
      guardrailMetrics: updated.guardrailMetrics as any,
      allocation: updated.allocation,
      startAt: updated.startAt?.toISOString() || null,
      endAt: updated.endAt?.toISOString() || null,
      variants: updated.variants.map(v => ({
        id: v.id,
        experimentId: v.experimentId,
        key: v.key,
        name: v.name,
        configuration: v.configuration as any,
        allocationPercentage: v.allocationPercentage,
      })),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Lists all experiments.
   */
  public static async listExperiments(): Promise<ExperimentItem[]> {
    const list = await prisma.experiment.findMany({
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });

    return list.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      status: e.status as any,
      targeting: e.targeting as any,
      primaryMetric: e.primaryMetric,
      secondaryMetrics: e.secondaryMetrics as any,
      guardrailMetrics: e.guardrailMetrics as any,
      allocation: e.allocation,
      startAt: e.startAt?.toISOString() || null,
      endAt: e.endAt?.toISOString() || null,
      variants: e.variants.map(v => ({
        id: v.id,
        experimentId: v.experimentId,
        key: v.key,
        name: v.name,
        configuration: v.configuration as any,
        allocationPercentage: v.allocationPercentage,
      })),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  }
}
