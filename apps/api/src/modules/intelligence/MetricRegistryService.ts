import { MetricDefinitionItem } from '@ai-companion/types';

export class MetricRegistryService {
  private static instance: MetricRegistryService;

  private readonly registry: MetricDefinitionItem[] = [
    {
      id: 'metric_north_star',
      name: 'Meaningful Weekly Active Companionship (MWAC)',
      category: 'NORTH_STAR',
      formula: 'COUNT(DISTINCT user_id) with >= 3 distinct days having >= 5 messages with sentiment_score > 0.6',
      sourceEvent: 'message.completed, conversation.completed',
      timeWindow: 'Trailing 7 Days',
      targetPopulation: 'All verified users',
      owner: 'Product & Executive Team',
      description: 'Measures genuine recurring companionship value rather than superficial click opens.',
    },
    {
      id: 'metric_activation',
      name: '4-Step Core Activation Rate',
      category: 'ACTIVATION',
      formula: '(COUNT(Users Completing Onboarding + First Chat + 3 Turns) / COUNT(Signups)) * 100',
      sourceEvent: 'onboarding.completed, message.sent',
      timeWindow: 'First 24 Hours post-signup',
      targetPopulation: 'New Signups',
      owner: 'Growth & Onboarding Team',
      description: 'Percentage of users experiencing first value within 24 hours of account creation.',
    },
    {
      id: 'metric_d7_retention',
      name: 'D7 Cohort Retention',
      category: 'RETENTION',
      formula: 'COUNT(Users active on Day 7) / COUNT(Users in Day 0 cohort)',
      sourceEvent: 'session.started, message.sent',
      timeWindow: 'Day 7 after signup',
      targetPopulation: 'Weekly signup cohorts',
      owner: 'Product Team',
      description: 'Standard 7-day user retention benchmark.',
    },
    {
      id: 'metric_memory_precision',
      name: 'Memory Retrieval Precision',
      category: 'AI_QUALITY',
      formula: 'COUNT(Relevant Memories Injected) / COUNT(Total Memories Injected)',
      sourceEvent: 'generation.evaluated, memory.retrieved',
      timeWindow: 'Continuous 24h sample',
      targetPopulation: 'AI conversations with memory active',
      owner: 'AI Engine & Quality Team',
      description: 'Precision of vector & semantic memory retrieval preventing context pollution.',
    },
    {
      id: 'metric_ai_cost_per_dau',
      name: 'AI Cost per Active User (AI-CP-DAU)',
      category: 'MONETIZATION',
      formula: 'SUM(generation_cost_usd + voice_cost_usd + media_cost_usd) / COUNT(DAU)',
      sourceEvent: 'ai_generation.trace, voice_session.completed',
      timeWindow: 'Daily',
      targetPopulation: 'Daily Active Users',
      owner: 'Finance & AI Infrastructure Team',
      description: 'Unit economics metric verifying gross contribution margin > 65%.',
    },
    {
      id: 'metric_safety_incident_rate',
      name: 'Safety & Moderation Block Rate',
      category: 'SAFETY',
      formula: '(COUNT(High-Severity Moderation Blocks) / COUNT(Total Messages)) * 100',
      sourceEvent: 'moderation.flagged, safety_incident.logged',
      timeWindow: 'Hourly / Daily',
      targetPopulation: 'All user & character interactions',
      owner: 'Trust & Safety Operations',
      description: 'Monitors false-positives and attack vectors across chat, voice, and creator catalog.',
    },
  ];

  private constructor() {}

  public static getInstance(): MetricRegistryService {
    if (!MetricRegistryService.instance) {
      MetricRegistryService.instance = new MetricRegistryService();
    }
    return MetricRegistryService.instance;
  }

  public getAllMetrics(): MetricDefinitionItem[] {
    return this.registry;
  }

  public getMetricById(id: string): MetricDefinitionItem | undefined {
    return this.registry.find((m) => m.id === id);
  }
}
