import { logger } from '../../config/logger.js';

/**
 * Transactional email (password reset) through Resend's HTTP API — no SDK.
 *   RESEND_API_KEY  from resend.com (free plan: 3,000 emails a month)
 *   EMAIL_FROM      a sender on a domain verified in Resend, e.g. "Loveek <no-reply@yourdomain.in>"
 * Without them nothing is sent and a warning is logged, so a reset can't silently "succeed".
 * Never log the message body: it carries one-time links.
 */
export const emailConfigured = (): boolean => Boolean(process.env['RESEND_API_KEY'] && process.env['EMAIL_FROM']);

/**
 * Resend's test sender (onboarding@resend.dev, before a domain is verified) only delivers to the Resend account
 * owner's own address — real users never get their emails. Used until the owner buys and verifies a domain.
 */
export const emailTestMode = (): boolean => /@resend\.dev\b/i.test(process.env['EMAIL_FROM'] ?? '');

/** Emails actually reach users (set up, and not in test mode). Features that depend on users receiving mail use this. */
export const emailReachesUsers = (): boolean => emailConfigured() && !emailTestMode();

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  const key = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'];
  if (!key || !from) {
    logger.warn(`Email not sent ("${msg.subject}"): RESEND_API_KEY / EMAIL_FROM are not set`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn(`Email not sent ("${msg.subject}"): Resend answered ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn(`Email not sent ("${msg.subject}"): ${err instanceof Error ? err.message : 'unknown error'}`);
    return false;
  }
}

/** Where the API is reachable from the outside (links in emails). */
export const publicOrigin = (): string =>
  (process.env['PUBLIC_API_URL'] || process.env['RENDER_EXTERNAL_URL'] || `http://localhost:${process.env['PORT'] || 4000}`).replace(/\/$/, '');
