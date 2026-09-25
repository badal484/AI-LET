import { describe, it, expect, beforeEach } from 'vitest';
import { AIPlaygroundService } from '../src/modules/ai/playground/AIPlayground.service.js';
import { ModelRegistryService } from '../src/modules/ai/routing/ModelRegistry.service.js';
import { AITelemetryService } from '../src/modules/ai/telemetry/AITelemetry.service.js';

describe('AI Playground & Production Replay', () => {
  let playground: AIPlaygroundService;
  let modelRegistry: ModelRegistryService;
  let telemetry: AITelemetryService;

  beforeEach(async () => {
    playground = AIPlaygroundService.getInstance();
    modelRegistry = ModelRegistryService.getInstance();
    telemetry = AITelemetryService.getInstance();
    await modelRegistry.seedDefaultModels();
  });

  it('runs interactive sandbox playground generation with context token breakdown', async () => {
    const model = await modelRegistry.getModelByName('mock', 'mock-fast-v1');
    expect(model).toBeDefined();

    const result = await playground.runPlayground({
      modelId: model!.id,
      userMessage: 'Test sandbox message',
      temperature: 0.7,
      maxTokens: 256,
      mockContext: {
        memories: ['User prefers brief answers'],
      },
    });

    expect(result.outputContent).toBeDefined();
    expect(result.modelUsed).toBe('mock-fast-v1');
    expect(result.contextHash).toBeDefined();
    expect(result.budgetBreakdown.categories.user_message).toBeGreaterThan(0);
    expect(result.budgetBreakdown.categories.memory).toBeGreaterThan(0);
    expect(result.validation.isValid).toBe(true);
  });

  it('re-runs a trace against its model/provider and reports honestly that the output is not reproducible', async () => {
    const traceRequestId = `req_test_${Date.now()}`;
    const model = await modelRegistry.getModelByName('mock', 'mock-fast-v1');

    await telemetry.recordTrace({
      requestId: traceRequestId,
      provider: 'mock',
      modelId: model!.id,
      workload: 'CONVERSATION',
      promptTokens: 40,
      completionTokens: 25,
      latencyMs: 120,
      isSuccess: true,
      contextHash: 'test_hash_123',
    });

    const replayRes = await playground.replayGeneration({
      traceId: traceRequestId,
    });

    expect(replayRes.requestId).toBe(traceRequestId);
    expect(replayRes.originalMetadata.provider).toBe('mock');
    // Prompt content is never retained, so the replay must not claim reproducibility.
    expect(replayRes.matchAssessment.isReproducible).toBe(false);
    expect(replayRes.matchAssessment.divergenceNotes).toMatch(/not retained/);
    expect(typeof replayRes.replayOutput).toBe('string');
  });
});
