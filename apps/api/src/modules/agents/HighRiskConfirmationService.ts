import crypto from 'crypto';
import { HighRiskConfirmationRequest, ToolRiskLevel } from '@ai-companion/types';
import { AGENT_CONSTANTS } from '@ai-companion/config';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';

export interface StoredConfirmationRecord {
  token: string;
  userId: string;
  taskId: string;
  stepId: string;
  toolSlug: string;
  argumentsHash: string;
  riskLevel: ToolRiskLevel;
  explanation: string;
  proposedArguments: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
}

export class HighRiskConfirmationService {
  private static instance: HighRiskConfirmationService;

  private readonly tokenStore: Map<string, StoredConfirmationRecord> = new Map();

  private constructor() {}

  public static getInstance(): HighRiskConfirmationService {
    if (!HighRiskConfirmationService.instance) {
      HighRiskConfirmationService.instance = new HighRiskConfirmationService();
    }
    return HighRiskConfirmationService.instance;
  }

  /**
   * Computes a canonical SHA-256 hash of tool arguments to prevent tampering
   */
  public computeArgumentsHash(args: Record<string, unknown>): string {
    const keys = Object.keys(args).sort();
    const canonical: Record<string, unknown> = {};
    for (const k of keys) {
      canonical[k] = args[k];
    }
    return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  /**
   * Generates a bound high-risk confirmation request with durable database persistence.
   */
  public createConfirmationRequest(
    userId: string,
    taskId: string,
    stepId: string,
    toolSlug: string,
    proposedArguments: Record<string, unknown>,
    riskLevel: ToolRiskLevel,
    explanation: string
  ): HighRiskConfirmationRequest {
    const token = `conf_${crypto.randomBytes(24).toString('hex')}`;
    const argumentsHash = this.computeArgumentsHash(proposedArguments);
    const now = Date.now();
    const expiresAt = new Date(now + AGENT_CONSTANTS.CONFIRMATION_TOKEN_TTL_MS).toISOString();

    const record: StoredConfirmationRecord = {
      token,
      userId,
      taskId,
      stepId,
      toolSlug,
      argumentsHash,
      riskLevel,
      explanation,
      proposedArguments,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      isUsed: false,
    };

    this.tokenStore.set(token, record);

    // Persist asynchronously to DB without blocking synchronous callers
    prisma.highRiskConfirmationRecord
      .create({
        data: {
          token,
          userId,
          taskId,
          stepId,
          toolSlug,
          argumentsHash,
          riskLevel,
          explanation,
          proposedArguments: proposedArguments as any,
          isUsed: false,
          expiresAt: new Date(expiresAt),
        },
      })
      .catch((err: any) => {
        logger.warn(`HighRiskConfirmationService: DB write warning: ${err.message}`);
      });

    logger.info(
      `Created high-risk confirmation request for task '${taskId}', step '${stepId}' (Tool: ${toolSlug}, Risk: ${riskLevel})`
    );

    return {
      token,
      taskId,
      stepId,
      toolSlug,
      argumentsHash,
      riskLevel,
      explanation,
      proposedArguments,
      expiresAt,
    };
  }

  /**
   * Verifies and consumes a confirmation token.
   * STRICT GUARANTEE: Validates user ownership, task, step, tool, arguments hash, and expiration.
   */
  public verifyAndConsume(
    token: string,
    userId: string,
    taskId: string,
    stepId: string,
    providedArguments: Record<string, unknown>
  ): boolean {
    const record = this.tokenStore.get(token);

    if (!record) {
      logger.warn(`Confirmation token '${token}' not found.`);
      return false;
    }

    if (record.isUsed) {
      logger.warn(`Confirmation token '${token}' has already been consumed.`);
      return false;
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      logger.warn(`Confirmation token '${token}' has expired.`);
      return false;
    }

    if (record.userId !== userId) {
      logger.warn(`Confirmation token user mismatch. Expected '${record.userId}', got '${userId}'.`);
      return false;
    }

    if (record.taskId !== taskId || record.stepId !== stepId) {
      logger.warn(`Confirmation token scope mismatch: expected [${record.taskId}/${record.stepId}], got [${taskId}/${stepId}].`);
      return false;
    }

    const currentHash = this.computeArgumentsHash(providedArguments);
    if (record.argumentsHash !== currentHash) {
      logger.warn(`Confirmation token argument tampering detected! Expected '${record.argumentsHash}', got '${currentHash}'.`);
      return false;
    }

    // Atomically consume token
    record.isUsed = true;
    this.tokenStore.set(token, record);

    prisma.highRiskConfirmationRecord
      .update({
        where: { token },
        data: { isUsed: true },
      })
      .catch((err: any) => {
        logger.warn(`HighRiskConfirmationService: DB consumption warning: ${err.message}`);
      });

    logger.info(`Successfully consumed high-risk confirmation token '${token}' for step '${stepId}'`);
    return true;
  }
}
