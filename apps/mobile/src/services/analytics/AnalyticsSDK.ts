import { Platform } from 'react-native';
import { AnalyticsApi } from '../api/analyticsApi.js';
import type { AnalyticsBatchIngestItem, AnalyticsEventName } from '@ai-companion/types';

export interface AnalyticsSDKConfig {
  appVersion?: string;
  platform?: string;
  locale?: string;
  timezone?: string;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  batchSize?: number;
}

export interface SessionContext {
  sessionId: string;
  startedAt: number;
  entryPoint?: string;
  source?: string;
  campaign?: string;
  content?: string;
}

export interface AnalyticsStorageEngine {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

class AnalyticsService {
  private static instance: AnalyticsService | null = null;

  private userId: string | null = null;
  private anonymousId: string;
  private deviceId: string;
  private currentSession: SessionContext | null = null;

  private config: Required<AnalyticsSDKConfig> = {
    appVersion: '1.0.0',
    // The ingest API accepts ios | android | web | unknown.
    platform: Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : 'unknown',
    locale: 'en-US',
    timezone: 'UTC',
    flushIntervalMs: 30000,
    maxQueueSize: 500,
    batchSize: 50,
  };

  private eventQueue: AnalyticsBatchIngestItem[] = [];
  private isFlushing = false;
  private flushTimer: any = null;
  private storageEngine: AnalyticsStorageEngine | null = null;
  private readonly STORAGE_KEY = 'ai_companion_analytics_offline_queue';
  private readonly ANON_ID_KEY = 'ai_companion_analytics_anon_id';

  private constructor() {
    this.anonymousId = this.generateUUID();
    this.deviceId = this.generateUUID();
    this.detectSystemMetadata();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  public setStorageEngine(engine: AnalyticsStorageEngine): void {
    this.storageEngine = engine;
    this.loadPersistedQueue();
  }

  public async initialize(config?: Partial<AnalyticsSDKConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.storageEngine) {
      const storedAnonId = await this.storageEngine.getItem(this.ANON_ID_KEY);
      if (storedAnonId) {
        this.anonymousId = storedAnonId;
      } else {
        await this.storageEngine.setItem(this.ANON_ID_KEY, this.anonymousId);
      }
      await this.loadPersistedQueue();
    }

    this.startFlushTimer();
  }

  private detectSystemMetadata(): void {
    try {
      if (typeof Intl !== 'undefined') {
        const dtf = Intl.DateTimeFormat();
        const resolved = dtf.resolvedOptions();
        if (resolved.timeZone) {
          this.config.timezone = resolved.timeZone;
        }
        if (resolved.locale) {
          this.config.locale = resolved.locale;
        }
      }
    } catch {
      // Keep defaults
    }
  }

  public identify(userId: string, traits?: Record<string, unknown>): void {
    this.userId = userId;
    this.track('session_started', {
      action: 'identify',
      ...traits,
    });
  }

  public async reset(): Promise<void> {
    // Flush any pending events with current identity before resetting
    await this.flush();

    this.userId = null;
    this.anonymousId = this.generateUUID();
    if (this.storageEngine) {
      await this.storageEngine.setItem(this.ANON_ID_KEY, this.anonymousId);
    }
    this.currentSession = null;
  }

  public startSession(
    entryPoint = 'direct',
    attribution?: { source?: string; campaign?: string; content?: string },
  ): string {
    const sessionId = this.generateUUID();
    this.currentSession = {
      sessionId,
      startedAt: Date.now(),
      entryPoint,
      source: attribution?.source,
      campaign: attribution?.campaign,
      content: attribution?.content,
    };

    this.track('session_started', {
      entryPoint,
      source: attribution?.source || 'organic',
      campaign: attribution?.campaign,
      content: attribution?.content,
    });

    return sessionId;
  }

  public endSession(): void {
    if (!this.currentSession) return;

    const durationSeconds = Math.round((Date.now() - this.currentSession.startedAt) / 1000);
    this.track('session_ended', {
      sessionId: this.currentSession.sessionId,
      durationSeconds,
    });

    this.currentSession = null;
  }

  /** Screen navigation. Deliberately NOT `character_viewed`, which feeds creator view counts. */
  public trackScreen(screenName: string, properties?: Record<string, unknown>): void {
    this.track('screen_viewed', {
      screenName,
      ...properties,
    });
  }

  public trackCharacterViewed(characterId: string, properties?: Record<string, unknown>): void {
    this.track('character_viewed', properties ?? {}, { characterId });
  }

  public track(
    eventName: AnalyticsEventName | string,
    properties: Record<string, unknown> = {},
    options?: {
      characterId?: string;
      creatorId?: string;
      conversationId?: string;
      experimentId?: string;
      experimentVariant?: string;
    },
  ): void {
    // Auto-create session if none active
    if (!this.currentSession && eventName !== 'session_ended') {
      this.startSession('auto');
    }

    const eventItem: AnalyticsBatchIngestItem = {
      id: this.generateUUID(),
      eventName: eventName as any,
      eventVersion: 1,
      userId: this.userId || undefined,
      anonymousId: this.anonymousId,
      sessionId: this.currentSession?.sessionId,
      deviceId: this.deviceId,
      characterId: options?.characterId,
      creatorId: options?.creatorId,
      conversationId: options?.conversationId,
      timestamp: new Date().toISOString(),
      properties: {
        ...properties,
        entryPoint: this.currentSession?.entryPoint,
        acquisitionSource: this.currentSession?.source,
        campaign: this.currentSession?.campaign,
      },
      appVersion: this.config.appVersion,
      platform: this.config.platform,
      locale: this.config.locale,
      timezone: this.config.timezone,
      experimentId: options?.experimentId,
      experimentVariant: options?.experimentVariant,
    };

    this.enqueue(eventItem);
  }

  private enqueue(event: AnalyticsBatchIngestItem): void {
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      // FIFO eviction: drop oldest event to avoid unbounded memory consumption
      this.eventQueue.shift();
    }

    this.eventQueue.push(event);
    this.persistQueue();

    // If batch size threshold met, flush immediately
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.isFlushing || this.eventQueue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const batch = this.eventQueue.slice(0, this.config.batchSize);

    try {
      await AnalyticsApi.sendEvents(batch);
      // Remove successfully transmitted events
      this.eventQueue = this.eventQueue.slice(batch.length);
      await this.persistQueue();
    } catch (error) {
      // Network failure or offline: keep events in queue for next flush attempt
      console.warn('AnalyticsSDK: Failed to flush event batch. Will retry on next cycle.', error);
    } finally {
      this.isFlushing = false;
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.config.flushIntervalMs);
  }

  private async persistQueue(): Promise<void> {
    if (!this.storageEngine) return;
    try {
      await this.storageEngine.setItem(this.STORAGE_KEY, JSON.stringify(this.eventQueue));
    } catch {
      // Ignore disk write errors
    }
  }

  private async loadPersistedQueue(): Promise<void> {
    if (!this.storageEngine) return;
    try {
      const data = await this.storageEngine.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          // Filter out stale events older than 7 days
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          this.eventQueue = parsed.filter(
            (e) => new Date(e.timestamp).getTime() > sevenDaysAgo,
          );
        }
      }
    } catch {
      this.eventQueue = [];
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const Analytics = AnalyticsService.getInstance();
