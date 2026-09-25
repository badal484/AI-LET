import { ErrorCode } from '@ai-companion/config';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { HARD_DISABLED_TOOLS, isHardDisabledTool } from './toolSafety.js';
import { ToolRegistryItem } from '@ai-companion/types';

export class ToolRegistry {
  private static instance: ToolRegistry;

  private readonly tools: Map<string, ToolRegistryItem> = new Map();

  private constructor() {
    this.seedDefaultTools();
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Registers or updates a tool definition in the registry
   */
  public registerTool(item: ToolRegistryItem): ToolRegistryItem {
    const disabled = HARD_DISABLED_TOOLS.get(item.slug);
    if (disabled && item.status !== 'disabled' && item.status !== 'retired') {
      // Hard-disabled tools can never be (re-)enabled through registration.
      throw new ForbiddenError(disabled.message, ErrorCode.PAYMENT_TOOL_DISABLED);
    }
    this.tools.set(item.slug, item);
    return item;
  }

  /**
   * Retrieves a tool by its unique slug
   */
  public getTool(slug: string): ToolRegistryItem | undefined {
    return this.tools.get(slug);
  }

  /**
   * Lists all enabled tools or all tools matching filters
   */
  public listTools(enabledOnly: boolean = true): ToolRegistryItem[] {
    const all = Array.from(this.tools.values());
    if (enabledOnly) {
      return all.filter((t) => (t.status === 'enabled' || t.status === 'approved') && !isHardDisabledTool(t.slug));
    }
    return all;
  }

  private seedDefaultTools() {
    const defaults: ToolRegistryItem[] = [
      {
        id: 'tool_calendar_read',
        name: 'Read Calendar Events',
        slug: 'calendar.read',
        description: 'Reads upcoming events and availability from the user connected calendar.',
        version: '1.0.0',
        category: 'EXTERNAL_API',
        status: 'enabled',
        riskLevel: 'MEDIUM',
        requiredCapability: 'calendar.read',
        permissionScope: 'calendar.events.readonly',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'ISO start date' },
            endDate: { type: 'string', description: 'ISO end date' },
            limit: { type: 'number', default: 10 },
          },
          required: ['startDate'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            events: { type: 'array' },
            totalFound: { type: 'number' },
          },
        },
        timeoutMs: 15000,
        isSideEffecting: false,
        isReversible: true,
        costUsd: 0.001,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tool_calendar_create',
        name: 'Create Calendar Event',
        slug: 'calendar.create_event',
        description: 'Creates a new appointment or event on the user connected calendar.',
        version: '1.0.0',
        category: 'USER_ACTION',
        status: 'enabled',
        riskLevel: 'MEDIUM',
        requiredCapability: 'calendar.write',
        permissionScope: 'calendar.events.write',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Event title' },
            startTime: { type: 'string', description: 'ISO start timestamp' },
            endTime: { type: 'string', description: 'ISO end timestamp' },
            location: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['title', 'startTime', 'endTime'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
            status: { type: 'string' },
            htmlLink: { type: 'string' },
          },
        },
        timeoutMs: 20000,
        isSideEffecting: true,
        isReversible: true,
        costUsd: 0.002,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tool_email_draft',
        name: 'Draft Email',
        slug: 'email.draft',
        description: 'Prepares a structured email draft for user inspection without sending.',
        version: '1.0.0',
        category: 'USER_ACTION',
        status: 'enabled',
        riskLevel: 'LOW',
        requiredCapability: 'email.draft',
        permissionScope: 'email.draft',
        inputSchema: {
          type: 'object',
          properties: {
            recipient: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['recipient', 'subject', 'body'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            draftId: { type: 'string' },
            previewHtml: { type: 'string' },
          },
        },
        timeoutMs: 15000,
        isSideEffecting: false,
        isReversible: true,
        costUsd: 0.001,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tool_email_send',
        name: 'Send Email',
        slug: 'email.send',
        description: 'Sends an email to external recipients on behalf of the user. Requires explicit confirmation.',
        version: '1.0.0',
        category: 'COMMUNICATION',
        status: 'enabled',
        riskLevel: 'HIGH',
        requiredCapability: 'email.send',
        permissionScope: 'email.send',
        inputSchema: {
          type: 'object',
          properties: {
            recipient: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['recipient', 'subject', 'body'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            sentAt: { type: 'string' },
          },
        },
        timeoutMs: 25000,
        isSideEffecting: true,
        isReversible: false,
        costUsd: 0.005,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tool_browser_read',
        name: 'Secure Web Page Reader',
        slug: 'browser.read',
        description: 'Fetches and extracts clean text content from approved web URLs with SSRF protection.',
        version: '1.0.0',
        category: 'BROWSER',
        status: 'enabled',
        riskLevel: 'LOW',
        requiredCapability: 'browser.read',
        permissionScope: 'browser.read',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'HTTPS webpage URL' },
          },
          required: ['url'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            cleanText: { type: 'string' },
            sourceUrl: { type: 'string' },
          },
        },
        timeoutMs: 20000,
        isSideEffecting: false,
        isReversible: true,
        costUsd: 0.002,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tool_document_analyze',
        name: 'Document Analysis & Extraction',
        slug: 'document.analyze',
        description: 'Extracts structured facts, tables, and answers from uploaded PDF, DOCX, and TXT documents.',
        version: '1.0.0',
        category: 'MULTIMODAL',
        status: 'enabled',
        riskLevel: 'LOW',
        requiredCapability: 'document.analyze',
        permissionScope: 'document.read',
        inputSchema: {
          type: 'object',
          properties: {
            attachmentId: { type: 'string' },
            query: { type: 'string' },
          },
          required: ['attachmentId', 'query'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            citations: { type: 'array' },
            confidence: { type: 'number' },
          },
        },
        timeoutMs: 30000,
        isSideEffecting: false,
        isReversible: true,
        costUsd: 0.008,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tool_payment_create',
        name: 'Create Financial Transaction',
        slug: 'payment.create',
        description: 'Initiates a financial transfer or authorized payment. DISABLED: no payment provider is integrated.',
        version: '1.0.0',
        category: 'HIGH_RISK',
        status: 'disabled',
        riskLevel: 'CRITICAL',
        requiredCapability: 'payment.create',
        permissionScope: 'payment.write',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string' },
            recipient: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['amount', 'currency', 'recipient'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            transactionId: { type: 'string' },
            status: { type: 'string' },
          },
        },
        timeoutMs: 30000,
        isSideEffecting: true,
        isReversible: false,
        costUsd: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const t of defaults) {
      this.tools.set(t.slug, t);
    }
  }
}
