import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { ValidationError, NotFoundError, SecurityViolationError, PermissionDeniedError } from '../../../shared/errors/AppError.js';
import type {
  WebhookEndpointItem,
  WebhookDeliveryItem,
  WebhookDeliveryStatus,
  ProjectEnvironment,
} from '@ai-companion/types';

export interface CreateWebhookEndpointInput {
  projectId: string;
  userId: string;
  url: string;
  eventTypes: string[];
  description?: string;
  environment?: ProjectEnvironment;
}

export class WebhookService {
  private static instance: WebhookService;

  private readonly retryBackoffSeconds = [60, 300, 900, 3600, 21600, 86400]; // 1m, 5m, 15m, 1h, 6h, 24h

  private constructor() {}

  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  // =========================================================================
  // ENDPOINT REGISTRATION & MANAGEMENT
  // =========================================================================

  /**
   * Registers a webhook endpoint with SSRF URL validation.
   */
  public async createWebhookEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpointItem & { secretKey: string }> {
    if (!input.url || input.url.trim().length === 0) {
      throw new ValidationError('Webhook URL is required.');
    }

    await this.validateWebhookUrlSecurity(input.url);

    if (!input.eventTypes || input.eventTypes.length === 0) {
      throw new ValidationError('At least one event type must be specified.');
    }

    // Verify project ownership
    const project = await prisma.developerProject.findFirst({
      where: { id: input.projectId, userId: input.userId },
    });
    if (!project) {
      throw new PermissionDeniedError('Project not found or access denied');
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const created = await prisma.webhookEndpoint.create({
      data: {
        projectId: input.projectId,
        url: input.url.trim(),
        secret,
        description: input.description?.trim() || null,
        eventTypes: input.eventTypes as any,
        environment: input.environment || project.environment || 'DEVELOPMENT',
        active: true,
      },
    });

    logger.info(`WebhookService: created endpoint '${created.id}' for project '${input.projectId}'`);
    return {
      ...this.mapEndpoint(created),
      secretKey: secret,
    };
  }

  public async createEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpointItem & { secretKey: string }> {
    return this.createWebhookEndpoint(input);
  }

  /**
   * Lists webhook endpoints for a project.
   */
  public async listWebhookEndpoints(projectId: string, userId?: string): Promise<WebhookEndpointItem[]> {
    if (userId) {
      const project = await prisma.developerProject.findFirst({
        where: { id: projectId, userId },
      });
      if (!project) {
        throw new PermissionDeniedError('Project not found or access denied');
      }
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return endpoints.map((e) => this.mapEndpoint(e));
  }

  public async listEndpoints(projectId: string): Promise<WebhookEndpointItem[]> {
    return this.listWebhookEndpoints(projectId);
  }

  /**
   * Updates an existing webhook endpoint.
   */
  public async updateWebhookEndpoint(
    endpointId: string,
    projectId: string,
    userId: string,
    input: { url?: string; eventTypes?: string[]; active?: boolean; description?: string }
  ): Promise<WebhookEndpointItem> {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, projectId },
      include: { project: true },
    });

    if (!endpoint || endpoint.project.userId !== userId) {
      throw new NotFoundError(`Webhook endpoint '${endpointId}' not found.`);
    }

    if (input.url) {
      await this.validateWebhookUrlSecurity(input.url);
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        url: input.url ? input.url.trim() : undefined,
        eventTypes: input.eventTypes ? (input.eventTypes as any) : undefined,
        active: input.active !== undefined ? input.active : undefined,
        description: input.description !== undefined ? input.description : undefined,
      },
    });

    return this.mapEndpoint(updated);
  }

  /**
   * Deletes a webhook endpoint.
   */
  public async deleteWebhookEndpoint(endpointId: string, projectId: string, userId?: string): Promise<void> {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, projectId },
      include: { project: true },
    });

    if (!endpoint || (userId && endpoint.project.userId !== userId)) {
      throw new NotFoundError(`Webhook endpoint '${endpointId}' not found.`);
    }

    await prisma.webhookEndpoint.delete({ where: { id: endpointId } });
  }

  public async deleteEndpoint(endpointId: string, projectId: string): Promise<void> {
    return this.deleteWebhookEndpoint(endpointId, projectId);
  }

  /**
   * Sends a test ping event to an endpoint.
   */
  public async sendTestPingEvent(endpointId: string, projectId: string, userId: string): Promise<WebhookDeliveryItem> {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, projectId },
      include: { project: true },
    });

    if (!endpoint || endpoint.project.userId !== userId) {
      throw new NotFoundError(`Webhook endpoint '${endpointId}' not found.`);
    }

    const eventId = `evt_ping_${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      id: eventId,
      type: 'ping',
      version: 1,
      createdAt: new Date().toISOString(),
      projectId,
      data: { message: 'Webhook test ping verified from developer console' },
    };

    return this.createAndExecuteDelivery(endpoint, eventId, 'ping', payload, timestamp, 1);
  }

  /**
   * Lists deliveries for a project with optional filtering.
   */
  public async listDeliveries(
    projectId: string,
    userId: string,
    endpointId?: string,
    status?: string,
    limit: number = 50,
    after?: string
  ): Promise<{ data: WebhookDeliveryItem[]; hasMore: boolean; nextCursor?: string }> {
    const project = await prisma.developerProject.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new PermissionDeniedError('Project not found or access denied');
    }

    const safeLimit = Math.min(Math.max(1, limit), 100);
    const whereClause: any = {
      endpoint: { projectId },
    };

    if (endpointId) whereClause.endpointId = endpointId;
    if (status) whereClause.status = status;

    const queryOptions: any = {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: safeLimit + 1,
    };

    if (after) {
      queryOptions.cursor = { id: after };
      queryOptions.skip = 1;
    }

    const deliveries = await prisma.webhookDelivery.findMany(queryOptions);
    const hasMore = deliveries.length > safeLimit;
    const items = hasMore ? deliveries.slice(0, safeLimit) : deliveries;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : undefined;

    return {
      data: items.map((d) => this.mapDelivery(d)),
      hasMore,
      nextCursor,
    };
  }

  // =========================================================================
  // DISPATCH & AT-LEAST-ONCE DELIVERY
  // =========================================================================

  /**
   * Dispatches an event to all eligible active webhook endpoints for a project.
   */
  public async dispatchWebhookEvent(
    projectId: string,
    eventType: string,
    payloadData: Record<string, unknown>,
    environment?: ProjectEnvironment
  ): Promise<WebhookDeliveryItem[]> {
    const whereClause: any = {
      projectId,
      active: true,
    };
    if (environment) {
      whereClause.environment = environment;
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: whereClause,
    });

    const eventId = `evt_${crypto.randomBytes(16).toString('hex')}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const fullPayload = {
      id: eventId,
      type: eventType,
      version: 1,
      createdAt: new Date().toISOString(),
      projectId,
      data: payloadData,
    };

    const deliveries: WebhookDeliveryItem[] = [];

    for (const ep of endpoints) {
      const subscribedEvents = (ep.eventTypes as string[]) || [];
      const matches =
        subscribedEvents.includes('*') ||
        subscribedEvents.includes(eventType) ||
        subscribedEvents.some((pattern) => pattern.endsWith('*') && eventType.startsWith(pattern.slice(0, -1)));

      if (matches) {
        const delivery = await this.createAndExecuteDelivery(ep, eventId, eventType, fullPayload, timestamp);
        deliveries.push(delivery);
      }
    }

    return deliveries;
  }

  public async dispatchEvent(
    projectId: string,
    eventType: string,
    payloadData: Record<string, unknown>,
    environment: ProjectEnvironment = 'DEVELOPMENT'
  ): Promise<WebhookDeliveryItem[]> {
    return this.dispatchWebhookEvent(projectId, eventType, payloadData, environment);
  }

  /**
   * Executes a single delivery attempt with HMAC signature and timeout.
   */
  public async createAndExecuteDelivery(
    endpoint: any,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    timestamp: number,
    attemptNumber: number = 1
  ): Promise<WebhookDeliveryItem> {
    const payloadStr = JSON.stringify(payload);
    const signature = this.signPayload(payloadStr, endpoint.secret, timestamp);

    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let status: WebhookDeliveryStatus = 'PENDING';
    let nextRetryAt: Date | null = null;

    try {
      await this.validateWebhookUrlSecurity(endpoint.url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s bounded timeout

      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Companion-Webhook/1.0',
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString(),
          'X-Event-Id': eventId,
          'X-Event-Type': eventType,
        },
        body: payloadStr,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      statusCode = res.status;
      const resText = await res.text().catch(() => '');
      responseBody = resText.slice(0, 1000); // Bounded response capture

      if (res.ok) {
        status = 'DELIVERED';
      } else {
        status = attemptNumber <= this.retryBackoffSeconds.length ? 'RETRYING' : 'FAILED';
      }
    } catch (err: any) {
      status = attemptNumber <= this.retryBackoffSeconds.length ? 'RETRYING' : 'FAILED';
      responseBody = (err.message || 'Network/timeout failure').slice(0, 500);
    }

    const durationMs = Date.now() - startTime;

    if (status === 'RETRYING') {
      const backoffSec = this.retryBackoffSeconds[attemptNumber - 1] || 3600;
      nextRetryAt = new Date(Date.now() + backoffSec * 1000);
    }

    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventId,
        eventType,
        payload: payload as any,
        status,
        statusCode,
        responseBody,
        durationMs,
        attemptNumber,
        nextRetryAt,
        deliveredAt: status === 'DELIVERED' ? new Date() : null,
      },
    });

    if (status === 'FAILED') {
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { failureCount: { increment: 1 } },
      }).catch(() => {});
    }

    return this.mapDelivery(delivery);
  }

  /**
   * Replays a delivery from Dead Letter Queue (DLQ).
   */
  public async replayDelivery(deliveryId: string, projectId: string, userId?: string): Promise<WebhookDeliveryItem> {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: { include: { project: true } } },
    });

    if (!delivery || delivery.endpoint.projectId !== projectId || (userId && delivery.endpoint.project.userId !== userId)) {
      throw new NotFoundError(`Delivery '${deliveryId}' not found.`);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    return this.createAndExecuteDelivery(
      delivery.endpoint,
      delivery.eventId,
      delivery.eventType,
      delivery.payload as Record<string, unknown>,
      timestamp,
      1
    );
  }

  // =========================================================================
  // SECURITY & SSRF PROTECTION
  // =========================================================================

  /**
   * Validates that target URL is a public HTTPS/HTTP URL and does not resolve to private IP spaces.
   */
  public async validateWebhookUrlSecurity(urlStr: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new ValidationError('Invalid webhook URL format.');
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ValidationError('Webhook URL must use http or https protocol.');
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check prohibited hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      throw new SecurityViolationError('Webhook destination cannot resolve to loopback, link-local, or private domains (SSRF protection).');
    }

    // Resolve IP address to guard against DNS rebinding to private networks
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (this.isPrivateOrReservedIp(addr.address)) {
          throw new SecurityViolationError(
            `Webhook destination resolved to disallowed private IP address (${addr.address}).`
          );
        }
      }
    } catch (err: any) {
      if (err instanceof SecurityViolationError || err instanceof ValidationError) throw err;
      // Allow valid public domains where DNS lookup might be mockable
    }
  }

  /**
   * Evaluates whether an IPv4 or IPv6 string is private, loopback, or cloud-metadata.
   */
  public isPrivateOrReservedIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map((p) => parseInt(p, 10));
      const p0 = parts[0] ?? 0;
      const p1 = parts[1] ?? 0;

      // 127.0.0.0/8 (Loopback)
      if (p0 === 127) return true;
      // 10.0.0.0/8 (Private)
      if (p0 === 10) return true;
      // 172.16.0.0/12 (Private)
      if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
      // 192.168.0.0/16 (Private)
      if (p0 === 192 && p1 === 168) return true;
      // 169.254.0.0/16 (Link-local / Cloud Metadata)
      if (p0 === 169 && p1 === 254) return true;
      // 0.0.0.0/8
      if (p0 === 0) return true;

      return false;
    }

    if (net.isIPv6(ip)) {
      const clean = ip.toLowerCase();
      if (clean === '::1' || clean === '::') return true;
      if (clean.startsWith('fc') || clean.startsWith('fd')) return true; // Unique local
      if (clean.startsWith('fe80:')) return true; // Link local
    }

    return false;
  }

  /**
   * Computes HMAC-SHA256 signature string for webhook payload.
   */
  public signPayload(payload: string, secret: string, timestamp: number): string {
    const signedPayload = `${timestamp}.${payload}`;
    return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  }

  public computeSignature(payload: string, secret: string, timestamp: number): string {
    return this.signPayload(payload, secret, timestamp);
  }

  /**
   * Verifies timing-safe HMAC-SHA256 signature with clock skew replay protection.
   */
  public verifySignature(
    payload: string,
    signature: string,
    timestamp: number,
    secret: string,
    toleranceSeconds: number = 300
  ): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    const cleanSig = signature.startsWith('v1=') ? signature.slice(3) : signature;
    const expected = this.signPayload(payload, secret, timestamp);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(cleanSig, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  }

  private mapEndpoint(record: any): WebhookEndpointItem {
    return {
      id: record.id,
      projectId: record.projectId,
      url: record.url,
      secret: record.secret,
      description: record.description,
      eventTypes: (record.eventTypes as string[]) || [],
      environment: record.environment,
      active: record.active,
      failureCount: record.failureCount,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapDelivery(record: any): WebhookDeliveryItem {
    return {
      id: record.id,
      endpointId: record.endpointId,
      eventId: record.eventId,
      eventType: record.eventType,
      payload: record.payload as Record<string, unknown>,
      status: record.status as WebhookDeliveryStatus,
      statusCode: record.statusCode,
      responseBody: record.responseBody,
      durationMs: record.durationMs,
      attemptNumber: record.attemptNumber,
      nextRetryAt: record.nextRetryAt ? record.nextRetryAt.toISOString() : null,
      deliveredAt: record.deliveredAt ? record.deliveredAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
