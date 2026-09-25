import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { DeveloperAuthService } from '../../src/modules/developer-platform/services/DeveloperAuthService.js';
import { WebhookService } from '../../src/modules/developer-platform/services/WebhookService.js';
import { ValidationError, SecurityViolationError } from '../../src/shared/errors/AppError.js';

describe('Webhook Dispatcher, SSRF Defense & Signature Tests', () => {
  const authService = DeveloperAuthService.getInstance();
  const webhookService = WebhookService.getInstance();

  const developerUserId = '00000000-0000-0000-0000-000000000001';
  let projectId: string;

  beforeEach(async () => {
    await prisma.webhookDelivery.deleteMany();
    await prisma.webhookEndpoint.deleteMany();
    await prisma.developerApiKey.deleteMany();
    await prisma.developerProject.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: { id: developerUserId, email: 'developer@example.com', normalizedEmail: 'developer@example.com', status: 'ACTIVE' },
    });

    const project = await authService.createProject({
      userId: developerUserId,
      name: 'Webhook Test Project',
    });
    projectId = project.id;
  });

  describe('SSRF & DNS-Rebinding Security Validation', () => {
    it('blocks localhost and loopback targets (127.0.0.1)', async () => {
      await expect(
        webhookService.validateWebhookUrlSecurity('http://127.0.0.1:8080/hook')
      ).rejects.toThrow(SecurityViolationError);

      await expect(
        webhookService.validateWebhookUrlSecurity('http://localhost:3000/webhook')
      ).rejects.toThrow(SecurityViolationError);
    });

    it('blocks RFC1918 private IPv4 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', async () => {
      await expect(
        webhookService.validateWebhookUrlSecurity('https://10.0.1.50/events')
      ).rejects.toThrow(SecurityViolationError);

      await expect(
        webhookService.validateWebhookUrlSecurity('https://172.20.10.2/events')
      ).rejects.toThrow(SecurityViolationError);

      await expect(
        webhookService.validateWebhookUrlSecurity('https://192.168.1.100/webhook')
      ).rejects.toThrow(SecurityViolationError);
    });

    it('blocks AWS/Cloud metadata endpoint (169.254.169.254)', async () => {
      await expect(
        webhookService.validateWebhookUrlSecurity('http://169.254.169.254/latest/meta-data/')
      ).rejects.toThrow(SecurityViolationError);
    });

    it('allows valid public HTTPS webhook URLs', async () => {
      await expect(
        webhookService.validateWebhookUrlSecurity('https://example.com/api/webhooks')
      ).resolves.not.toThrow();
    });
  });

  describe('HMAC-SHA256 Signing & Verification', () => {
    it('generates cryptographic signatures that verify successfully', () => {
      const secret = 'whsec_test_secret_key_1234567890abcdef';
      const payload = JSON.stringify({ event: 'conversation.created', id: 'evt_123' });
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = webhookService.signPayload(payload, secret, timestamp);
      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // SHA-256 hex string

      // Verify
      const isValid = webhookService.verifySignature(payload, signature, timestamp, secret);
      expect(isValid).toBe(true);
    });

    it('rejects tampered payloads', () => {
      const secret = 'whsec_test_secret_key_1234567890abcdef';
      const originalPayload = JSON.stringify({ amount: 10 });
      const tamperedPayload = JSON.stringify({ amount: 1000 });
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = webhookService.signPayload(originalPayload, secret, timestamp);
      const isValid = webhookService.verifySignature(tamperedPayload, signature, timestamp, secret);
      expect(isValid).toBe(false);
    });

    it('rejects replayed webhook signatures outside clock skew window', () => {
      const secret = 'whsec_test_secret_key_1234567890abcdef';
      const payload = JSON.stringify({ event: 'test' });
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

      const signature = webhookService.signPayload(payload, secret, expiredTimestamp);
      const isValid = webhookService.verifySignature(payload, signature, expiredTimestamp, secret, 300);
      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Endpoints & DLQ Management', () => {
    it('creates webhook endpoint with signing secret and retrieves deliveries', async () => {
      const endpoint = await webhookService.createWebhookEndpoint({
        projectId,
        userId: developerUserId,
        url: 'https://example.com/webhooks/incoming',
        eventTypes: ['conversation.created', 'message.completed'],
      });

      expect(endpoint.secretKey.startsWith('whsec_')).toBe(true);
      expect(endpoint.url).toBe('https://example.com/webhooks/incoming');

      // Dispatch event
      const deliveries = await webhookService.dispatchWebhookEvent(
        projectId,
        'message.completed',
        { message_id: 'msg_001', tokens: 42 }
      );

      expect(deliveries.length).toBe(1);
      expect(deliveries[0].eventType).toBe('message.completed');
    });
  });
});
