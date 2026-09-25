import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouterService } from '../src/modules/ai/routing/ModelRouter.service.js';
import { CircuitBreakerService } from '../src/modules/ai/routing/CircuitBreaker.service.js';
import { ModelRegistryService } from '../src/modules/ai/routing/ModelRegistry.service.js';

describe('Model Router & Circuit Breaker', () => {
  let router: ModelRouterService;
  let circuitBreaker: CircuitBreakerService;
  let registry: ModelRegistryService;

  beforeEach(async () => {
    router = ModelRouterService.getInstance();
    circuitBreaker = CircuitBreakerService.getInstance();
    registry = ModelRegistryService.getInstance();
    await registry.seedDefaultModels();
  });

  it('selects embedding model for EMBEDDING workload', async () => {
    const route = await router.selectRoute('EMBEDDING');
    expect(route.primaryModel).toBeDefined();
    expect(route.primaryModel.capabilities).toContain('embeddings');
  });

  it('selects fast structured model for MEMORY_EXTRACTION workload', async () => {
    const route = await router.selectRoute('MEMORY_EXTRACTION');
    expect(route.primaryModel).toBeDefined();
    expect(route.primaryModel.latencyClass).toBe('fast');
  });

  it('selects quality model for EVALUATION workload', async () => {
    const route = await router.selectRoute('EVALUATION');
    expect(route.primaryModel).toBeDefined();
    expect(['flagship', 'premium', 'standard']).toContain(route.primaryModel.qualityClass);
  });

  it('trips circuit breaker on repeated failures and reroutes to fallback model', async () => {
    const provider = 'mock';
    const model = 'mock-fast-v1';

    // Trip circuit breaker by recording failures
    for (let i = 0; i < 6; i++) {
      await circuitBreaker.recordFailure(provider, model);
    }

    const status = await circuitBreaker.getStatus(provider, model);
    expect(status).toBe('OPEN');

    // Route selection should reroute to alternative healthy fallback
    const route = await router.selectRoute('CONVERSATION');
    expect(route.primaryModel.modelName).not.toBe(model);
    expect(route.reason).toContain('circuit OPEN');

    // Reset circuit breaker
    await circuitBreaker.reset(provider, model);
    const resetStatus = await circuitBreaker.getStatus(provider, model);
    expect(resetStatus).toBe('CLOSED');
  });

  it('executes generation with automatic fallback execution', async () => {
    const response = await router.executeWithFallback('CONVERSATION', (m) => ({
      model: m.modelName,
      messages: [{ role: 'user', content: 'Testing router execution' }],
    }));

    expect(response.content).toBeDefined();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });
});
