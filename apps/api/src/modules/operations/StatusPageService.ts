import { PublicServiceHealthStatus } from '@ai-companion/types';
import { IncidentCommandService } from './IncidentCommandService.js';
import { KillSwitchService } from './KillSwitchService.js';

export class StatusPageService {
  private static instance: StatusPageService;

  private constructor() {}

  public static getInstance(): StatusPageService {
    if (!StatusPageService.instance) {
      StatusPageService.instance = new StatusPageService();
    }
    return StatusPageService.instance;
  }

  public getPublicStatus(): PublicServiceHealthStatus {
    const killSwitches = KillSwitchService.getInstance();
    const incidentService = IncidentCommandService.getInstance();

    const isVoiceActive = killSwitches.isServiceActive('voice_calls');
    const isImageActive = killSwitches.isServiceActive('image_generation');
    const isProactiveActive = killSwitches.isServiceActive('proactive_messaging');

    const services: PublicServiceHealthStatus['services'] = [
      {
        serviceKey: 'api',
        name: 'Core API Gateway',
        status: 'OPERATIONAL',
        latencyP95Ms: 42,
        uptimePercent30d: 99.98,
      },
      {
        serviceKey: 'chat',
        name: 'Streaming Chat & AI Inference',
        status: 'OPERATIONAL',
        latencyP95Ms: 180,
        uptimePercent30d: 99.95,
      },
      {
        serviceKey: 'voice',
        name: 'Real-Time Voice Streaming',
        status: isVoiceActive ? 'OPERATIONAL' : 'DEGRADED',
        latencyP95Ms: 290,
        uptimePercent30d: 99.85,
      },
      {
        serviceKey: 'media',
        name: 'AI Image & Media Generation',
        status: isImageActive ? 'OPERATIONAL' : 'DEGRADED',
        latencyP95Ms: 1200,
        uptimePercent30d: 99.90,
      },
      {
        serviceKey: 'discovery',
        name: 'Search & Recommendation Catalog',
        status: 'OPERATIONAL',
        latencyP95Ms: 65,
        uptimePercent30d: 99.99,
      },
      {
        serviceKey: 'notifications',
        name: 'Push & Proactive Notifications',
        status: isProactiveActive ? 'OPERATIONAL' : 'DEGRADED',
        latencyP95Ms: 85,
        uptimePercent30d: 99.92,
      },
      {
        serviceKey: 'billing',
        name: 'Subscriptions & Credit Billing',
        status: 'OPERATIONAL',
        latencyP95Ms: 110,
        uptimePercent30d: 99.99,
      },
    ];

    const activeIncidents = incidentService.getActiveCustomerIncidents();

    let overall: PublicServiceHealthStatus['overall'] = 'OPERATIONAL';
    if (activeIncidents.length > 0) {
      const hasSev0or1 = activeIncidents.some(i => i.severity === 'SEV_0' || i.severity === 'SEV_1');
      overall = hasSev0or1 ? 'OUTAGE' : 'DEGRADED';
    } else if (services.some((s: { status: string }) => s.status === 'DEGRADED')) {
      overall = 'DEGRADED';
    }

    return {
      overall,
      updatedAt: new Date().toISOString(),
      services,
      activeIncidents,
    };
  }
}
