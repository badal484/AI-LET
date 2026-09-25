import { prisma } from '../src/infrastructure/database/prisma.js';
import { describe, it, expect } from 'vitest';
import {
  PrivacyFilterService,
  PersonalizationEngine,
  ProductionFailureDatasetService,
  GenerationDebuggerService,
  CircuitBreakerService,
  MetricRegistryService,
  DataLineageService,
  IntelligenceOverviewService,
} from '../src/modules/intelligence/index.js';

describe('Phase 22 — Production Intelligence & AI Quality Systems', () => {
  const privacyFilter = PrivacyFilterService.getInstance();
  const personalization = PersonalizationEngine.getInstance();
  const failureDataset = ProductionFailureDatasetService.getInstance();
  const debuggerService = GenerationDebuggerService.getInstance();
  const circuitBreakers = CircuitBreakerService.getInstance();
  const metricRegistry = MetricRegistryService.getInstance();
  const dataLineage = DataLineageService.getInstance();
  const overviewService = IntelligenceOverviewService.getInstance();

  // ---------------------------------------------------------------------------
  // 1. PrivacyFilterService (PII & Secrets Redaction)
  // ---------------------------------------------------------------------------
  describe('PrivacyFilterService', () => {
    it('should detect and redact emails, phone numbers, cards, SSN, and secrets', () => {
      const sensitiveText =
        'Contact me at alex.user@example.com or +91 9876543210. Card: 4111-2222-3333-4444. SSN: 123-45-6789. API_KEY: sk-proj-1234567890abcdef.';

      const result = privacyFilter.sanitize(sensitiveText);

      expect(result.sanitizedText).toContain('[REDACTED_EMAIL]');
      expect(result.sanitizedText).toContain('[REDACTED_PHONE]');
      expect(result.sanitizedText).toContain('[REDACTED_PAYMENT_CARD]');
      expect(result.sanitizedText).toContain('[REDACTED_GOV_ID]');
      expect(result.sanitizedText).toContain('[REDACTED_SECRET]');
      expect(result.detectedPiiTypes).toContain('EMAIL');
      expect(result.detectedPiiTypes).toContain('PHONE_NUMBER');
      expect(result.detectedPiiTypes).toContain('CREDIT_CARD');
      expect(result.hasSecrets).toBe(true);
      expect(result.redactionCount).toBeGreaterThanOrEqual(5);
    });

    it('should preserve regular conversation without redacting clean text', () => {
      const cleanText = 'Hello Maya! I love astrophysics and stargazing in the mountains.';
      const result = privacyFilter.sanitize(cleanText);

      expect(result.sanitizedText).toBe(cleanText);
      expect(result.detectedPiiTypes.length).toBe(0);
      expect(result.hasSecrets).toBe(false);
      expect(result.redactionCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. PersonalizationEngine (Precedence Hierarchy & Preference Lifecycle)
  // ---------------------------------------------------------------------------
  describe('PersonalizationEngine', () => {
    const testUserId = 'test_user_personalization_001';

    it('should initialize and update explicit preferences with highest user authority', () => {
      const updated = personalization.updateExplicitPreferences(testUserId, {
        primaryLanguage: 'hinglish',
        responseLength: 'concise',
        interactionStyle: 'direct',
        topicsOfInterest: ['quantum computing', 'hiking'],
        customStyleNotes: 'Keep scientific analogies clear',
      });

      expect(updated.userId).toBe(testUserId);
      expect(updated.explicitPreferences.primaryLanguage).toBe('hinglish');
      expect(updated.explicitPreferences.responseLength).toBe('concise');
      expect(updated.explicitPreferences.interactionStyle).toBe('direct');
      expect(updated.explicitPreferences.topicsOfInterest).toContain('quantum computing');
    });

    it('should reinforce inferred preferences when confidence exceeds threshold (0.60)', () => {
      personalization.reinforceInferredPreference(
        testUserId,
        'preferred_evening_chats',
        'active between 8pm and 11pm',
        'behavioral_telemetry',
        0.85
      );

      const profile = personalization.getProfile(testUserId);
      const inferred = profile.inferredPreferences.find((p) => p.key === 'preferred_evening_chats');

      expect(inferred).toBeDefined();
      expect(inferred?.confidence).toBeGreaterThanOrEqual(0.8);
      expect(inferred?.value).toBe('active between 8pm and 11pm');
    });

    it('should ignore weak inferred signals below confidence threshold (0.60)', () => {
      personalization.reinforceInferredPreference(
        testUserId,
        'loves_heavy_metal',
        'listened once',
        'weak_signal',
        0.40
      );

      const profile = personalization.getProfile(testUserId);
      const inferred = profile.inferredPreferences.find((p) => p.key === 'loves_heavy_metal');
      expect(inferred).toBeUndefined();
    });

    it('should build structured prompt directives with strict character persona invariants', () => {
      const { directive, snapshot } = personalization.buildPromptDirective(
        testUserId,
        'Maya Lin',
        'Astrophysics Researcher & Companion'
      );

      expect(directive).toContain('### PERSONALIZATION DIRECTIVES');
      expect(directive).toContain('Your core persona as "Maya Lin"');
      expect(directive).toContain('ALWAYS supersede user style preferences');
      expect(directive).toContain('User prefers concise, direct responses');
      expect(directive).toContain('Preferred conversation language: hinglish');
      expect(snapshot.responseLength).toBe('concise');
      expect(snapshot.tokenBudgetUsed.personalization).toBeGreaterThan(0);
    });

    it('should reset inferred preferences cleanly without deleting explicit settings', () => {
      personalization.resetPersonalization(testUserId, 'inferred_only');
      const profile = personalization.getProfile(testUserId);

      expect(profile.inferredPreferences.length).toBe(0);
      expect(profile.explicitPreferences.primaryLanguage).toBe('hinglish');
    });

    it('should reset all preferences when full reset is requested', () => {
      personalization.resetPersonalization(testUserId, 'all');
      const profile = personalization.getProfile(testUserId);

      expect(profile.inferredPreferences.length).toBe(0);
      expect(profile.explicitPreferences.primaryLanguage).toBe('en');
      expect(profile.explicitPreferences.responseLength).toBe('balanced');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ProductionFailureDatasetService & Rubric Evaluation
  // ---------------------------------------------------------------------------
  describe('ProductionFailureDatasetService', () => {
    it('should add a failure case with automatic sanitization', () => {
      const created = failureDataset.addFailureCase({
        datasetVersion: 'evaluation_dataset_v1',
        category: 'hallucination',
        sanitizedInput: 'What did user alex@company.com say about the secret project?',
        expectedBehavior: 'State that no private details were shared.',
        observedBehavior: 'Claimed: The secret project code was [REDACTED_SECRET].',
        severity: 'P1',
        source: 'USER_REPORT',
        modelVersion: 'gpt-4o-mini',
        promptVersion: 'v1.0',
        characterVersion: 'v1.0',
      });

      expect(created.id).toBeDefined();
      expect(created.caseId).toMatch(/^case_/);
      expect(created.category).toBe('hallucination');
      expect(created.sanitizedInput).toContain('[REDACTED_EMAIL]');
      expect(created.isRegressionActive).toBe(true);
    });

    it('should compute weighted composite rubric score across 9 evaluation dimensions', () => {
      const cases = failureDataset.getActiveRegressionCases();
      const targetCase = cases[0]!;

      const evaluated = failureDataset.evaluateCase(targetCase.id, {
        relevance: 0.9,
        factuality: 0.85,
        instructionFollowing: 0.95,
        characterConsistency: 0.9,
        emotionalAppropriateness: 0.85,
        memoryCorrectness: 0.8,
        conversationalNaturalness: 0.9,
        safety: 1.0,
        languageQuality: 0.95,
      });

      expect(evaluated.rubricScores).toBeDefined();
      expect(evaluated.rubricScores?.compositeScore).toBeGreaterThanOrEqual(0.85);
      expect(evaluated.rubricScores?.compositeScore).toBeLessThanOrEqual(1.0);
      expect(evaluated.evaluatedAt).toBeDefined();
    });

    it('should return dataset summary with category and severity breakdowns', () => {
      const summary = failureDataset.getSummary();

      expect(summary.totalCases).toBeGreaterThanOrEqual(4);
      expect(summary.activeRegressionCount).toBeGreaterThanOrEqual(4);
      expect(summary.byCategory['hallucination']).toBeGreaterThanOrEqual(1);
      expect(summary.bySeverity['P0']).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. GenerationDebuggerService & Safe Replays
  // ---------------------------------------------------------------------------
  describe('GenerationDebuggerService', () => {
    const snapshotFixture = (generationId: string) => ({
      generationId,
      requestId: `req_${generationId}`,
      conversationId: 'conv_test',
      userId: 'user_test',
      characterId: 'char_test',
      characterVersionId: 'char_ver_test',
      model: 'gpt-4o-mini',
      provider: 'openai',
      promptVersion: 'system_prompt_v1.4',
      latencyMs: 340,
      ttftMs: 145,
      promptTokens: 820,
      completionTokens: 145,
      contextAttribution: {
        memoryIds: ['mem_fact_001'],
        relationshipSummary: 'Contact me at jane.doe@example.com or +1 555 123 4567',
        promptTokensByComponent: { characterIdentity: 280 },
      },
      createdAt: new Date().toISOString(),
    });

    it('records sanitized snapshots and retrieves them by generation or request id', () => {
      const id = `gen_test_${Date.now()}`;
      debuggerService.recordSnapshot(snapshotFixture(id) as never);

      const byGen = debuggerService.getSnapshot(id);
      expect(byGen?.model).toBe('gpt-4o-mini');
      expect(byGen?.contextAttribution.memoryIds).toContain('mem_fact_001');
      expect(byGen?.contextAttribution.relationshipSummary).not.toContain('jane.doe@example.com');
      expect(debuggerService.getSnapshot(`req_${id}`)?.generationId).toBe(id);
      // No fabricated baseline data is present.
      expect(debuggerService.getSnapshot('gen_prod_demo_001')).toBeNull();
    });

    it('refuses context replay instead of fabricating an output or score', async () => {
      const id = `gen_replay_${Date.now()}`;
      debuggerService.recordSnapshot(snapshotFixture(id) as never);
      await expect(debuggerService.replayGeneration({ generationId: id, targetModel: 'claude-3-5-sonnet' })).rejects.toMatchObject({
        statusCode: 501,
      });
      await expect(debuggerService.replayGeneration({ generationId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. CircuitBreakerService (Cost, Quality & Safety Guardrails)
  // ---------------------------------------------------------------------------
  describe('CircuitBreakerService', () => {
    it('should initialize and return default circuit breakers', () => {
      const statuses = circuitBreakers.getStatuses();
      const costBreaker = statuses.find((s) => s.name === 'AI_COST_CIRCUIT_BREAKER');
      const qualityBreaker = statuses.find((s) => s.name === 'AI_QUALITY_CIRCUIT_BREAKER');
      const safetyBreaker = statuses.find((s) => s.name === 'SAFETY_REGRESSION_CIRCUIT_BREAKER');

      expect(costBreaker).toBeDefined();
      expect(qualityBreaker).toBeDefined();
      expect(safetyBreaker).toBeDefined();
      expect(costBreaker?.isTripped).toBe(false);
    });

    it('should support audited manual override of circuit breaker', () => {
      const updated = circuitBreakers.updateStatus({
        name: 'AI_COST_CIRCUIT_BREAKER',
        isTripped: true,
        reason: 'Emergency drill testing cost circuit degradation',
      });

      expect(updated.isTripped).toBe(true);
      expect(updated.trippedAt).toBeDefined();

      // Reset back for operational readiness
      circuitBreakers.updateStatus({
        name: 'AI_COST_CIRCUIT_BREAKER',
        isTripped: false,
        reason: 'Drill completed successfully',
      });
      expect(circuitBreakers.isTripped('AI_COST_CIRCUIT_BREAKER')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. MetricRegistryService & DataLineageService
  // ---------------------------------------------------------------------------
  describe('MetricRegistryService & DataLineageService', () => {
    it('should provide standardized definitions for all core product and AI metrics', () => {
      const allMetrics = metricRegistry.getAllMetrics();
      const northStar = metricRegistry.getMetricById('metric_north_star');
      const memoryPrecision = metricRegistry.getMetricById('metric_memory_precision');
      const unitEcon = metricRegistry.getMetricById('metric_ai_cost_per_dau');

      expect(allMetrics.length).toBeGreaterThanOrEqual(6);
      expect(northStar?.category).toBe('NORTH_STAR');
      expect(memoryPrecision?.category).toBe('AI_QUALITY');
      expect(unitEcon?.category).toBe('MONETIZATION');
    });

    it('should map end-to-end data lineage from client events to database tables and rollups', () => {
      const lineage = dataLineage.getAllLineage();
      const chatLineage = lineage.find((l) => l.eventName === 'message.completed');
      const memoryLineage = lineage.find((l) => l.eventName === 'memory.extracted');

      expect(lineage.length).toBeGreaterThanOrEqual(5);
      expect(chatLineage?.primaryTable).toContain('ChatMessage');
      expect(memoryLineage?.producer).toBe('AI_WORKER');
      expect(chatLineage?.piiSensitivity).toBe('REDACTED');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. IntelligenceOverviewService
  // ---------------------------------------------------------------------------
  describe('IntelligenceOverviewService', () => {
    it('computes the summary from real traces rather than constants', async () => {
      const before = await overviewService.getOverview();
      const model = await prisma.aIModel.findFirst({ where: { isEnabled: true } });
      await prisma.aIGenerationTrace.create({
        data: {
          requestId: `req_overview_${Date.now()}`,
          provider: 'mock',
          modelId: model?.id ?? null,
          workload: 'CONVERSATION',
          promptTokens: 700,
          completionTokens: 300,
          totalTokens: 1000,
          costUsd: 0.25,
          latencyMs: 420,
          status: 'SUCCESS',
        },
      });
      const after = await overviewService.getOverview();

      expect(after.dailyTokens - before.dailyTokens).toBe(1000);
      expect(after.dailyCostUsd - before.dailyCostUsd).toBeCloseTo(0.25, 4);
      expect(after.p95LatencyMs).not.toBeNull();
      // Not measured by any pipeline yet, so reported as unknown instead of an invented 0.94.
      expect(after.memoryPrecision).toBeNull();
      expect(after.totalRegressionCases).toBeGreaterThanOrEqual(4);
    });
  });
});
