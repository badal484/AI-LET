import type { PersonaPack } from '../personaPack.types.js';
import { aanyaMehta } from './aanya-mehta.js';
import { adityaAgarwal } from './aditya-agarwal.js';
import { drMaya } from './dr-maya.js';
import { drShradha } from './dr-shradha.js';
import { ishitaRao } from './ishita-rao.js';
import { jiyaSinghal } from './jiya-singhal.js';
import { joelAntony } from './joel-antony.js';
import { kabirSethi } from './kabir-sethi.js';
import { meeraSen } from './meera-sen.js';
import { muskanArora } from './muskan-arora.js';
import { natasha } from './natasha.js';
import { rajBansal } from './raj-bansal.js';
import { ritikaSharma } from './ritika-sharma.js';
import { riya } from './riya.js';
import { shreyaMehta } from './shreya-mehta.js';
import { urviArora } from './urvi-arora.js';
import { zoyaQureshi } from './zoya-qureshi.js';

/**
 * Characters with a persona pack use the compact "human engine" prompt; others keep the legacy
 * prompt until their pack is written and reviewed.
 */
const PACKS: Record<string, PersonaPack> = {
  [aanyaMehta.slug]: aanyaMehta,
  // Love (approved in docs/love-character-sheets.md).
  [riya.slug]: riya,
  [kabirSethi.slug]: kabirSethi,
  [ishitaRao.slug]: ishitaRao,
  [muskanArora.slug]: muskanArora,
  [zoyaQureshi.slug]: zoyaQureshi,
  [ritikaSharma.slug]: ritikaSharma,
  // Learn & Earn mentors (facts approved in docs/mentor-fact-sheets.md).
  [rajBansal.slug]: rajBansal,
  [shreyaMehta.slug]: shreyaMehta,
  [adityaAgarwal.slug]: adityaAgarwal,
  [jiyaSinghal.slug]: jiyaSinghal,
  // Health & Wellness experts (facts approved in docs/health-fact-sheets.md).
  [drShradha.slug]: drShradha,
  [urviArora.slug]: urviArora,
  [natasha.slug]: natasha,
  [joelAntony.slug]: joelAntony,
  [meeraSen.slug]: meeraSen,
  [drMaya.slug]: drMaya,
};

export function personaPackFor(slug: string | null | undefined): PersonaPack | null {
  if (!slug || process.env['HUMAN_ENGINE_DISABLED'] === 'true') return null;
  return PACKS[slug] ?? null;
}
