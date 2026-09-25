import { CharactersResource } from './resources/CharactersResource.js';
import { ConversationsResource } from './resources/ConversationsResource.js';
import { MessagesResource } from './resources/MessagesResource.js';
import { WebhooksResource } from './resources/WebhooksResource.js';
import { UsageResource } from './resources/UsageResource.js';
import { EmbedsResource } from './resources/EmbedsResource.js';
import { AgentsResource } from './resources/AgentsResource.js';
import {
  PlatformError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from './errors.js';
import type { PublicStreamPayload } from '@ai-companion/types';

export interface PlatformClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class PlatformClient {
  public readonly characters: CharactersResource;
  public readonly conversations: ConversationsResource;
  public readonly messages: MessagesResource;
  public readonly webhooks: WebhooksResource;
  public readonly usage: UsageResource;
  public readonly embeds: EmbedsResource;
  public readonly agents: AgentsResource;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: PlatformClientOptions = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.['PLATFORM_API_KEY'] : undefined);
    this.baseUrl = (options.baseUrl || 'https://api.companion.ai').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30000;

    const requester = this.request.bind(this);
    const streamRequester = this.requestStream.bind(this);

    this.characters = new CharactersResource(requester);
    this.conversations = new ConversationsResource(requester);
    this.messages = new MessagesResource(requester, streamRequester);
    this.webhooks = new WebhooksResource(requester);
    this.usage = new UsageResource(requester);
    this.embeds = new EmbedsResource(requester);
    this.agents = new AgentsResource(requester);
  }

  /**
   * Internal request dispatcher with authentication headers and typed error mapping.
   */
  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const requestId = response.headers.get('x-request-id') || undefined;

      if (!response.ok) {
        let errJson: any = null;
        try {
          errJson = await response.json();
        } catch {
          // Non-JSON error body
        }

        const msg = errJson?.error?.message || errJson?.message || response.statusText || 'API Request Failed';
        const code = errJson?.error?.code || 'api_error';

        if (response.status === 401) throw new AuthenticationError(msg, requestId);
        if (response.status === 403) throw new PermissionDeniedError(msg, requestId);
        if (response.status === 404) throw new NotFoundError(msg, requestId);
        if (response.status === 400) throw new ValidationError(msg, errJson?.error?.details, requestId);
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          throw new RateLimitError(msg, retryAfter ? parseInt(retryAfter, 10) : undefined, requestId);
        }

        throw new PlatformError(msg, code, response.status, requestId);
      }

      if (response.status === 204) return null;
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Internal SSE streaming dispatcher for real-time tokens and events.
   */
  private async requestStream(
    path: string,
    options: RequestInit,
    onEvent: (event: PublicStreamPayload) => void
  ): Promise<void> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errJson: any = null;
      try {
        errJson = await response.json();
      } catch {
        // Non-JSON error body
      }
      const msg = errJson?.error?.message || response.statusText || 'Stream Request Failed';
      throw new PlatformError(msg, errJson?.error?.code || 'stream_error', response.status);
    }

    if (!response.body) {
      throw new PlatformError('Response body is null, cannot stream events', 'no_stream_body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (jsonStr === '[DONE]') return;

          try {
            const parsed = JSON.parse(jsonStr) as PublicStreamPayload;
            onEvent(parsed);
          } catch {
            // Ignore non-JSON heartbeat line
          }
        }
      }
    }
  }
}
