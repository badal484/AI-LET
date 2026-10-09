import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../config/logger.js';

/** Kinds worth a human look in the admin Safety screen. Never stores what was said. */
const KINDS = ['crisis', 'emergency', 'eating', 'boundary', 'minor'] as const;
export type SafetyKind = (typeof KINDS)[number];

export function recordSafetyMoments(params: { userId: string; characterId?: string | null; conversationId?: string | null; messageId?: string | null; kinds: string[]; helplineShown?: boolean }): void {
  const kinds = [...new Set(params.kinds)].filter((k): k is SafetyKind => (KINDS as readonly string[]).includes(k));
  if (!kinds.length) return;
  void prisma.safetyMoment
    .createMany({
      data: kinds.map((kind) => ({
        userId: params.userId,
        characterId: params.characterId ?? null,
        conversationId: params.conversationId ?? null,
        messageId: params.messageId ?? null,
        kind,
        // Crisis and emergency replies always carry the helpline (ensureSafetyLines / crisis support).
        helplineShown: params.helplineShown ?? (kind === 'crisis' || kind === 'emergency'),
      })),
    })
    .catch((err: unknown) => logger.warn(`Could not record safety moment: ${err instanceof Error ? err.message : 'Unknown'}`));
}
