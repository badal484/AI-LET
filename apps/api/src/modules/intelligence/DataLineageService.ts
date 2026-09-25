import { DataLineageItem } from '@ai-companion/types';

export class DataLineageService {
  private static instance: DataLineageService;

  private readonly lineageItems: DataLineageItem[] = [
    {
      id: 'lineage_chat_msg',
      eventName: 'message.completed',
      producer: 'API_SERVER',
      ingestionTopic: 'events.chat.messages',
      primaryTable: 'ChatMessage, AIGenerationTrace',
      transformationJob: 'hourly_chat_metrics_rollup',
      aggregatedMetrics: ['MWAC', 'D7 Retention', 'AI Cost per Active User'],
      piiSensitivity: 'REDACTED',
    },
    {
      id: 'lineage_memory_extract',
      eventName: 'memory.extracted',
      producer: 'AI_WORKER',
      ingestionTopic: 'events.memory.extracted',
      primaryTable: 'MemoryItem, MemoryExtractionLog',
      transformationJob: 'daily_memory_quality_audit',
      aggregatedMetrics: ['Memory Retrieval Precision', 'Memory Conflict Rate'],
      piiSensitivity: 'PSEUDONYMIZED',
    },
    {
      id: 'lineage_voice_session',
      eventName: 'voice_session.completed',
      producer: 'GATEWAY',
      ingestionTopic: 'events.voice.telemetry',
      primaryTable: 'VoiceSession, VoiceUsageMeter',
      transformationJob: 'hourly_voice_cost_rollup',
      aggregatedMetrics: ['Voice Latency P95', 'Voice Cost per Active User'],
      piiSensitivity: 'NONE',
    },
    {
      id: 'lineage_billing_webhook',
      eventName: 'billing.subscription_renewed',
      producer: 'API_SERVER',
      ingestionTopic: 'events.billing.reconciliation',
      primaryTable: 'Subscription, PaymentTransaction',
      transformationJob: 'realtime_revenue_reconciliation',
      aggregatedMetrics: ['ARPU', 'Gross Margin', 'MRR'],
      piiSensitivity: 'REDACTED',
    },
    {
      id: 'lineage_moderation_event',
      eventName: 'moderation.flagged',
      producer: 'API_SERVER',
      ingestionTopic: 'events.safety.moderation',
      primaryTable: 'ModerationReport, SafetyIncident',
      transformationJob: 'realtime_safety_circuit_check',
      aggregatedMetrics: ['Safety & Moderation Block Rate'],
      piiSensitivity: 'PSEUDONYMIZED',
    },
  ];

  private constructor() {}

  public static getInstance(): DataLineageService {
    if (!DataLineageService.instance) {
      DataLineageService.instance = new DataLineageService();
    }
    return DataLineageService.instance;
  }

  public getAllLineage(): DataLineageItem[] {
    return this.lineageItems;
  }
}
