import crypto from 'node:crypto';
import {
  SupportTicketItem,
  SupportTicketCreateInput,
  SupportTicketUpdateInput,
  SupportAuditLogItem,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@ai-companion/types';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';

export class SupportDeskService {
  private static instance: SupportDeskService;
  private tickets: Map<string, SupportTicketItem> = new Map();
  private auditLogs: SupportAuditLogItem[] = [];

  private constructor() {
    this.seedInitialTickets();
  }

  public static getInstance(): SupportDeskService {
    if (!SupportDeskService.instance) {
      SupportDeskService.instance = new SupportDeskService();
    }
    return SupportDeskService.instance;
  }

  private seedInitialTickets(): void {
    const seed: SupportTicketItem = {
      id: 'ticket-seed-001',
      userId: 'usr-seed-001',
      userEmail: 'alex.chen@example.com',
      category: 'voice',
      priority: 'P2',
      status: 'in_progress',
      subject: 'Intermittent audio pause during voice call',
      description: 'When switching from WiFi to cellular, voice session briefly halts before reconnecting.',
      screen: 'VoiceCallScreen',
      appVersion: '1.0.0-rc1',
      deviceInfo: { platform: 'ios', model: 'iPhone 14', osVersion: '17.4' },
      assignedAdminId: 'admin-001',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tickets.set(seed.id, seed);
  }

  public async createTicket(
    userId: string,
    input: SupportTicketCreateInput,
    userEmail?: string,
  ): Promise<SupportTicketItem> {
    const id = `ticket-${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    // Determine initial priority based on category
    let initialPriority: SupportTicketPriority = 'P3';
    if (input.category === 'billing' || input.category === 'subscription') {
      initialPriority = 'P1';
    } else if (input.category === 'safety' || input.category === 'authentication') {
      initialPriority = 'P1';
    } else if (input.category === 'voice' || input.category === 'ai_response') {
      initialPriority = 'P2';
    }

    const ticket: SupportTicketItem = {
      id,
      userId,
      userEmail: userEmail || 'user@example.com',
      category: input.category,
      priority: initialPriority,
      status: 'open',
      subject: input.subject.trim(),
      description: input.description.trim(),
      screen: input.screen || null,
      appVersion: input.appVersion || null,
      deviceInfo: input.deviceInfo || null,
      requestId: input.requestId || null,
      createdAt: now,
      updatedAt: now,
    };

    this.tickets.set(id, ticket);
    logger.info('[SupportDeskService] Ticket created', { ticketId: id, userId, category: input.category });
    return ticket;
  }

  public async getUserTickets(userId: string): Promise<SupportTicketItem[]> {
    return Array.from(this.tickets.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async listTickets(params: {
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
    priority?: SupportTicketPriority;
    search?: string;
  }): Promise<SupportTicketItem[]> {
    let result = Array.from(this.tickets.values());

    if (params.status) {
      result = result.filter(t => t.status === params.status);
    }
    if (params.category) {
      result = result.filter(t => t.category === params.category);
    }
    if (params.priority) {
      result = result.filter(t => t.priority === params.priority);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        t =>
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.userEmail?.toLowerCase().includes(q),
      );
    }

    return result.sort((a, b) => {
      const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
      const diff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  public async getTicket(ticketId: string, adminId: string, reason: string): Promise<SupportTicketItem> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new NotFoundError(`Ticket ${ticketId} not found`);
    }

    // Record audited access
    this.recordAuditLog({
      actorAdminId: adminId,
      targetUserId: ticket.userId,
      action: 'VIEW_SUPPORT_TICKET',
      reason,
    });

    return ticket;
  }

  public async updateTicket(
    ticketId: string,
    adminId: string,
    input: SupportTicketUpdateInput,
    reason: string,
  ): Promise<SupportTicketItem> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new NotFoundError(`Ticket ${ticketId} not found`);
    }

    const now = new Date().toISOString();
    if (input.status) {
      ticket.status = input.status;
      if (input.status === 'resolved' || input.status === 'closed') {
        ticket.resolvedAt = now;
      }
    }
    if (input.priority) {
      ticket.priority = input.priority;
    }
    if (input.assignedAdminId !== undefined) {
      ticket.assignedAdminId = input.assignedAdminId;
    }
    if (input.resolutionNotes) {
      ticket.resolutionNotes = input.resolutionNotes;
    }
    ticket.updatedAt = now;

    this.tickets.set(ticketId, ticket);

    this.recordAuditLog({
      actorAdminId: adminId,
      targetUserId: ticket.userId,
      action: 'UPDATE_SUPPORT_TICKET',
      reason: reason || `Updated ticket status to ${input.status || ticket.status}`,
    });

    return ticket;
  }

  public recordAuditLog(log: Omit<SupportAuditLogItem, 'id' | 'createdAt'>): void {
    const record: SupportAuditLogItem = {
      id: `audit-${crypto.randomUUID().substring(0, 8)}`,
      createdAt: new Date().toISOString(),
      ...log,
    };
    this.auditLogs.unshift(record);
    if (this.auditLogs.length > 5000) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(targetUserId?: string): SupportAuditLogItem[] {
    if (targetUserId) {
      return this.auditLogs.filter(l => l.targetUserId === targetUserId);
    }
    return this.auditLogs.slice(0, 100);
  }
}
