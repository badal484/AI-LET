import type { WebhookEndpointItem, WebhookDeliveryItem } from '@ai-companion/types';

export class WebhooksResource {
  constructor(private readonly requester: (path: string, options?: RequestInit) => Promise<any>) {}

  /**
   * Registers a new webhook endpoint.
   */
  public async create(params: {
    url: string;
    eventTypes: string[];
    description?: string;
  }): Promise<WebhookEndpointItem> {
    const res = await this.requester('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.data;
  }

  /**
   * Lists registered webhooks for the active project.
   */
  public async list(): Promise<{ data: WebhookEndpointItem[] }> {
    return this.requester('/v1/webhooks', { method: 'GET' });
  }

  /**
   * Deletes a webhook endpoint.
   */
  public async delete(endpointId: string): Promise<{ success: boolean }> {
    return this.requester(`/v1/webhooks/${endpointId}`, { method: 'DELETE' });
  }

  /**
   * Triggers replay of a specific failed webhook delivery.
   */
  public async replay(deliveryId: string): Promise<WebhookDeliveryItem> {
    const res = await this.requester(`/v1/webhooks/deliveries/${deliveryId}/replay`, {
      method: 'POST',
    });
    return res.data;
  }
}
