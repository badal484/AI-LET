import { resetGoogleCertsForTests, verifyGoogleJwt } from '../../../security/googleIdToken.js';
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
    const audience = process.env['PUBSUB_PUSH_AUDIENCE'] || `${publicOrigin()}/api/v1/billing/webhooks/google`;
    const claims = await verifyGoogleJwt<{ email?: string; email_verified?: boolean }>(token, audience);
    return claims.email === account && claims.email_verified === true;
  } catch (err) {
    logger.warn(`Play notification refused: ${err instanceof Error ? err.message : 'invalid token'}`);
    return false;
  }
}

/** Tests only. */
export const resetPubsubCertsForTests = resetGoogleCertsForTests;
