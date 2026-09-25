import type { SocialSafetyDecision } from '@ai-companion/types';
import { SafetyClassifiers } from '../../safety/services/SafetyClassifiers.js';
import { LinkSafetyService, type LinkAssessment } from './LinkSafetyService.js';
import { PiiDetector } from './PiiDetector.js';
import type { SocialRedactionFinding } from '@ai-companion/types';

export type SocialTextSurface = 'COMMENT' | 'POST' | 'DIRECT_MESSAGE' | 'MESSAGE_REQUEST' | 'PROFILE' | 'COMMUNITY' | 'AI_GENERATED';

export interface SocialTextEvaluation {
  decision: SocialSafetyDecision;
  /** Text with high-risk secrets / PII redacted (safe to persist and display). */
  sanitizedText: string;
  piiFindings: SocialRedactionFinding[];
  links: LinkAssessment[];
  /** Detected instruction-like payloads. Content remains user data and is never promoted to AI instructions. */
  containsInstructionPayload: boolean;
  /** Internal, explainable signals (never shown to users verbatim). */
  signals: Record<string, number | boolean | string>;
}

const THREAT = /\b(i(?:'| a)?m going to|i will|i'll|gonna)\s+(kill|hurt|stab|shoot|find|dox|rape)\s+(you|u|your)\b|\b(kys|kill yourself|go die)\b/i;
const HARASSMENT = /\b(worthless|pathetic|ugly|disgusting|loser|idiot|stupid|retard(?:ed)?|freak)\b.*\b(you|u|ur|your)\b|\b(you|u|ur)\b.*\b(worthless|pathetic|ugly|disgusting|loser|idiot|stupid|retard(?:ed)?|freak)\b/i;
const SEXUAL = /\b(nudes?|send pics|sexting|onlyfans|explicit pics|hookup)\b/i;
const SCAM = /\b(send (?:me )?(?:money|btc|crypto|usdt)|gift ?cards?|guaranteed (?:returns|profit)|double your (?:money|crypto)|investment opportunity|forex signals|claim your (?:prize|reward)|you(?:'ve| have) won)\b/i;
const PROMO = /\b(free followers|buy followers|follow for follow|f4f|sub4sub|dm me for|check my (?:bio|profile)|whatsapp me|telegram me|promo code)\b/i;
/** Attempts to steer AI characters through public content. */
const CHARACTER_MANIPULATION = /\b(@?\w+,?\s+)?(ignore|forget|override)\s+(your|all|the)\s+(rules|instructions|personality|guidelines|creator)\b|\b(reveal|print|show)\s+(your|the)\s+(system\s+)?(prompt|instructions)\b|\bfrom now on you (?:are|will)\b/i;

function repetitionScore(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 6) return 0;
  const unique = new Set(words).size;
  return 1 - unique / words.length;
}

function capsRatio(text: string): number {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 20) return 0;
  return letters.replace(/[^A-Z]/g, '').length / letters.length;
}

/**
 * Deterministic first-line moderation for all social text (comments, posts, messages, AI output).
 * Produces an explainable `SocialSafetyDecision`. Anything uncertain goes to human review rather
 * than being published first and moderated later.
 */
export class SocialContentSafetyService {
  public static evaluateText(
    text: string,
    ctx: { surface: SocialTextSurface; maxLinks?: number; mentionCount?: number; maxMentions?: number; isDuplicate?: boolean },
  ): SocialTextEvaluation {
    const reasons: string[] = [];
    const signals: Record<string, number | boolean | string> = {};

    const severe = SafetyClassifiers.classifySevereHarm(text);
    const injection = SafetyClassifiers.classifyPromptInjection(text);
    const impersonation = SafetyClassifiers.classifyImpersonation(text);
    const manipulation = SafetyClassifiers.classifyProactiveManipulation(text);
    const pii = PiiDetector.scan(text);
    const { links, worst: worstLink } = LinkSafetyService.assessText(text);

    const containsInstructionPayload = injection.flagged || CHARACTER_MANIPULATION.test(text);
    signals['severe'] = severe.flagged;
    signals['threat'] = THREAT.test(text);
    signals['harassment'] = HARASSMENT.test(text);
    signals['sexual'] = SEXUAL.test(text);
    signals['scam'] = SCAM.test(text);
    signals['promo'] = PROMO.test(text);
    signals['impersonation'] = impersonation.flagged;
    signals['manipulation'] = manipulation.flagged;
    signals['instructionPayload'] = containsInstructionPayload;
    signals['piiSeverity'] = pii.highestSeverity;
    signals['linkVerdict'] = worstLink;
    signals['linkCount'] = links.length;
    signals['repetition'] = Number(repetitionScore(text).toFixed(2));
    signals['caps'] = Number(capsRatio(text).toFixed(2));
    if (ctx.isDuplicate) signals['duplicate'] = true;

    const block = (reason: string, userMessage: string): SocialTextEvaluation => ({
      decision: { action: 'BLOCK', reasons: [...reasons, reason], userMessage },
      sanitizedText: pii.redactedText,
      piiFindings: pii.findings,
      links,
      containsInstructionPayload,
      signals,
    });

    // --- Hard blocks ----------------------------------------------------------
    if (severe.flagged) return block(`SEVERE_${severe.category}`, "This can't be posted because it violates our safety policies.");
    if (signals['threat']) return block('THREAT', "This can't be posted because it contains a threat.");
    if (worstLink === 'MALICIOUS') return block('MALICIOUS_LINK', 'This contains a link that looks unsafe. Remove it and try again.');
    if (pii.highestSeverity === 'HIGH' && ctx.surface !== 'DIRECT_MESSAGE') {
      return block('HIGH_RISK_PII', 'This looks like it contains passwords, keys or financial details. Remove them before posting.');
    }
    if (ctx.maxLinks !== undefined && links.length > ctx.maxLinks) return block('TOO_MANY_LINKS', `You can include at most ${ctx.maxLinks} link(s).`);
    if (ctx.maxMentions !== undefined && (ctx.mentionCount ?? 0) > ctx.maxMentions) {
      return block('TOO_MANY_MENTIONS', `You can mention at most ${ctx.maxMentions} people.`);
    }
    if (ctx.isDuplicate && ctx.surface !== 'DIRECT_MESSAGE') return block('DUPLICATE_CONTENT', "You've already posted this. Try saying something new.");

    // --- Needs a human ---------------------------------------------------------
    if (signals['harassment']) reasons.push('HARASSMENT');
    if (signals['scam']) reasons.push('SCAM');
    if (signals['sexual']) reasons.push('SEXUAL_CONTENT');
    if (impersonation.flagged) reasons.push('IMPERSONATION');
    if (manipulation.flagged) reasons.push('MANIPULATION');
    if (worstLink === 'SUSPICIOUS') reasons.push('SUSPICIOUS_LINK');
    if (signals['promo'] && ctx.surface !== 'DIRECT_MESSAGE') reasons.push('PROMOTIONAL_SPAM');
    if ((signals['repetition'] as number) > 0.7 || (signals['caps'] as number) > 0.85) reasons.push('SPAM_PATTERN');

    if (reasons.length > 0) {
      return {
        decision: {
          action: 'REQUIRE_MODERATION',
          reasons,
          userMessage: 'Your post is being reviewed and will appear once it passes our checks.',
        },
        sanitizedText: pii.redactedText,
        piiFindings: pii.findings,
        links,
        containsInstructionPayload,
        signals,
      };
    }

    // --- Allowed, possibly with limits ----------------------------------------
    const limitReasons: string[] = [];
    if (pii.findings.length > 0) limitReasons.push('PII_REDACTED');
    if (containsInstructionPayload) limitReasons.push('UNTRUSTED_INSTRUCTION_PAYLOAD');
    return {
      decision: { action: limitReasons.length ? 'ALLOW_WITH_LIMITS' : 'ALLOW', reasons: limitReasons },
      sanitizedText: pii.redactedText,
      piiFindings: pii.findings,
      links,
      containsInstructionPayload,
      signals,
    };
  }
}
