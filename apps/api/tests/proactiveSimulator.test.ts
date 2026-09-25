import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProactiveSimulatorService } from '../src/modules/notifications/services/proactiveSimulator.service.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    character: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Phase 7: ProactiveSimulatorService', () => {
  const mockCharacter = {
    id: 'char-simulator-1',
    name: 'Seraphina',
    currentPublishedVersion: {
      id: 'ver-100',
      proactivityConfigData: {
        enabled: true,
        quietHoursStart: '22:30',
        quietHoursEnd: '08:00',
        minInteractionCooldownHours: 6,
        maxDailyProactive: 2,
      },
    },
    versions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should simulate successful proactive outreach during eligible daytime hours', async () => {
    vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);

    const result = await ProactiveSimulatorService.simulate({
      characterId: 'char-simulator-1',
      mockLocalTime: '2026-09-23T14:30:00Z', // Daytime 2:30 PM UTC
      userTimezone: 'UTC',
      simulateRecentInteractionHours: 12,
      userMessageContext: 'Preparing for my presentation on quantum gravity tomorrow morning',
    });

    expect(result.characterName).toBe('Seraphina');
    expect(result.eligibility.isEligible).toBe(true);
    expect(result.decision.decision).toBe('SEND');
    expect(result.decision.confidence).toBeGreaterThan(0.8);
    expect(result.generatedMessagePreview).toBeTruthy();
    expect(result.notificationPreview).toBeDefined();
    expect(result.notificationPreview?.title).toBe('Seraphina');
  });

  it('should simulate quiet hours suppression when mock time falls in overnight quiet window', async () => {
    vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);

    const result = await ProactiveSimulatorService.simulate({
      characterId: 'char-simulator-1',
      mockLocalTime: '2026-09-23T23:45:00Z', // 11:45 PM UTC (Quiet hours 22:30-08:00)
      userTimezone: 'UTC',
      simulateRecentInteractionHours: 12,
    });

    expect(result.eligibility.isEligible).toBe(false);
    expect(result.eligibility.quietHoursActive).toBe(true);
    expect(result.decision.decision).toBe('WAIT');
    expect(result.generatedMessagePreview).toBeNull();
  });

  it('should simulate cooldown suppression when last interaction was too recent', async () => {
    vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);

    const result = await ProactiveSimulatorService.simulate({
      characterId: 'char-simulator-1',
      mockLocalTime: '2026-09-23T15:00:00Z',
      userTimezone: 'UTC',
      simulateRecentInteractionHours: 2, // 2 hours < 6 hours minimum cooldown
    });

    expect(result.eligibility.isEligible).toBe(false);
    expect(result.eligibility.cooldownActive).toBe(true);
    expect(result.decision.decision).toBe('WAIT');
  });
});
