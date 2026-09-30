import type { PersonaPack } from '../personaPack.types.js';
import { aanyaMehta } from './aanya-mehta.js';

/**
 * Characters with a persona pack use the compact "human engine" prompt; others keep the legacy
 * prompt until their pack is written and reviewed.
 */
const PACKS: Record<string, PersonaPack> = {
  [aanyaMehta.slug]: aanyaMehta,
};

export function personaPackFor(slug: string | null | undefined): PersonaPack | null {
  if (!slug || process.env['HUMAN_ENGINE_DISABLED'] === 'true') return null;
  return PACKS[slug] ?? null;
}
