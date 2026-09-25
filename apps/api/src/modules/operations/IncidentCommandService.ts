import crypto from 'node:crypto';
import {
  IncidentCommandItem,
  IncidentCreateInput,
  IncidentUpdateInput,
  IncidentCommandStatus,
} from '@ai-companion/types';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';

export class IncidentCommandService {
  private static instance: IncidentCommandService;
  private incidents: Map<string, IncidentCommandItem> = new Map();
  private incidentCounter = 100;

  private constructor() {
    this.seedInitialIncident();
  }

  public static getInstance(): IncidentCommandService {
    if (!IncidentCommandService.instance) {
      IncidentCommandService.instance = new IncidentCommandService();
    }
    return IncidentCommandService.instance;
  }

  private seedInitialIncident(): void {
    const seed: IncidentCommandItem = {
      id: 'inc-001',
      incidentNumber: 'INC-101',
      title: 'Voice Gateway upstream rate limit on TTS provider',
      severity: 'SEV_2',
      status: 'resolved',
      commanderAdminId: 'admin-001',
      techLeadAdminId: 'eng-lead-001',
      commsLeadAdminId: 'comms-001',
      affectedServices: ['voice'],
      impactSummary: 'Users experienced a 2-3s delay in voice speech playback during peak evening traffic.',
      timeline: [
        {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          note: 'Automated alert triggered: TTS latency P95 exceeded 1500ms.',
          author: 'System Alerting',
        },
        {
          timestamp: new Date(Date.now() - 5400000).toISOString(),
          note: 'Activated fallback TTS provider pool; latency normalized to 280ms.',
          author: 'Incident Commander',
        },
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          note: 'Confirmed stable operational metrics for 30 consecutive minutes. Incident marked resolved.',
          author: 'Incident Commander',
        },
      ],
      customerFacingMessage: 'We experienced intermittent delays in voice responses. Voice service has returned to normal operations.',
      detectedAt: new Date(Date.now() - 7200000).toISOString(),
      mitigatedAt: new Date(Date.now() - 5400000).toISOString(),
      resolvedAt: new Date(Date.now() - 3600000).toISOString(),
      postmortemUrl: 'https://internal.ops/postmortems/INC-101',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    };

    this.incidents.set(seed.id, seed);
  }

  public async declareIncident(adminId: string, input: IncidentCreateInput): Promise<IncidentCommandItem> {
    this.incidentCounter += 1;
    const id = `inc-${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    const incident: IncidentCommandItem = {
      id,
      incidentNumber: `INC-${this.incidentCounter}`,
      title: input.title.trim(),
      severity: input.severity,
      status: 'detected',
      commanderAdminId: input.commanderAdminId || adminId,
      techLeadAdminId: input.techLeadAdminId || null,
      commsLeadAdminId: null,
      affectedServices: input.affectedServices,
      impactSummary: input.impactSummary.trim(),
      timeline: [
        {
          timestamp: now,
          note: `Incident declared by Admin ${adminId} with severity ${input.severity}`,
          author: adminId,
        },
      ],
      customerFacingMessage: input.customerFacingMessage || null,
      detectedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.incidents.set(id, incident);
    logger.warn('[IncidentCommandService] Incident declared', { incidentId: id, severity: input.severity, title: input.title });
    return incident;
  }

  public async listIncidents(status?: IncidentCommandStatus): Promise<IncidentCommandItem[]> {
    let result = Array.from(this.incidents.values());
    if (status) {
      result = result.filter(i => i.status === status);
    }
    return result.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  public async getIncident(id: string): Promise<IncidentCommandItem> {
    const inc = this.incidents.get(id);
    if (!inc) {
      throw new NotFoundError(`Incident ${id} not found`);
    }
    return inc;
  }

  public async updateIncident(
    id: string,
    adminId: string,
    input: IncidentUpdateInput,
  ): Promise<IncidentCommandItem> {
    const inc = this.incidents.get(id);
    if (!inc) {
      throw new NotFoundError(`Incident ${id} not found`);
    }

    const now = new Date().toISOString();

    if (input.severity) {
      inc.severity = input.severity;
      inc.timeline.push({
        timestamp: now,
        note: `Severity updated to ${input.severity}`,
        author: adminId,
      });
    }

    if (input.status) {
      inc.status = input.status;
      if (input.status === 'mitigating' || input.status === 'monitoring') {
        if (!inc.mitigatedAt) inc.mitigatedAt = now;
      }
      if (input.status === 'resolved' || input.status === 'postmortem') {
        if (!inc.resolvedAt) inc.resolvedAt = now;
      }
      inc.timeline.push({
        timestamp: now,
        note: `Status updated to ${input.status}`,
        author: adminId,
      });
    }

    if (input.timelineNote) {
      inc.timeline.push({
        timestamp: now,
        note: input.timelineNote.trim(),
        author: adminId,
      });
    }

    if (input.customerFacingMessage !== undefined) {
      inc.customerFacingMessage = input.customerFacingMessage;
    }

    if (input.postmortemUrl) {
      inc.postmortemUrl = input.postmortemUrl;
    }

    inc.updatedAt = now;
    this.incidents.set(id, inc);
    logger.info('[IncidentCommandService] Incident updated', { incidentId: id, status: inc.status });
    return inc;
  }

  public getActiveCustomerIncidents(): Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    customerMessage: string;
    updatedAt: string;
  }> {
    return Array.from(this.incidents.values())
      .filter(i => i.status !== 'resolved' && i.status !== 'postmortem' && !!i.customerFacingMessage)
      .map(i => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        customerMessage: i.customerFacingMessage!,
        updatedAt: i.updatedAt,
      }));
  }
}
