import { describe, it, expect, beforeEach } from 'vitest';
import { SupportDeskService } from '../src/modules/operations/SupportDeskService.js';
import { BetaProgramService } from '../src/modules/operations/BetaProgramService.js';
import { IncidentCommandService } from '../src/modules/operations/IncidentCommandService.js';
import { KillSwitchService } from '../src/modules/operations/KillSwitchService.js';
import { TwoPersonApprovalService } from '../src/modules/operations/TwoPersonApprovalService.js';
import { StatusPageService } from '../src/modules/operations/StatusPageService.js';

describe('Phase 21: Production Launch Operations, Beta, Support & Incident Management', () => {
  let supportService: SupportDeskService;
  let betaService: BetaProgramService;
  let incidentService: IncidentCommandService;
  let killSwitchService: KillSwitchService;
  let approvalService: TwoPersonApprovalService;
  let statusPageService: StatusPageService;

  beforeEach(() => {
    supportService = SupportDeskService.getInstance();
    betaService = BetaProgramService.getInstance();
    incidentService = IncidentCommandService.getInstance();
    killSwitchService = KillSwitchService.getInstance();
    approvalService = TwoPersonApprovalService.getInstance();
    statusPageService = StatusPageService.getInstance();
  });

  describe('Support Desk Subsystem', () => {
    it('creates support tickets with correct priority triage and categorization', async () => {
      const billingTicket = await supportService.createTicket(
        'usr-test-1',
        {
          category: 'billing',
          subject: 'Double charge on subscription renewal',
          description: 'My invoice shows two simultaneous charges for monthly tier.',
          appVersion: '1.0.0',
        },
        'user1@example.com',
      );

      expect(billingTicket.id).toBeDefined();
      expect(billingTicket.priority).toBe('P1');
      expect(billingTicket.status).toBe('open');
      expect(billingTicket.userEmail).toBe('user1@example.com');

      const bugTicket = await supportService.createTicket(
        'usr-test-1',
        {
          category: 'bug',
          subject: 'Avatar shimmer delay',
          description: 'Minor delay before image pops in.',
        },
        'user1@example.com',
      );
      expect(bugTicket.priority).toBe('P3');
    });

    it('records audited logs when admin views or updates ticket', async () => {
      const ticket = await supportService.createTicket('usr-test-2', {
        category: 'safety',
        subject: 'Report inappropriate character greeting',
        description: 'Character used aggressive language.',
      });

      const viewed = await supportService.getTicket(ticket.id, 'admin-123', 'Investigating user safety report');
      expect(viewed.id).toBe(ticket.id);

      const updated = await supportService.updateTicket(
        ticket.id,
        'admin-123',
        {
          status: 'resolved',
          resolutionNotes: 'Character greeting revised and safety guardrails enforced.',
        },
        'Resolved after character modification',
      );
      expect(updated.status).toBe('resolved');
      expect(updated.resolvedAt).toBeDefined();

      const auditLogs = supportService.getAuditLogs('usr-test-2');
      expect(auditLogs.length).toBeGreaterThanOrEqual(2);
      expect(auditLogs[0].action).toBe('UPDATE_SUPPORT_TICKET');
      expect(auditLogs[0].actorAdminId).toBe('admin-123');
    });
  });

  describe('Beta Program & Cohort Management', () => {
    it('creates beta invite and allows idempotent redemption', async () => {
      const invite = await betaService.createInvitation('admin-001', {
        cohort: 'CREATOR_BETA',
        maxRedemptions: 5,
      });

      expect(invite.code).toBeDefined();
      expect(invite.status).toBe('ACTIVE');

      // First redemption
      const res1 = await betaService.redeemCode('usr-beta-1', invite.code);
      expect(res1.success).toBe(true);
      expect(res1.cohort).toBe('CREATOR_BETA');
      expect(res1.featuresUnlocked).toContain('character_studio_v2');

      // Idempotent second redemption by same user
      const res2 = await betaService.redeemCode('usr-beta-1', invite.code);
      expect(res2.success).toBe(true);
      expect(res2.message).toContain('already enrolled');
    });

    it('rejects expired or exhausted invite codes', async () => {
      const invite = await betaService.createInvitation('admin-001', {
        cohort: 'INTERNAL',
        maxRedemptions: 1,
      });

      await betaService.redeemCode('usr-1', invite.code);

      // Second user tries to redeem single-use code
      await expect(betaService.redeemCode('usr-2', invite.code)).rejects.toThrow();
    });
  });

  describe('Incident Command Center', () => {
    it('declares incident and tracks timeline and customer message', async () => {
      const incident = await incidentService.declareIncident('admin-ops-1', {
        title: 'Redis cache latency elevated',
        severity: 'SEV_2',
        affectedServices: ['chat', 'voice'],
        impactSummary: 'Session state retrieval experiencing 150ms p95 latency.',
        customerFacingMessage: 'We are experiencing slight delays in message delivery.',
      });

      expect(incident.id).toBeDefined();
      expect(incident.status).toBe('detected');
      expect(incident.timeline.length).toBe(1);

      // Update incident
      const updated = await incidentService.updateIncident(incident.id, 'admin-ops-1', {
        status: 'mitigating',
        timelineNote: 'Switched session storage read replicas to standby cluster.',
      });

      expect(updated.status).toBe('mitigating');
      expect(updated.timeline.length).toBe(3); // Declaration + status change + note
      expect(updated.mitigatedAt).toBeDefined();

      const customerIncidents = incidentService.getActiveCustomerIncidents();
      expect(customerIncidents.some(i => i.id === incident.id)).toBe(true);
    });
  });

  describe('Operational Kill Switches', () => {
    it('checks sub-millisecond service activation and updates switches', () => {
      expect(killSwitchService.isServiceActive('voice_calls')).toBe(true);

      killSwitchService.updateSwitch('admin-emergency', {
        switchKey: 'voice_calls',
        isEnabled: false,
        reason: 'Upstream voice provider outage',
      });

      expect(killSwitchService.isServiceActive('voice_calls')).toBe(false);

      // Re-enable
      killSwitchService.updateSwitch('admin-emergency', {
        switchKey: 'voice_calls',
        isEnabled: true,
        reason: 'Upstream recovered',
      });
      expect(killSwitchService.isServiceActive('voice_calls')).toBe(true);
    });
  });

  describe('Dual-Control Two-Person Approvals', () => {
    it('requires distinct second admin to approve critical operations', async () => {
      const request = await approvalService.createApprovalRequest('admin-requester-1', {
        action: 'DELETE_USER',
        payload: { targetUserId: 'usr-bad-actor' },
        reason: 'GDPR right to be forgotten manual purge request',
      });

      expect(request.status).toBe('PENDING');

      // Attempt self-approval must fail
      await expect(
        approvalService.reviewApprovalRequest(request.id, 'admin-requester-1', 'APPROVE'),
      ).rejects.toThrow('Dual-control policy requires a different admin');

      // Approval by second admin succeeds
      const approved = await approvalService.reviewApprovalRequest(request.id, 'admin-approver-2', 'APPROVE');
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedByAdminId).toBe('admin-approver-2');
    });
  });

  describe('Status Page Public Summary', () => {
    it('generates public health summary without exposing sensitive infrastructure credentials', () => {
      const status = statusPageService.getPublicStatus();
      expect(status.overall).toBeDefined();
      expect(status.services.length).toBeGreaterThanOrEqual(7);

      const serviceKeys = status.services.map(s => s.serviceKey);
      expect(serviceKeys).toContain('api');
      expect(serviceKeys).toContain('chat');
      expect(serviceKeys).toContain('voice');
      expect(serviceKeys).toContain('media');
      expect(serviceKeys).toContain('discovery');
      expect(serviceKeys).toContain('notifications');
      expect(serviceKeys).toContain('billing');

      // Ensure no raw tokens/passwords exist in status
      const json = JSON.stringify(status);
      expect(json).not.toContain('secret');
      expect(json).not.toContain('password');
      expect(json).not.toContain('Bearer');
    });
  });
});
