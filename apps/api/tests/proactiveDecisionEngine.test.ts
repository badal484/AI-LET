import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProactiveDecisionEngine } from '../src/modules/notifications/services/proactiveDecisionEngine.service.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { MemoryRetrieverService } from '../src/modules/memory/services/memoryRetriever.service.js';
import { RelationshipStateService } from '../src/modules/relationships/services/relationshipState.service.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    userReminder: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../src/modules/memory/services/memoryRetriever.service.js', () => ({
  MemoryRetrieverService: {
    retrieveContext: vi.fn(),
  },
}));

vi.mock('../src/modules/relationships/services/relationshipState.service.js', () => ({
  RelationshipStateService: {
    getOrCreateRelationship: vi.fn(),
  },
}));

describe('Phase 7: ProactiveDecisionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prioritize pending user reminders as USER_REQUESTED_REMINDER with highest confidence', async () => {
    vi.mocked(prisma.userReminder.findFirst).mockResolvedValue({
      id: 'rem-123',
      userId: 'user-1',
      characterId: 'char-1',
      title: 'Take vitamins',
      content: 'Reminder to take evening vitamins',
      targetTime: new Date(Date.now() - 60000),
      status: 'PENDING',
    } as any);

    const result = await ProactiveDecisionEngine.evaluateDecision({
      userId: 'user-1',
      characterId: 'char-1',
      characterName: 'Aria',
    });

    expect(result.decision).toBe('SEND');
    expect(result.suggestedIntent).toBe('USER_REQUESTED_REMINDER');
    expect(result.confidence).toBe(0.98);
    expect(result.supportingContextIds).toContain('rem-123');
  });

  it('should formulate FOLLOW_UP_ON_TOPIC when an important event memory exists', async () => {
    vi.mocked(prisma.userReminder.findFirst).mockResolvedValue(null);
    vi.mocked(MemoryRetrieverService.retrieveContext).mockResolvedValue({
      memories: [
        {
          id: 'mem-event-1',
          content: 'User has a job interview at TechCorp tomorrow morning',
          category: 'IMPORTANT_EVENT',
          importanceScore: 0.85,
        },
      ],
      tokenCount: 120,
    } as any);
    vi.mocked(RelationshipStateService.getOrCreateRelationship).mockResolvedValue({
      stage: 'ACQUAINTANCE',
    } as any);

    const result = await ProactiveDecisionEngine.evaluateDecision({
      userId: 'user-1',
      characterId: 'char-1',
      characterName: 'Aria',
    });

    expect(result.decision).toBe('SEND');
    expect(result.suggestedIntent).toBe('FOLLOW_UP_ON_TOPIC');
    expect(result.confidence).toBe(0.88);
    expect(result.supportingContextIds).toContain('mem-event-1');
  });

  it('should formulate ASK_ABOUT_PREVIOUS_GOAL when a goal memory exists', async () => {
    vi.mocked(prisma.userReminder.findFirst).mockResolvedValue(null);
    vi.mocked(MemoryRetrieverService.retrieveContext).mockResolvedValue({
      memories: [
        {
          id: 'mem-goal-1',
          content: 'User wants to finish writing chapter 3 of their science fiction novel',
          category: 'GOAL',
          importanceScore: 0.75,
        },
      ],
      tokenCount: 110,
    } as any);
    vi.mocked(RelationshipStateService.getOrCreateRelationship).mockResolvedValue({
      stage: 'FRIEND',
    } as any);

    const result = await ProactiveDecisionEngine.evaluateDecision({
      userId: 'user-1',
      characterId: 'char-1',
      characterName: 'Aria',
    });

    expect(result.decision).toBe('SEND');
    expect(result.suggestedIntent).toBe('ASK_ABOUT_PREVIOUS_GOAL');
    expect(result.confidence).toBe(0.84);
    expect(result.supportingContextIds).toContain('mem-goal-1');
  });

  it('should choose silence (SKIP with LOW_RELEVANCE_CONFIDENCE) when no signals or topics warrant outreach', async () => {
    vi.mocked(prisma.userReminder.findFirst).mockResolvedValue(null);
    vi.mocked(MemoryRetrieverService.retrieveContext).mockResolvedValue({
      memories: [],
      tokenCount: 0,
    } as any);
    vi.mocked(RelationshipStateService.getOrCreateRelationship).mockResolvedValue({
      stage: 'STRANGER',
    } as any);

    const result = await ProactiveDecisionEngine.evaluateDecision({
      userId: 'user-1',
      characterId: 'char-1',
      characterName: 'Aria',
      proactivityConfig: {},
    });

    expect(result.decision).toBe('SKIP');
    expect(result.skipReason).toBe('LOW_RELEVANCE_CONFIDENCE');
    expect(result.suggestedIntent).toBeNull();
    expect(result.reason).toContain('Choosing silence');
  });
});
