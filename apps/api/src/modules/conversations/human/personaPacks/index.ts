import type { PersonaPack } from '../personaPack.types.js';
import { aanyaMehta } from './aanya-mehta.js';
import { aaravMalhotra } from './aarav-malhotra.js';
import { aarohiNair } from './aarohi-nair.js';
import { adityaAgarwal } from './aditya-agarwal.js';
import { arjunMehra } from './arjun-mehra.js';
import { devBhatia } from './dev-bhatia.js';
import { drMaya } from './dr-maya.js';
import { drShradha } from './dr-shradha.js';
import { ishitaRao } from './ishita-rao.js';
import { jiyaSinghal } from './jiya-singhal.js';
import { joelAntony } from './joel-antony.js';
import { kiaraKhanna } from './kiara-khanna.js';
import { kabirSethi } from './kabir-sethi.js';
import { meeraSen } from './meera-sen.js';
import { muskanArora } from './muskan-arora.js';
import { nandiniReddy } from './nandini-reddy.js';
import { neha } from './neha.js';
import { priyaMishra } from './priya-mishra.js';
import { raniMehta } from './rani-mehta.js';
import { tanuVerma } from './tanu-verma.js';
import { vishnu } from './vishnu.js';
import { natasha } from './natasha.js';
import { rajBansal } from './raj-bansal.js';
import { ritikaSharma } from './ritika-sharma.js';
import { rohanDesai } from './rohan-desai.js';
import { riya } from './riya.js';
import { sakshi } from './sakshi.js';
import { sandeepChaudhary } from './sandeep-chaudhary.js';
import { shreyaMehta } from './shreya-mehta.js';
import { simranKaur } from './simran-kaur.js';
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
  // Friendship (docs/friendship-character-sheets.md).
  [tanuVerma.slug]: tanuVerma,
  [raniMehta.slug]: raniMehta,
  [priyaMishra.slug]: priyaMishra,
  [vishnu.slug]: vishnu,
  [nandiniReddy.slug]: nandiniReddy,
  // Astrology, neighbours, coaching, professionals (docs/other-character-sheets.md).
  [sakshi.slug]: sakshi,
  [neha.slug]: neha,
  [simranKaur.slug]: simranKaur,
  [sandeepChaudhary.slug]: sandeepChaudhary,
  // Health & Wellness experts (facts approved in docs/health-fact-sheets.md).
  [drShradha.slug]: drShradha,
  [urviArora.slug]: urviArora,
  [natasha.slug]: natasha,
  [joelAntony.slug]: joelAntony,
  [meeraSen.slug]: meeraSen,
  [drMaya.slug]: drMaya,
  // October 2026 additions (docs/new-character-sheets.md).
  [aaravMalhotra.slug]: aaravMalhotra,
  [devBhatia.slug]: devBhatia,
  [arjunMehra.slug]: arjunMehra,
  [rohanDesai.slug]: rohanDesai,
  [kiaraKhanna.slug]: kiaraKhanna,
  [aarohiNair.slug]: aarohiNair,
};

export function personaPackFor(slug: string | null | undefined): PersonaPack | null {
  if (!slug || process.env['HUMAN_ENGINE_DISABLED'] === 'true') return null;
  return PACKS[slug] ?? null;
}
