import { describe, it, expect, beforeEach } from 'vitest';
import { AIGateway, AIGatewayError } from '../src/modules/ai/gateway/AIGateway.js';
import { MockAIProviderAdapter } from '../src/modules/ai/gateway/MockAIProviderAdapter.js';

describe('AI Gateway & Provider Abstraction', () => {
  let gateway: AIGateway;

  beforeEach(() => {
    gateway = AIGateway.getInstance();
  });

  it('generates text response with token accounting and latency', async () => {
    const response = await gateway.generate(
      {
        model: 'mock-fast-v1',
        messages: [{ role: 'user', content: 'Hello there!' }],
      },
      'mock'
    );

    expect(response.id).toBeDefined();
    expect(response.provider).toBe('mock');
    expect(response.content).toContain('Hello there!');
    expect(response.usage.promptTokens).toBeGreaterThan(0);
    expect(response.usage.completionTokens).toBeGreaterThan(0);
    expect(response.finishReason).toBe('stop');
  });

  it('streams response chunks and emits completed event', async () => {
    const events = [];
    for await (const evt of gateway.stream(
      {
        model: 'mock-fast-v1',
        messages: [{ role: 'user', content: 'Tell me a story' }],
      },
      'mock'
    )) {
      events.push(evt);
    }

    expect(events.length).toBeGreaterThan(2);
    expect(events[0].type).toBe('started');
    const deltas = events.filter((e) => e.type === 'delta');
    expect(deltas.length).toBeGreaterThan(0);
    const completed = events.find((e) => e.type === 'completed');
    expect(completed).toBeDefined();
  });

  it('generates deterministic embeddings', async () => {
    const response = await gateway.embed(
      {
        model: 'mock-embedding-v1',
        input: 'user likes coffee',
      },
      'mock'
    );

    expect(response.embeddings).toHaveLength(1);
    expect(response.embeddings[0]).toHaveLength(128);
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });

  it('correctly classifies provider failures into standardized taxonomy', () => {
    const timeoutErr = new Error('Request aborted due to timeout');
    expect(gateway.classifyError(timeoutErr)).toBe('timeout');

    const rateLimitErr = new Error('429 Too Many Requests: Rate limit exceeded');
    expect(gateway.classifyError(rateLimitErr)).toBe('rate_limit');

    const authErr = new Error('401 Unauthorized: Invalid API key');
    expect(gateway.classifyError(authErr)).toBe('authentication_error');

    const contextErr = new Error('maximum context length is 8192 tokens');
    expect(gateway.classifyError(contextErr)).toBe('context_overflow');

    const safetyErr = new Error('Content safety blocked by moderation policy');
    expect(gateway.classifyError(safetyErr)).toBe('content_block');
  });
});
