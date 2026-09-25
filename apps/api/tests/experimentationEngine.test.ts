import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { ExperimentationEngine } from '../src/modules/analytics/services/ExperimentationEngine.js';
import { randomUUID } from 'crypto';

describe('ExperimentationEngine Tests', () => {
  beforeEach(async () => {
    await prisma.experimentExposure.deleteMany();
    await prisma.experimentAssignment.deleteMany();
    await prisma.experimentVariant.deleteMany();
    await prisma.experiment.deleteMany();
    await prisma.analyticsEvent.deleteMany();
  });

  it('produces deterministic hash buckets in range [0, 99]', () => {
    const expId = 'onboarding_prompt_v2';
    const userA = 'user_123';
    const userB = 'user_456';

    const bucketA1 = ExperimentationEngine.hashBucket(userA, expId);
    const bucketA2 = ExperimentationEngine.hashBucket(userA, expId);
    const bucketB = ExperimentationEngine.hashBucket(userB, expId);

    expect(bucketA1).toBe(bucketA2);
    expect(bucketA1).toBeGreaterThanOrEqual(0);
    expect(bucketA1).toBeLessThan(100);
    expect(bucketB).toBeGreaterThanOrEqual(0);
    expect(bucketB).toBeLessThan(100);
  });

  it('evaluates targeting rules correctly', () => {
    const targeting = {
      platform: ['ios', 'android'],
      subscription: ['pro', 'unlimited'],
    };

    expect(ExperimentationEngine.matchesTargeting(targeting, { platform: 'ios', subscription: 'pro' })).toBe(true);
    expect(ExperimentationEngine.matchesTargeting(targeting, { platform: 'web', subscription: 'pro' })).toBe(false);
    expect(ExperimentationEngine.matchesTargeting(targeting, { platform: 'ios', subscription: 'free' })).toBe(false);
    expect(ExperimentationEngine.matchesTargeting({}, { platform: 'web' })).toBe(true);
  });

  it('creates experiment, assigns stable variants, and logs exposures', async () => {
    const expId = `exp_${Date.now()}`;
    await ExperimentationEngine.createExperiment({
      id: expId,
      name: 'Hero CTA Test',
      description: 'Testing dynamic greeting CTA on home screen',
      primaryMetric: 'first_chat_started',
      allocation: 100,
      variants: [
        { key: 'control', name: 'Standard Prompt', allocationPercentage: 50, configuration: { promptStyle: 'default' } },
        { key: 'treatment_a', name: 'Curious Prompt', allocationPercentage: 50, configuration: { promptStyle: 'curious' } },
      ],
    });

    // Put experiment in RUNNING state
    await ExperimentationEngine.updateExperiment(expId, { status: 'RUNNING' });

    const subjectId = randomUUID();
    const assignment1 = await ExperimentationEngine.getOrAssignVariant(expId, subjectId);
    expect(assignment1).not.toBeNull();
    expect(['control', 'treatment_a']).toContain(assignment1?.variantKey);

    // Second call returns same assignment (idempotent / stable)
    const assignment2 = await ExperimentationEngine.getOrAssignVariant(expId, subjectId);
    expect(assignment2?.variantKey).toBe(assignment1?.variantKey);

    // Record exposure
    await ExperimentationEngine.recordExposure(expId, subjectId, assignment1!.variantKey, { screen: 'home' });

    const exposures = await prisma.experimentExposure.findMany({ where: { experimentId: expId } });
    expect(exposures.length).toBe(1);
    expect(exposures[0]?.variantKey).toBe(assignment1?.variantKey);
  });

  it('calculates statistical analysis with conversion rates, uplift, and z-score', async () => {
    const expId = `exp_stat_${Date.now()}`;
    await ExperimentationEngine.createExperiment({
      id: expId,
      name: 'Onboarding Flow Test',
      description: 'Streamlined 3-step onboarding vs 5-step',
      primaryMetric: 'activation_completed',
      allocation: 100,
      variants: [
        { key: 'control', name: '5 Steps', allocationPercentage: 50, configuration: {} },
        { key: 'treatment_fast', name: '3 Steps', allocationPercentage: 50, configuration: {} },
      ],
    });

    await ExperimentationEngine.updateExperiment(expId, { status: 'RUNNING' });

    // Seed 60 control subjects and 60 treatment subjects with exposures & conversion events
    const controlUsers: string[] = [];
    const treatmentUsers: string[] = [];

    for (let i = 0; i < 60; i++) {
      const uId = randomUUID();
      controlUsers.push(uId);
      await ExperimentationEngine.recordExposure(expId, uId, 'control');
      // 20% conversion for control (12 users)
      if (i < 12) {
        await prisma.analyticsEvent.create({
          data: {
            id: randomUUID(),
            eventName: 'activation_completed',
            userId: uId,
          },
        });
      }
    }

    for (let i = 0; i < 60; i++) {
      const uId = randomUUID();
      treatmentUsers.push(uId);
      await ExperimentationEngine.recordExposure(expId, uId, 'treatment_fast');
      // 50% conversion for treatment (30 users)
      if (i < 30) {
        await prisma.analyticsEvent.create({
          data: {
            id: randomUUID(),
            eventName: 'activation_completed',
            userId: uId,
          },
        });
      }
    }

    const analysis = await ExperimentationEngine.analyzeExperiment(expId);

    expect(analysis.totalExposed).toBe(120);
    expect(analysis.variants.length).toBe(2);

    const controlVariant = analysis.variants.find(v => v.variantKey === 'control');
    const treatVariant = analysis.variants.find(v => v.variantKey === 'treatment_fast');

    expect(controlVariant?.exposedUsers).toBe(60);
    expect(controlVariant?.primaryMetricValue).toBe(12);
    expect(controlVariant?.primaryMetricRate).toBe(0.2);

    expect(treatVariant?.exposedUsers).toBe(60);
    expect(treatVariant?.primaryMetricValue).toBe(30);
    expect(treatVariant?.primaryMetricRate).toBe(0.5);

    // Uplift = (0.5 - 0.2) / 0.2 * 100 = 150%
    expect(treatVariant?.upliftVsControl).toBe(150);
    expect(treatVariant?.zScore).toBeGreaterThan(2.0);
    expect(treatVariant?.isSignificant).toBe(true);
    expect(analysis.recommendation).toBe('ROLLOUT_TREATMENT');
  });
});
