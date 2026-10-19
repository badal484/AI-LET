import { describe, it, expect, beforeEach } from 'vitest';
import { AIGateway } from '../src/modules/ai/gateway/AIGateway.js';
import { GroqProviderAdapter } from '../src/modules/ai/gateway/GroqProviderAdapter.js';
import { chatAIRoutes, backgroundAIRoute } from '../src/modules/ai/routing/aiRoutes.js';

describe('Groq Provider & Automatic Fallback', () => {
  let gateway: AIGateway;

  beforeEach(() => {
    gateway = AIGateway.getInstance();
  });

  it('has GroqProviderAdapter registered in AIGateway', () => {
    const adapter = gateway.getAdapter('groq');
    expect(adapter).toBeDefined();
    expect(adapter.providerName).toBe('groq');
    expect(adapter).toBeInstanceOf(GroqProviderAdapter);
  });

  it('resolves chatAIRoutes with Groq as fallback when primary is google', () => {
    const originalProvider = process.env['CHAT_PROVIDER'];
    const originalGoogle = process.env['GOOGLE_AI_API_KEY'];
    const originalGroq = process.env['GROQ_API_KEY'];
    const originalMistral = process.env['MISTRAL_API_KEY'];

    try {
      process.env['CHAT_PROVIDER'] = 'google';
      process.env['GOOGLE_AI_API_KEY'] = 'test-google-key';
      process.env['GROQ_API_KEY'] = 'gsk_test';
      delete process.env['MISTRAL_API_KEY'];

      const routes = chatAIRoutes();
      expect(routes.length).toBeGreaterThanOrEqual(2);
      expect(routes[0]?.provider).toBe('google');
      expect(routes[1]?.provider).toBe('groq');
    } finally {
      process.env['CHAT_PROVIDER'] = originalProvider;
      process.env['GOOGLE_AI_API_KEY'] = originalGoogle;
      process.env['GROQ_API_KEY'] = originalGroq;
      if (originalMistral) process.env['MISTRAL_API_KEY'] = originalMistral;
    }
  });

  it('resolves chatAIRoutes with Groq as primary when CHAT_PROVIDER=groq', () => {
    const originalProvider = process.env['CHAT_PROVIDER'];
    const originalGoogle = process.env['GOOGLE_AI_API_KEY'];
    const originalGroq = process.env['GROQ_API_KEY'];

    try {
      process.env['CHAT_PROVIDER'] = 'groq';
      process.env['GOOGLE_AI_API_KEY'] = 'test-google-key';
      process.env['GROQ_API_KEY'] = 'gsk_test';

      const routes = chatAIRoutes();
      expect(routes[0]?.provider).toBe('groq');
      expect(routes[1]?.provider).toBe('google');
    } finally {
      process.env['CHAT_PROVIDER'] = originalProvider;
      process.env['GOOGLE_AI_API_KEY'] = originalGoogle;
      process.env['GROQ_API_KEY'] = originalGroq;
    }
  });

  it('resolves backgroundAIRoute to Groq when other keys are absent', () => {
    const originalGoogle = process.env['GOOGLE_AI_API_KEY'];
    const originalGemini = process.env['GEMINI_API_KEY'];
    const originalMistral = process.env['MISTRAL_API_KEY'];
    const originalGroq = process.env['GROQ_API_KEY'];

    try {
      delete process.env['GOOGLE_AI_API_KEY'];
      delete process.env['GEMINI_API_KEY'];
      delete process.env['MISTRAL_API_KEY'];
      process.env['GROQ_API_KEY'] = 'gsk_test';

      const route = backgroundAIRoute();
      expect(route.provider).toBe('groq');
    } finally {
      if (originalGoogle) process.env['GOOGLE_AI_API_KEY'] = originalGoogle;
      if (originalGemini) process.env['GEMINI_API_KEY'] = originalGemini;
      if (originalMistral) process.env['MISTRAL_API_KEY'] = originalMistral;
      if (originalGroq) process.env['GROQ_API_KEY'] = originalGroq;
    }
  });

  it('generates text using Groq when API key is provided', async () => {
    const apiKey = process.env['GROQ_API_KEY'];
    if (!apiKey || apiKey.startsWith('mock')) {
      // Test mock fallback behavior
      const res = await gateway.generate(
        {
          model: 'qwen/qwen3.8-27b',
          messages: [{ role: 'user', content: 'hello' }],
        },
        'groq'
      );
      expect(res.content).toBeDefined();
      expect(res.provider).toBe('groq');
      return;
    }

    const res = await gateway.generate(
      {
        model: 'qwen/qwen3.8-27b',
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
      },
      'groq'
    );

    expect(res.provider).toBe('groq');
    expect(res.content.length).toBeGreaterThan(0);
    expect(res.usage.totalTokens).toBeGreaterThan(0);
  }, 15000);

  it('streams text chunks using Groq when API key is provided', async () => {
    const events = [];
    for await (const evt of gateway.stream(
      {
        model: 'qwen/qwen3.8-27b',
        messages: [{ role: 'user', content: 'Say hello in 2 words' }],
      },
      'groq'
    )) {
      events.push(evt);
    }

    expect(events.length).toBeGreaterThan(1);
    expect(events[0]?.type).toBe('started');
    const deltas = events.filter((e) => e.type === 'delta');
    expect(deltas.length).toBeGreaterThan(0);
    const completed = events.find((e) => e.type === 'completed');
    expect(completed).toBeDefined();
  }, 15000);
});
