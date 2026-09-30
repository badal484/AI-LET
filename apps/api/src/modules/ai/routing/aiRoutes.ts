import type { AIProviderName } from '@ai-companion/types';

/**
 * Platform AI routing for non-chat work, in one place (previously each service hard-coded a Gemini
 * model). Mistral is preferred when configured; Gemini otherwise; the mock provider without keys.
 */
export function backgroundAIRoute(): { provider: AIProviderName; model: string } {
  if (process.env['MISTRAL_API_KEY']) {
    // A lighter model with a far larger rate allowance than the chat model (keeps chat's budget free).
    return { provider: 'mistral', model: process.env['MISTRAL_BACKGROUND_MODEL'] || 'ministral-8b-latest' };
  }
  if (process.env['GOOGLE_AI_API_KEY'] || process.env['GEMINI_API_KEY']) {
    return { provider: 'google', model: process.env['DEFAULT_CHAT_MODEL'] || 'gemini-3.6-flash' };
  }
  return { provider: 'mock', model: 'gpt-4o-mini' };
}

const hasGoogle = () => Boolean(process.env['GOOGLE_AI_API_KEY'] || process.env['GEMINI_API_KEY']);
const googleChat = () => ({ provider: 'google' as AIProviderName, model: process.env['DEFAULT_CHAT_MODEL'] || 'gemini-3.6-flash' });
const mistralChat = () => ({ provider: 'mistral' as AIProviderName, model: process.env['MISTRAL_CHAT_MODEL'] || 'ministral-14b-latest' });

/**
 * Providers for a character's voice, best first; the next one is used when the first is busy or
 * out of quota. CHAT_PROVIDER picks which goes first (default: Mistral when configured).
 */
export function chatAIRoutes(): Array<{ provider: AIProviderName; model: string }> {
  const routes: Array<{ provider: AIProviderName; model: string }> = [];
  const preferGoogle = process.env['CHAT_PROVIDER'] === 'google' || !process.env['MISTRAL_API_KEY'];
  if (preferGoogle && hasGoogle()) routes.push(googleChat());
  if (process.env['MISTRAL_API_KEY']) routes.push(mistralChat());
  if (!preferGoogle && hasGoogle()) routes.push(googleChat());
  return routes;
}

/** Character-voiced generation outside the live chat (e.g. proactive check-ins). */
export function characterVoiceAIRoute(): { provider: AIProviderName; model: string } {
  return chatAIRoutes()[0] ?? backgroundAIRoute();
}
