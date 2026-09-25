import crypto from 'crypto';
import { OAuthConnectionItem } from '@ai-companion/types';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';

export interface EncryptedOAuthCredential {
  userId: string;
  provider: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  iv: string;
  tag: string;
  scopes: string[];
  accountEmail: string;
  expiresAt: string;
}

export class OAuthVaultService {
  private static instance: OAuthVaultService;
  private readonly encryptionKey: Buffer;

  private readonly cache: Map<string, EncryptedOAuthCredential> = new Map();

  private constructor() {
    // 32-byte encryption key (AES-256-GCM)
    const secret = process.env['ENCRYPTION_KEY'] || 'ai_companion_secure_oauth_vault_key_2026_prod';
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest();
  }

  public static getInstance(): OAuthVaultService {
    if (!OAuthVaultService.instance) {
      OAuthVaultService.instance = new OAuthVaultService();
    }
    return OAuthVaultService.instance;
  }

  private getVaultKey(userId: string, provider: string): string {
    return `${userId}:${provider.toLowerCase()}`;
  }

  /**
   * Stores encrypted OAuth credentials server-side and in PostgreSQL
   */
  public async storeCredentials(
    userId: string,
    provider: string,
    accessToken: string,
    refreshToken: string,
    scopes: string[],
    accountEmail: string = 'user@example.com',
    expiresInSeconds: number = 3600
  ): Promise<OAuthConnectionItem> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const payload = JSON.stringify({ accessToken, refreshToken });
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const cred: EncryptedOAuthCredential = {
      userId,
      provider: provider.toLowerCase(),
      encryptedAccessToken: encrypted,
      encryptedRefreshToken: '',
      iv: iv.toString('hex'),
      tag,
      scopes,
      accountEmail,
      expiresAt,
    };

    this.cache.set(this.getVaultKey(userId, provider), cred);

    try {
      await prisma.oAuthConnectionRecord.upsert({
        where: {
          userId_provider: {
            userId,
            provider: provider.toLowerCase(),
          },
        },
        update: {
          encryptedAccessToken: encrypted,
          encryptedRefreshToken: null,
          iv: iv.toString('hex'),
          tag,
          scopes: scopes as any,
          accountEmail,
          status: 'ACTIVE',
          expiresAt: new Date(expiresAt),
        },
        create: {
          userId,
          provider: provider.toLowerCase(),
          encryptedAccessToken: encrypted,
          encryptedRefreshToken: null,
          iv: iv.toString('hex'),
          tag,
          scopes: scopes as any,
          accountEmail,
          status: 'ACTIVE',
          expiresAt: new Date(expiresAt),
        },
      });
    } catch (err: any) {
      logger.warn(`OAuthVaultService: DB write warning: ${err.message}`);
    }

    logger.info(`OAuthVault: safely stored credentials for user '${userId}' on provider '${provider}'`);

    return {
      id: `conn_${provider}_${userId}`,
      userId,
      provider,
      status: 'ACTIVE',
      scopes,
      accountEmail,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Decrypts and retrieves access & refresh tokens
   */
  public async getCredentials(
    userId: string,
    provider: string
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    let cred = this.cache.get(this.getVaultKey(userId, provider));

    if (!cred) {
      try {
        const dbRecord = await prisma.oAuthConnectionRecord.findUnique({
          where: {
            userId_provider: {
              userId,
              provider: provider.toLowerCase(),
            },
          },
        });
        if (dbRecord && dbRecord.status === 'ACTIVE') {
          cred = {
            userId: dbRecord.userId,
            provider: dbRecord.provider,
            encryptedAccessToken: dbRecord.encryptedAccessToken,
            encryptedRefreshToken: dbRecord.encryptedRefreshToken || '',
            iv: dbRecord.iv,
            tag: dbRecord.tag,
            scopes: dbRecord.scopes as string[],
            accountEmail: dbRecord.accountEmail || '',
            expiresAt: dbRecord.expiresAt ? dbRecord.expiresAt.toISOString() : new Date().toISOString(),
          };
          this.cache.set(this.getVaultKey(userId, provider), cred);
        }
      } catch (err: any) {
        logger.warn(`OAuthVaultService: DB read fallback warning: ${err.message}`);
      }
    }

    if (!cred) return null;

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(cred.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(cred.tag, 'hex'));

      let decrypted = decipher.update(cred.encryptedAccessToken, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (err: any) {
      logger.error(`OAuthVault: failed to decrypt token for user '${userId}' (${provider}): ${err.message}`);
      return null;
    }
  }

  /**
   * Disconnects / revokes an OAuth provider connection
   */
  public async disconnect(userId: string, provider: string): Promise<boolean> {
    this.cache.delete(this.getVaultKey(userId, provider));

    try {
      await prisma.oAuthConnectionRecord.updateMany({
        where: {
          userId,
          provider: provider.toLowerCase(),
        },
        data: {
          status: 'DISCONNECTED',
        },
      });
      logger.info(`OAuthVault: disconnected provider '${provider}' for user '${userId}'`);
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Lists connected OAuth accounts for a user
   */
  public async listConnections(userId: string): Promise<OAuthConnectionItem[]> {
    try {
      const records = await prisma.oAuthConnectionRecord.findMany({
        where: { userId },
      });

      return records.map((r) => ({
        id: r.id,
        userId: r.userId,
        provider: r.provider,
        status: r.status as any,
        scopes: r.scopes as string[],
        accountEmail: r.accountEmail || undefined,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : undefined,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Synchronous token retrieval from in-memory cache for fast lookup and backward compatibility.
   */
  public getAccessToken(userId: string, provider: string): string | null {
    const cred = this.cache.get(this.getVaultKey(userId, provider));
    if (!cred) return null;

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(cred.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(cred.tag, 'hex'));

      let decrypted = decipher.update(cred.encryptedAccessToken, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const parsed = JSON.parse(decrypted);
      return parsed.accessToken || null;
    } catch (err: any) {
      logger.error(`OAuthVault: sync decrypt error for '${userId}' (${provider}): ${err.message}`);
      return null;
    }
  }

  /**
   * Checks whether connection exists synchronously in cache
   */
  public hasConnection(userId: string, provider: string): boolean {
    return this.cache.has(this.getVaultKey(userId, provider));
  }

  /**
   * Revokes connection synchronously from cache with background DB update
   */
  public revokeConnection(userId: string, provider: string): boolean {
    const key = this.getVaultKey(userId, provider);
    const exists = this.cache.has(key);
    if (exists) {
      this.cache.delete(key);
      prisma.oAuthConnectionRecord
        .updateMany({
          where: { userId, provider: provider.toLowerCase() },
          data: { status: 'DISCONNECTED' },
        })
        .catch((err: any) => {
          logger.warn(`OAuthVault: sync revoke DB update warning: ${err.message}`);
        });
    }
    return exists;
  }
}
