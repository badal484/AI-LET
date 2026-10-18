import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Encrypts small secrets kept in the database (the admin two-step secret), so a database copy alone
 * doesn't give them away. AES-256-GCM; the key comes from SECRET_BOX_KEY, or is derived from the JWT secret.
 * Stored as "v1:<iv>:<tag>:<ciphertext>" (base64url).
 */

const key = (): Buffer =>
  Buffer.from(hkdfSync('sha256', process.env['SECRET_BOX_KEY'] || env.JWT_ACCESS_SECRET, 'loveek-secret-box', 'v1', 32));

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
}

export function openSecret(sealed: string): string {
  const [v, iv, tag, ct] = sealed.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}
