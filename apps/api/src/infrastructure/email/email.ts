import { logger } from '../../config/logger.js';

/**
 * Transactional email (password reset) through Resend's HTTP API — no SDK.
 *   RESEND_API_KEY  from resend.com (free plan: 3,000 emails a month)
 *   EMAIL_FROM      a sender on a domain verified in Resend, e.g. "Lovira <no-reply@yourdomain.in>"
 * Without them nothing is sent and a warning is logged, so a reset can't silently "succeed".
 * Never log the message body: it carries one-time links.
 */
export const emailConfigured = (): boolean => Boolean(process.env['RESEND_API_KEY'] && process.env['EMAIL_FROM']);

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
