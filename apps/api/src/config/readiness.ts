import { emailConfigured } from '../infrastructure/email/email.js';
import { usesPooler } from '../infrastructure/database/poolUrl.js';

/**
 * Production settings that are missing or risky. Shown on the admin's System screen and logged when the API
 * starts, so a missing setting is noticed instead of silently breaking a promise to users (password reset,
 * account deletion, legal pages, payments).
 */
export function configWarnings(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  if (!emailConfigured()) out.push('Email is not set up (RESEND_API_KEY, EMAIL_FROM): password-reset and verification emails cannot be sent.');
  if (!env['PUBLIC_API_URL'] && !env['RENDER_EXTERNAL_URL']) out.push('PUBLIC_API_URL is not set: links in emails would point to localhost.');
  if (!env['LEGAL_OPERATOR_NAME'] || !env['LEGAL_CONTACT_EMAIL']) out.push('Legal details are missing (LEGAL_OPERATOR_NAME, LEGAL_CONTACT_EMAIL): the privacy policy and terms are incomplete.');
  if (!env['PUBSUB_PUSH_SERVICE_ACCOUNT']) out.push('PUBSUB_PUSH_SERVICE_ACCOUNT is not set: Google Play renewal and cancellation notifications are refused.');
  if (!usesPooler(env['DATABASE_URL'])) out.push('The database URL is not the pooler URL: use the Neon "-pooler" address for the app (migrations use the direct one).');
  if ((env['JWT_ACCESS_SECRET']?.length ?? 0) < 32 || (env['JWT_REFRESH_SECRET']?.length ?? 0) < 32) out.push('JWT_ACCESS_SECRET / JWT_REFRESH_SECRET are shorter than 32 characters: use long random values (changing them signs everyone out).');
  if (!env['SENTRY_DSN']) out.push('SENTRY_DSN is not set: server errors are not reported.');
  if (env['RUN_SCHEDULED_JOBS_IN_API'] === 'false') out.push('RUN_SCHEDULED_JOBS_IN_API=false: account deletions and reminders need a running worker.');
  return out;
}
