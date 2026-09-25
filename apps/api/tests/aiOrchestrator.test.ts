import { describe, it, expect } from 'vitest';
import { AIOrchestrator } from '../src/infrastructure/ai/AIOrchestrator.js';
import { MockAIProvider } from '../src/infrastructure/ai/MockAIProvider.js';

describe('AIOrchestrator Unit Tests', () => {
  it('retrieves mock provider and executes text generation', async () => {
    const provider = AIOrchestrator.getProvider('mock');
    expect(provider).toBeInstanceOf(MockAIProvider);

    const response = await AIOrchestrator.executeText('mock', 'gpt-4o-mini', [
      { role: 'user', content: 'What is your favorite book?' },
    ]);

    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(5);
    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.finishReason).toBe('stop');
  });

  it('streams response chunks incrementally using async iterator', async () => {
    const provider = AIOrchestrator.getProvider('mock');
    const chunks: string[] = [];

    for await (const chunk of provider.streamText('gpt-4o-mini', [
      { role: 'user', content: 'Hello' },
    ])) {
      if (chunk.delta) {
        chunks.push(chunk.delta);
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('Hello there!');
  });

  it('generates 1536-dimensional mock embedding vector', async () => {
    const provider = AIOrchestrator.getProvider('mock');
    const res = await provider.generateEmbedding(
      'text-embedding-3-small',
      'User loves hiking in the mountains',
    );

    expect(res.embedding).toHaveLength(1536);
    expect(typeof res.embedding[0]).toBe('number');
  });
});
