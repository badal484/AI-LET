import type { SocialRedactionFinding } from '@ai-companion/types';

/**
 * Deterministic PII / secret detection for anything that may become public.
 *
 * Deliberately regex + checksum based (no LLM dependency) so that it is fast, auditable and
 * cannot be prompt-injected. Patterns are compiled per call: shared global regexes keep
 * `lastIndex` state between calls and silently miss matches.
 */
interface PiiRule {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  pattern: string;
  flags: string;
  /** Optional validator to cut false positives (e.g. Luhn for cards). */
  validate?: (match: string) => boolean;
  replacement: string;
}

function luhnValid(raw: string): boolean {
  const digits = raw.normalize('NFKC').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function phoneLike(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

const RULES: PiiRule[] = [
  // Secrets first so that later rules don't partially consume them.
  { type: 'PRIVATE_KEY', severity: 'HIGH', pattern: '-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----', flags: 'g', replacement: '[redacted key]' },
  { type: 'JWT', severity: 'HIGH', pattern: '\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b', flags: 'g', replacement: '[redacted token]' },
  { type: 'API_KEY', severity: 'HIGH', pattern: '\\b(?:sk|pk|rk)[-_](?:live|test|proj)?[-_]?[A-Za-z0-9]{16,}\\b|\\bAKIA[0-9A-Z]{16}\\b|\\bgh[pousr]_[A-Za-z0-9]{30,}\\b|\\bxox[abpr]-[A-Za-z0-9-]{10,}\\b|\\bAIza[0-9A-Za-z_-]{30,}\\b', flags: 'g', replacement: '[redacted key]' },
  { type: 'CREDENTIAL', severity: 'HIGH', pattern: '\\b(?:password|passwd|pwd|passcode|pin|secret|api[_ -]?key|access[_ -]?token|auth[_ -]?token)\\s*(?:is|=|:)\\s*\\S{4,}', flags: 'gi', replacement: '[redacted credential]' },
  { type: 'OTP', severity: 'HIGH', pattern: '\\b(?:otp|one[\\s-]?time\\s+(?:password|code)|verification\\s+code)\\s*(?:is|:)?\\s*\\d{4,8}\\b', flags: 'gi', replacement: '[redacted code]' },
  // Multi-layered payment card detection: accommodates variable whitespace, dashes, dots, and Unicode dash separators
  { type: 'PAYMENT_CARD', severity: 'HIGH', pattern: '(?<!\\d)(?:\\d[\\s\\-_.\\u2010-\\u2015\\u2212\\u00A0]*){13,19}(?!\\d)', flags: 'g', validate: luhnValid, replacement: '[redacted card]' },
  { type: 'IBAN', severity: 'HIGH', pattern: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b', flags: 'g', replacement: '[redacted account]' },
  { type: 'BANK_ACCOUNT', severity: 'HIGH', pattern: '\\b(?:account|a\\/c|acct)\\s*(?:no\\.?|number|#)?\\s*[:#]?\\s*\\d{9,18}\\b', flags: 'gi', replacement: '[redacted account]' },
  { type: 'UPI_ID', severity: 'MEDIUM', pattern: '\\b[a-zA-Z0-9._-]{2,}@(?:ok)?(?:upi|ybl|paytm|axl|ibl|sbi|icici|hdfcbank|apl)\\b', flags: 'g', replacement: '[redacted payment id]' },
  { type: 'GOVERNMENT_ID', severity: 'HIGH', pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b|\\b[2-9]\\d{3}\\s?\\d{4}\\s?\\d{4}\\b|\\b[A-Z]{5}\\d{4}[A-Z]\\b', flags: 'g', replacement: '[redacted id]' },
  { type: 'EMAIL', severity: 'MEDIUM', pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', flags: 'g', replacement: '[redacted email]' },
  { type: 'PHONE', severity: 'MEDIUM', pattern: '(?<![\\w])(?:\\+?\\d{1,3}[\\s.-]?)?(?:\\(?\\d{2,5}\\)?[\\s.-]?)?\\d{3,5}[\\s.-]?\\d{3,5}(?![\\w])', flags: 'g', validate: phoneLike, replacement: '[redacted phone]' },
  { type: 'STREET_ADDRESS', severity: 'MEDIUM', pattern: '\\b\\d{1,5}\\s+(?:[A-Za-z0-9.]+\\s){1,4}(?:street|st|avenue|ave|road|rd|lane|ln|boulevard|blvd|drive|dr|nagar|marg|colony|sector)\\b\\.?', flags: 'gi', replacement: '[redacted address]' },
  { type: 'POSTAL_CODE', severity: 'LOW', pattern: '\\b(?:pin\\s*code|pincode|zip(?:\\s*code)?)\\s*[:#]?\\s*\\d{5,6}\\b', flags: 'gi', replacement: '[redacted postal code]' },
  { type: 'IP_ADDRESS', severity: 'LOW', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b', flags: 'g', replacement: '[redacted ip]' },
];

export interface PiiScanResult {
  redactedText: string;
  findings: SocialRedactionFinding[];
  highestSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

const SEVERITY_RANK = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 } as const;

export class PiiDetector {
  public static scan(text: string): PiiScanResult {
    // Layer 1: Unicode normalization (NFKC folds fullwidth digits & compatibility characters)
    // and stripping stealth zero-width characters (e.g. \u200B)
    let redactedText = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
    const counts = new Map<string, SocialRedactionFinding>();

    for (const rule of RULES) {
      const re = new RegExp(rule.pattern, rule.flags);
      redactedText = redactedText.replace(re, (match) => {
        if (rule.validate && !rule.validate(match)) return match;
        const f = counts.get(rule.type) ?? { type: rule.type, severity: rule.severity, count: 0 };
        f.count += 1;
        counts.set(rule.type, f);
        return rule.replacement;
      });
    }

    const findings = [...counts.values()];
    let highestSeverity: PiiScanResult['highestSeverity'] = 'NONE';
    for (const f of findings) {
      if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[highestSeverity]) highestSeverity = f.severity;
    }
    return { redactedText, findings, highestSeverity };
  }

  /** Merges findings from multiple scans (e.g. one per shared message). */
  public static mergeFindings(all: SocialRedactionFinding[][]): SocialRedactionFinding[] {
    const merged = new Map<string, SocialRedactionFinding>();
    for (const list of all) {
      for (const f of list) {
        const m = merged.get(f.type) ?? { ...f, count: 0 };
        m.count += f.count;
        merged.set(f.type, m);
      }
    }
    return [...merged.values()];
  }
}
