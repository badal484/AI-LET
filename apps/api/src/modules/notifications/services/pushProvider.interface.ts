import type { PushPayload } from '@ai-companion/types';
import { logger } from '../../../config/logger.js';

export interface PushSendResult {
  success: boolean;
  messageId?: string;
  isInvalidToken?: boolean;
  error?: string;
}

export interface IPushProvider {
  readonly providerName: string;
  sendPush(payload: PushPayload): Promise<PushSendResult>;
}

export class MockPushProvider implements IPushProvider {
  public readonly providerName = 'mock_push';
  private sentPushes: PushPayload[] = [];

  public async sendPush(payload: PushPayload): Promise<PushSendResult> {
    const { toToken, title, body } = payload;

    // Simulate invalid / expired token handling (e.g. FCM 410 Gone / NotRegistered)
    if (toToken.includes('invalid') || toToken.includes('expired') || toToken === '410_GONE') {
      logger.warn(`[MockPushProvider] Token is invalid or expired: ${toToken}`);
      return {
        success: false,
        isInvalidToken: true,
        error: 'Registration token is no longer valid (Simulated HTTP 410 NotRegistered)',
      };
    }

    this.sentPushes.push(payload);
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info(`[MockPushProvider] Sent push to token "${toToken}": "${title}" - "${body}" (ID: ${messageId})`);

    return {
      success: true,
      messageId,
    };
  }

  public getSentPushes(): PushPayload[] {
    return [...this.sentPushes];
  }

  public clearSentPushes(): void {
    this.sentPushes = [];
  }
}
