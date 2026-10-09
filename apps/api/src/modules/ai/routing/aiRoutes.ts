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
    // Profile/memory updates and summaries are never seen by the user: the cheap, fast Flash-Lite is plenty
    // (they ran on 3.6 Flash — about 2.5× the price — and only reached Lite when Flash was out of quota).
    return { provider: 'google', model: process.env['GEMINI_BACKGROUND_MODEL'] || 'gemini-3.1-flash-lite' };
  }
  return { provider: 'mock', model: 'gpt-4o-mini' };
}

/**
 * The moments that get the stronger (pricier) Flash model; everything else goes to Flash-Lite. Safety,
 * lessons/health programs and emotional support by default — romance and small talk are fine on Lite.
 * GEMINI_FLASH_MOMENTS (comma list of situations) changes it without a code change.
 */
const DEFAULT_FLASH_MOMENTS = ['crisis', 'emergency', 'eating', 'boundary', 'task', 'emotional'];
export function needsStrongModel(situations: string[]): boolean {
  const list = (process.env['GEMINI_FLASH_MOMENTS'] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const moments = list.length ? list : DEFAULT_FLASH_MOMENTS;
  return situations.some((s) => moments.includes(s));
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
