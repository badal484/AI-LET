import { createPublicKey, type JsonWebKey } from 'node:crypto';
import jwt from 'jsonwebtoken';

/**
 * Google-signed tokens (RS256), checked against Google's published keys (cached 1 hour, refreshed when an
 * unknown key id appears). Used for "Continue with Google" ID tokens and Pub/Sub push tokens.
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

/** Verifies signature, issuer, audience and expiry; returns the claims. Throws when anything is wrong. */
export async function verifyGoogleJwt<T extends Record<string, unknown>>(token: string, audience: string | string[]): Promise<T> {
  const header = jwt.decode(token, { complete: true })?.header;
  if (!header?.kid || header.alg !== 'RS256') throw new Error('Not a Google token');
  const aud = Array.isArray(audience) ? (audience as [string, ...string[]]) : audience;
  return jwt.verify(token, await googleKey(header.kid), { algorithms: ['RS256'], audience: aud, issuer: ISSUERS }) as T;
}

/** Tests only. */
export function resetGoogleCertsForTests(): void {
  certs = null;
}
