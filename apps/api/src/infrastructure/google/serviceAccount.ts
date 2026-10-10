import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Google service-account sign-in (OAuth 2.0 JWT bearer flow) without an SDK. Used by Google Play
 * (purchases) and Firebase Cloud Messaging (pushes), each with its own key and scope.
 *
 * The env value is the key file's JSON — raw, base64, or (local development) a path to the file.
 */

export interface ServiceAccount {
  project_id?: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export function readServiceAccount(raw: string | undefined): ServiceAccount | null {
  const value = raw?.trim();
  if (!value) return null;
  const json = value.startsWith('{')
    ? value
    : value.startsWith('/') || value.startsWith('~') || value.endsWith('.json')
      ? readFileSync(value.replace(/^~(?=\/)/, process.env['HOME'] ?? '~'), 'utf8')
      : Buffer.from(value, 'base64').toString('utf8');
  return JSON.parse(json) as ServiceAccount;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

/** An access token per key + scope, refreshed a minute before it expires. */
export function tokenSource(account: () => ServiceAccount, scope: string): () => Promise<string> {
  let cached: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const sa = account();
    const now = Math.floor(Date.now() / 1000);
    const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
      JSON.stringify({ iss: sa.client_email, scope, aud: tokenUri, iat: now, exp: now + 3600 }),
    )}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }),
    });
    if (!res.ok) throw new Error(`Google OAuth failed: HTTP ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  };
}
