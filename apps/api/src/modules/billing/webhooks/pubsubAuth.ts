import { createPublicKey, type JsonWebKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { publicOrigin } from '../../../infrastructure/email/email.js';
import { logger } from '../../../config/logger.js';

/**
 * Google Play's payment notifications arrive as Pub/Sub push requests. With authentication turned on for the
 * push subscription, Google signs each request with an OIDC token for a service account we choose (audit M-4).
 * We accept the request only if that token is valid: signed by Google, for our audience, from that account.
 *
 *   PUBSUB_PUSH_SERVICE_ACCOUNT  the service account email set on the push subscription (required in production)
 *   PUBSUB_PUSH_AUDIENCE         optional; default = this API's webhook URL (Google's default audience)
 */

const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS: [string, string] = ['https://accounts.google.com', 'accounts.google.com'];

let certs: { at: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function googleKey(kid: string) {
  if (!certs || Date.now() - certs.at > 3_600_000 || !certs.keys.some((k) => k.kid === kid)) {
    const res = await fetch(GOOGLE_CERTS, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`Google certs: ${res.status}`);
    certs = { at: Date.now(), keys: ((await res.json()) as { keys: Array<JsonWebKey & { kid?: string }> }).keys };
  }
  const jwk = certs.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error('Unknown signing key');
  return createPublicKey({ key: jwk, format: 'jwk' });
}

export const pubsubAuthRequired = (): boolean =>
  process.env['NODE_ENV'] === 'production' || Boolean(process.env['PUBSUB_PUSH_SERVICE_ACCOUNT']);

/** True when the request carries a valid Google-signed token for our push subscription. Never throws. */
export async function verifyPubsubPush(authorization: string | undefined): Promise<boolean> {
  const account = process.env['PUBSUB_PUSH_SERVICE_ACCOUNT'];
  if (!account) {
    logger.warn('Play notification refused: PUBSUB_PUSH_SERVICE_ACCOUNT is not set');
    return false;
  }
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return false;
  try {
    const header = jwt.decode(token, { complete: true })?.header;
    if (!header?.kid || header.alg !== 'RS256') return false;
    const audience = process.env['PUBSUB_PUSH_AUDIENCE'] || `${publicOrigin()}/api/v1/billing/webhooks/google`;
    const claims = jwt.verify(token, await googleKey(header.kid), { algorithms: ['RS256'], audience, issuer: ISSUERS }) as {
      email?: string;
      email_verified?: boolean;
    };
    return claims.email === account && claims.email_verified === true;
  } catch (err) {
    logger.warn(`Play notification refused: ${err instanceof Error ? err.message : 'invalid token'}`);
    return false;
  }
}

/** Tests only. */
export function resetPubsubCertsForTests(): void {
  certs = null;
}
