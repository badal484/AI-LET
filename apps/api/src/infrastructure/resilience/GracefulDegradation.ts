import { CircuitBreaker } from './CircuitBreaker.js';
import { logger } from '../../config/logger.js';

export class GracefulDegradation {
  private static openaiBreaker = new CircuitBreaker({
    name: 'openai-gateway',
    failureThreshold: 4,
    cooldownPeriodMs: 20000,
    timeoutMs: 12000,
  });

  private static anthropicBreaker = new CircuitBreaker({
    name: 'anthropic-gateway',
    failureThreshold: 4,
    cooldownPeriodMs: 20000,
    timeoutMs: 12000,
  });

  private static googleBreaker = new CircuitBreaker({
    name: 'google-ai-gateway',
    failureThreshold: 4,
    cooldownPeriodMs: 20000,
    timeoutMs: 12000,
  });

  private static voiceBreaker = new CircuitBreaker({
    name: 'voice-elevenlabs-gateway',
    failureThreshold: 3,
    cooldownPeriodMs: 15000,
    timeoutMs: 8000,
  });

  public static getOpenAIBreaker(): CircuitBreaker {
    return this.openaiBreaker;
  }

  public static getAnthropicBreaker(): CircuitBreaker {
    return this.anthropicBreaker;
  }

  public static getGoogleBreaker(): CircuitBreaker {
    return this.googleBreaker;
  }

  public static getVoiceBreaker(): CircuitBreaker {
    return this.voiceBreaker;
  }

  /**
   * Multi-provider cascaded execution for LLM chat generation with automatic fallback.
   */
  public static async executeWithAIFallback<T>(
    providers: Array<{
      name: 'openai' | 'anthropic' | 'google' | 'custom';
      fn: () => Promise<T>;
    }>,
    safeFallback: (lastError: Error) => T,
  ): Promise<{ result: T; usedProvider: string; fellBack: boolean }> {
    let lastErr: Error = new Error('No AI providers configured');

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      if (!provider) continue;

      const breaker =
        provider.name === 'openai'
          ? this.openaiBreaker
          : provider.name === 'anthropic'
          ? this.anthropicBreaker
          : this.googleBreaker;

      try {
        const result = await breaker.execute(provider.fn);
        return {
          result,
          usedProvider: provider.name,
          fellBack: i > 0,
        };
      } catch (err: any) {
        lastErr = err;
        logger.warn(`[GracefulDegradation] Provider '${provider.name}' failed. Trying next provider...`, {
          error: err.message,
        });
      }
    }

    // All providers failed: invoke safe offline fallback
    logger.error('[GracefulDegradation] All AI providers exhausted. Returning controlled safe fallback response.');
    return {
      result: safeFallback(lastErr),
      usedProvider: 'offline_fallback',
      fellBack: true,
    };
  }
}
