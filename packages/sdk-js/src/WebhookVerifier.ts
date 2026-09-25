import crypto from 'crypto';
import { WebhookVerificationError } from './errors.js';

export interface VerifyWebhookOptions {
  payload: string | Buffer;
  signature: string;
  timestamp: string | number;
  secret: string;
  toleranceSeconds?: number;
}

export class WebhookVerifier {
  /**
   * Verifies an incoming webhook HMAC signature and guards against replay attacks.
   */
  public static verify(options: VerifyWebhookOptions): boolean {
    const { payload, signature, timestamp, secret, toleranceSeconds = 300 } = options;

    if (!signature || !timestamp || !secret) {
      throw new WebhookVerificationError('Missing signature, timestamp, or webhook secret.');
    }

    const tsNum = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(tsNum)) {
      throw new WebhookVerificationError('Invalid timestamp header.');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - tsNum) > toleranceSeconds) {
      throw new WebhookVerificationError(
        `Webhook timestamp expired or clock skew exceeded tolerance (${Math.abs(nowSeconds - tsNum)}s > ${toleranceSeconds}s).`
      );
    }

    const rawPayload = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    const signedPayload = `${tsNum}.${rawPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const cleanSig = signature.startsWith('v1=') ? signature.slice(3) : signature;

    try {
      const sigBuffer = Buffer.from(cleanSig, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        throw new WebhookVerificationError('Invalid webhook HMAC signature.');
      }
    } catch (err: any) {
      if (err instanceof WebhookVerificationError) throw err;
      throw new WebhookVerificationError('Signature verification comparison failed.');
    }

    return true;
  }

  /**
   * Computes an HMAC-SHA256 signature for test or transmission purposes.
   */
  public static sign(payload: string, secret: string, timestamp: number = Math.floor(Date.now() / 1000)): { signature: string; timestamp: number } {
    const signedPayload = `${timestamp}.${payload}`;
    const hash = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return {
      signature: `v1=${hash}`,
      timestamp,
    };
  }
}
