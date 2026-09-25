import crypto from 'crypto';
import type { SocialRedactionFinding, SocialSafetyDecision } from '@ai-companion/types';
import { env } from '../../../config/env.js';
import { PiiDetector } from './PiiDetector.js';
import { SocialContentSafetyService } from './SocialContentSafetyService.js';

export interface ShareSafetyInputItem {
  ref: string;
  text: string;
  /** Exact substrings the user asked to hide. */
  manualRedactions?: string[];
}

export interface ShareSafetyOutputItem {
  ref: string;
  text: string;
  redacted: boolean;
}

export interface ShareSafetyResult {
  items: ShareSafetyOutputItem[];
  findings: SocialRedactionFinding[];
  decision: SocialSafetyDecision;
  /** Independent of `decision`: confirming a redaction never skips human review. */
  requiresModeration: boolean;
  /** Stable fingerprint of exactly what will be published (binds the confirmation token). */
  fingerprint: string;
}

/** Domain-separated key so the share confirmation MAC can never be confused with an access token. */
const confirmationKey = (): Buffer => crypto.createHash('sha256').update(`social-share-confirmation:${env.JWT_ACCESS_SECRET}`).digest();

/**
 * Runs before any share becomes visible:
 *   manual redactions → deterministic PII/secret redaction → policy classification → decision.
 *
 * High-risk findings follow `policy.sharing.highRiskPiiAction`: BLOCK, or REDACT_AND_CONFIRM
 * (redacted automatically and the user must explicitly confirm the exact redacted preview).
 */
export class ShareSafetyPipeline {
  public static run(items: ShareSafetyInputItem[], policy: { highRiskPiiAction: 'BLOCK' | 'REDACT_AND_CONFIRM' }): ShareSafetyResult {
    const allFindings: SocialRedactionFinding[][] = [];
    const reasons = new Set<string>();
    let moderation = false;
    let blocked: string | null = null;

    const out = items.map((item) => {
      let text = item.text;
      let redacted = false;
      for (const manual of item.manualRedactions ?? []) {
        if (manual && text.includes(manual)) {
          text = text.split(manual).join('[hidden]');
          redacted = true;
        }
      }

      const pii = PiiDetector.scan(text);
      if (pii.findings.length) {
        redacted = true;
        allFindings.push(pii.findings);
      }

      const safety = SocialContentSafetyService.evaluateText(pii.redactedText, { surface: 'POST' });
      if (safety.decision.action === 'BLOCK' && !safety.decision.reasons.includes('HIGH_RISK_PII')) {
        blocked = safety.decision.userMessage ?? 'This content cannot be shared.';
        safety.decision.reasons.forEach((r) => reasons.add(r));
      } else if (safety.decision.action === 'REQUIRE_MODERATION') {
        moderation = true;
        safety.decision.reasons.forEach((r) => reasons.add(r));
      }
      return { ref: item.ref, text: pii.redactedText, redacted };
    });

    const findings = PiiDetector.mergeFindings(allFindings);
    const highRisk = findings.some((f) => f.severity === 'HIGH');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');

    let decision: SocialSafetyDecision;
    if (blocked) {
      decision = { action: 'BLOCK', reasons: [...reasons], userMessage: blocked };
    } else if (highRisk && policy.highRiskPiiAction === 'BLOCK') {
      decision = {
        action: 'BLOCK',
        reasons: ['HIGH_RISK_PII'],
        userMessage: 'This selection contains passwords, keys or financial details. Remove those messages to share.',
      };
    } else if (highRisk || findings.length > 0) {
      decision = {
        action: 'REQUIRE_CONFIRMATION',
        reasons: ['PII_REDACTED', ...(highRisk ? ['HIGH_RISK_PII'] : []), ...reasons],
        userMessage: 'We hid some personal details. Check the preview carefully before sharing.',
      };
    } else if (moderation) {
      decision = { action: 'REQUIRE_MODERATION', reasons: [...reasons], userMessage: 'This will be reviewed before it becomes visible.' };
    } else {
      decision = { action: 'ALLOW', reasons: [] };
    }

    return { items: out, findings, decision, requiresModeration: moderation, fingerprint };
  }

  /** HMAC token binding a confirmation to one user + one exact redacted preview (short-lived). */
  public static issueConfirmationToken(userId: string, fingerprint: string, ttlSeconds = 900): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const mac = crypto.createHmac('sha256', confirmationKey()).update(`share:${userId}:${fingerprint}:${exp}`).digest('base64url');
    return `${exp}.${mac}`;
  }

  public static verifyConfirmationToken(userId: string, fingerprint: string, token: string | undefined): boolean {
    if (!token) return false;
    const [expRaw, mac] = token.split('.');
    const exp = Number(expRaw);
    if (!mac || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = crypto.createHmac('sha256', confirmationKey()).update(`share:${userId}:${fingerprint}:${exp}`).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
