import net from 'net';
import { AGENT_CONSTANTS } from '@ai-companion/config';

export type LinkVerdict = 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS';

export interface LinkAssessment {
  url: string;
  host: string | null;
  verdict: LinkVerdict;
  reasons: string[];
}

const URL_PATTERN = '\\b(?:(?:https?|ftp|file|javascript|data|vbscript):\\/\\/?[^\\s<>"\']+|www\\.[^\\s<>"\']+|[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:com|net|org|io|ly|gg|xyz|top|click|link|info|me|app|co|in|ru|tk|ml|ga|cf|zip|mov)(?:\\/[^\\s<>"\']*)?)';

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc']);
const HIGH_RISK_TLDS = new Set(['zip', 'mov', 'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'click', 'xyz', 'country', 'kim']);
const PHISHING_TERMS = /(login|signin|verify|account|wallet|password|secure|update|billing|bank|gift-?card|free-?nitro|airdrop|claim)/i;
const IMPERSONATED_BRANDS = /(paypal|apple|google|microsoft|amazon|netflix|instagram|whatsapp|discord|steam|ai-?companion)/i;
/** Maintained by trust & safety; extend via policy in future. */
const DENYLIST = new Set<string>(['grabify.link', 'iplogger.org', '2no.co', 'iplogger.com', 'blasze.tk']);

/**
 * Link safety for user-generated content. Links are data, never instructions: nothing here fetches
 * the URL (no SSRF surface). Clients open external links in a controlled in-app browser.
 */
export class LinkSafetyService {
  public static extract(text: string): string[] {
    const re = new RegExp(URL_PATTERN, 'gi');
    return [...new Set(text.match(re) ?? [])].slice(0, 20);
  }

  public static assess(raw: string): LinkAssessment {
    const reasons: string[] = [];
    let candidate = raw.trim();
    const scheme = candidate.match(/^([a-z]+):/i)?.[1]?.toLowerCase();
    if (scheme && !['http', 'https'].includes(scheme)) {
      return { url: raw, host: null, verdict: 'MALICIOUS', reasons: [`DISALLOWED_SCHEME_${scheme.toUpperCase()}`] };
    }
    if (!scheme) candidate = `https://${candidate}`;

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return { url: raw, host: null, verdict: 'SUSPICIOUS', reasons: ['UNPARSEABLE_URL'] };
    }

    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (parsed.username || parsed.password) reasons.push('EMBEDDED_CREDENTIALS');
    if (net.isIP(host.replace(/^\[|\]$/g, ''))) reasons.push('IP_LITERAL_HOST');
    if (AGENT_CONSTANTS.SSRF_BLOCKLIST_PATTERNS.some((p) => host === p || host.startsWith(p)) || host.endsWith('.local') || host.endsWith('.internal')) {
      reasons.push('PRIVATE_NETWORK_HOST');
    }
    if (host.includes('xn--')) reasons.push('PUNYCODE_HOST');
    if (DENYLIST.has(host)) reasons.push('DENYLISTED_DOMAIN');
    if (SHORTENERS.has(host)) reasons.push('URL_SHORTENER');
    const tld = host.split('.').pop() ?? '';
    if (HIGH_RISK_TLDS.has(tld)) reasons.push('HIGH_RISK_TLD');
    if (host.split('.').length > 5) reasons.push('EXCESSIVE_SUBDOMAINS');
    const brand = `${host}${parsed.pathname}`.match(IMPERSONATED_BRANDS)?.[1];
    if (brand && !host.endsWith(`${brand.toLowerCase().replace('-', '')}.com`) && PHISHING_TERMS.test(`${host}${parsed.pathname}`)) {
      reasons.push('BRAND_PHISHING_PATTERN');
    }
    if ([...parsed.searchParams.keys()].some((k) => /^(utm_|fbclid|gclid|mc_eid|_hs)/i.test(k)) && parsed.searchParams.toString().length > 200) {
      reasons.push('TRACKING_HEAVY');
    }

    const malicious = reasons.some((r) =>
      ['EMBEDDED_CREDENTIALS', 'PRIVATE_NETWORK_HOST', 'DENYLISTED_DOMAIN', 'BRAND_PHISHING_PATTERN'].includes(r),
    );
    const verdict: LinkVerdict = malicious ? 'MALICIOUS' : reasons.length > 0 ? 'SUSPICIOUS' : 'SAFE';
    return { url: raw, host, verdict, reasons };
  }

  public static assessText(text: string): { links: LinkAssessment[]; worst: LinkVerdict } {
    const links = this.extract(text).map((u) => this.assess(u));
    const worst: LinkVerdict = links.some((l) => l.verdict === 'MALICIOUS')
      ? 'MALICIOUS'
      : links.some((l) => l.verdict === 'SUSPICIOUS')
        ? 'SUSPICIOUS'
        : 'SAFE';
    return { links, worst };
  }
}
