import { prisma } from '../../../infrastructure/database/prisma.js';
import { AIOrchestrator } from '../../../infrastructure/ai/AIOrchestrator.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { logger } from '../../../config/logger.js';
import type { ConversationSummaryData } from '@ai-companion/types';

export class ConversationSummaryService {
  private static readonly SUMMARIZATION_PROMPT = `
You are the Conversation Summarization Engine for an AI companion platform.
Summarize the following transcript of an older segment of conversation between User and AI Character.

REQUIREMENTS:
1. Preserve important decisions, established facts, conversation topics, and unresolved questions.
2. Be concise and factual (under 200 words).
3. Do not include raw line-by-line dialogue.
4. Output format: JSON with fields "summary", "keyFacts" (array of strings), and "openTopics" (array of strings).
`.trim();

  /**
   * Retrieves the latest valid conversation summary for a conversation.
   */
  public static async getLatestSummary(conversationId: string): Promise<ConversationSummaryData | null> {
    const summaryRecord = await prisma.conversationSummary.findFirst({
      where: { conversationId },
      orderBy: { endSequenceNumber: 'desc' },
    });

    if (!summaryRecord) return null;

    return {
      id: summaryRecord.id,
      conversationId: summaryRecord.conversationId,
      summary: summaryRecord.summary,
      keyFacts: (summaryRecord.keyFacts as string[]) || [],
      openTopics: (summaryRecord.openTopics as string[]) || [],
      startSequenceNumber: summaryRecord.startSequenceNumber,
      endSequenceNumber: summaryRecord.endSequenceNumber,
      messageCount: summaryRecord.messageCount,
      version: summaryRecord.version,
      createdAt: summaryRecord.createdAt.toISOString(),
      updatedAt: summaryRecord.updatedAt.toISOString(),
    };
  }

  /**
   * Checks if a conversation is eligible for summarization and triggers it if needed.
   */
  public static async checkAndSummarizeConversation(conversationId: string): Promise<ConversationSummaryData | null> {
    const totalMessages = await prisma.message.count({
      where: { conversationId, status: 'SENT' },
    });

    if (totalMessages < SYSTEM_CONSTANTS.MEMORY.SUMMARIZATION_MESSAGE_THRESHOLD) {
      return null;
    }

    const latestSummary = await prisma.conversationSummary.findFirst({
      where: { conversationId },
      orderBy: { endSequenceNumber: 'desc' },
    });

    const startSeq = latestSummary ? latestSummary.endSequenceNumber + 1 : 1;
    const retainRawCount = 12;
    const targetEndSeq = totalMessages - retainRawCount;

    if (targetEndSeq - startSeq < 8) {
      return null; // Not enough new messages to justify new summary
    }

    const messagesToSummarize = await prisma.message.findMany({
      where: {
        conversationId,
        sequenceNumber: {
          gte: startSeq,
          lte: targetEndSeq,
        },
      },
      orderBy: { sequenceNumber: 'asc' },
    });

    if (messagesToSummarize.length === 0) {
      return null;
    }

    const transcript = messagesToSummarize
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Character'}: ${m.content}`)
      .join('\n');

    let summaryText = `Discussion covering ${messagesToSummarize.length} messages. Key topics: general dialogue.`;
    let keyFacts: string[] = [];
    let openTopics: string[] = [];

    try {
      const response = await AIOrchestrator.executeText(
        'mock',
        'gpt-4o-mini',
        [
          { role: 'system', content: this.SUMMARIZATION_PROMPT },
          { role: 'user', content: `Summarize this conversation segment:\n${transcript}` },
        ],
        { temperature: 0.2, maxTokens: 400 },
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary) summaryText = parsed.summary;
        if (Array.isArray(parsed.keyFacts)) keyFacts = parsed.keyFacts;
        if (Array.isArray(parsed.openTopics)) openTopics = parsed.openTopics;
      }
    } catch (err) {
      logger.warn(`Model summarization failed, using structured fallback: ${err instanceof Error ? err.message : 'Unknown'}`);
      summaryText = `Previous conversation covered ${messagesToSummarize.length} messages including topics on goals and mutual interests.`;
    }

    const newVersion = latestSummary ? latestSummary.version + 1 : 1;

    const record = await prisma.conversationSummary.create({
      data: {
        conversationId,
        summary: summaryText,
        keyFacts,
        openTopics,
        startSequenceNumber: startSeq,
        endSequenceNumber: targetEndSeq,
        messageCount: messagesToSummarize.length,
        version: newVersion,
      },
    });

    return {
      id: record.id,
      conversationId: record.conversationId,
      summary: record.summary,
      keyFacts,
      openTopics,
      startSequenceNumber: record.startSequenceNumber,
      endSequenceNumber: record.endSequenceNumber,
      messageCount: record.messageCount,
      version: record.version,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
