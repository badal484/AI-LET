import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProactiveEligibilityService } from '../src/modules/notifications/services/proactiveEligibility.service.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { NotificationService } from '../src/modules/notifications/services/notification.service.js';

vi.mock('../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    character: {
      findUnique: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
    },
    proactiveAction: {
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../src/modules/notifications/services/notification.service.js', () => ({
  NotificationService: {
    getUserPreferences: vi.fn(),
  },
}));

describe('Phase 7: ProactiveEligibilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Quiet Hours Calculation', () => {
    it('should correctly identify quiet hours for overnight window (e.g. 22:30 to 08:00)', () => {
      // 23:30 (11:30 PM) -> inside quiet hours
      const nightDate = '2026-09-23T23:30:00Z';
      const nightResult = ProactiveEligibilityService.isQuietHoursActive(
        true,
        '22:30',
        '08:00',
        'UTC',
        nightDate,
      );
      expect(nightResult.isQuietHours).toBe(true);

      // 03:00 (3:00 AM) -> inside quiet hours
      const earlyMorningDate = '2026-09-23T03:00:00Z';
      const earlyResult = ProactiveEligibilityService.isQuietHoursActive(
        true,
        '22:30',
        '08:00',
        'UTC',
        earlyMorningDate,
      );
      expect(earlyResult.isQuietHours).toBe(true);

      // 14:00 (2:00 PM) -> outside quiet hours
      const afternoonDate = '2026-09-23T14:00:00Z';
      const afternoonResult = ProactiveEligibilityService.isQuietHoursActive(
        true,
        '22:30',
        '08:00',
        'UTC',
        afternoonDate,
      );
      expect(afternoonResult.isQuietHours).toBe(false);
    });

    it('should correctly handle timezone conversions across IANA zones', () => {
      // 18:30 UTC is 00:00 (midnight) in Asia/Kolkata (UTC+5:30)
      const date = '2026-09-23T18:30:00Z';
      const kolkataResult = ProactiveEligibilityService.isQuietHoursActive(
        true,
        '22:30',
        '08:00',
        'Asia/Kolkata',
        date,
      );
      expect(kolkataResult.isQuietHours).toBe(true);

      // 18:30 UTC is 14:30 (2:30 PM) in America/New_York (EDT UTC-4)
      const nyResult = ProactiveEligibilityService.isQuietHoursActive(
        true,
        '22:30',
        '08:00',
        'America/New_York',
        date,
      );
      expect(nyResult.isQuietHours).toBe(false);
    });

    it('should correctly identify quiet hours for same-day window (e.g. 01:00 to 06:00)', () => {
      const dateInside = '2026-09-23T03:30:00Z';
      const dateOutside = '2026-09-23T10:00:00Z';

      expect(ProactiveEligibilityService.isQuietHoursActive(true, '01:00', '06:00', 'UTC', dateInside).isQuietHours).toBe(true);
      expect(ProactiveEligibilityService.isQuietHoursActive(true, '01:00', '06:00', 'UTC', dateOutside).isQuietHours).toBe(false);
    });
  });

  describe('Full Eligibility Evaluation Pipeline', () => {
    const mockUser = { id: 'user-1', status: 'ACTIVE' };
    const mockPrefs = {
      userId: 'user-1',
      pushEnabled: true,
      proactivityEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:30',
      quietHoursEnd: '08:00',
      timezone: 'UTC',
      maxDailyNotifications: 2,
      maxWeeklyNotifications: 10,
      characterOverrides: null,
    };
    const mockCharacter = {
      id: 'char-1',
      status: 'PUBLISHED',
      isProactiveEnabled: true,
      currentPublishedVersion: {
        id: 'ver-1',
        isProactiveEnabled: true,
        proactivityConfigData: {
          enabled: true,
          minInteractionCooldownHours: 6,
          maxDailyProactive: 2,
        },
      },
    };

    it('should pass eligibility when all conditions are satisfied during daytime', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(NotificationService.getUserPreferences).mockResolvedValue(mockPrefs as any);
      vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);
      // No recent message within 10m
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
        id: 'conv-1',
        messages: [{ createdAt: new Date(Date.now() - 60 * 60 * 1000) }],
      } as any);
      // Under daily/weekly limits
      vi.mocked(prisma.proactiveAction.count).mockResolvedValue(0);
      // No recent actions in cooldown
      vi.mocked(prisma.proactiveAction.findMany).mockResolvedValue([]);

      const result = await ProactiveEligibilityService.evaluateEligibility(
        'user-1',
        'char-1',
        { mockLocalTime: '2026-09-23T14:00:00Z', userTimezone: 'UTC' },
      );

      expect(result.isEligible).toBe(true);
      expect(result.reason).toContain('satisfied');
    });

    it('should reject when quiet hours are currently active', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(NotificationService.getUserPreferences).mockResolvedValue(mockPrefs as any);
      vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);

      const result = await ProactiveEligibilityService.evaluateEligibility(
        'user-1',
        'char-1',
        { mockLocalTime: '2026-09-23T23:30:00Z', userTimezone: 'UTC' },
      );

      expect(result.isEligible).toBe(false);
      expect(result.skipReason).toBe('QUIET_HOURS');
    });

    it('should reject when user has an active conversation within the 10-minute buffer', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(NotificationService.getUserPreferences).mockResolvedValue(mockPrefs as any);
      vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);
      // Recent message 3 minutes ago
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
        id: 'conv-1',
        messages: [{ createdAt: new Date(Date.now() - 3 * 60 * 1000) }],
      } as any);

      const result = await ProactiveEligibilityService.evaluateEligibility(
        'user-1',
        'char-1',
        { mockLocalTime: '2026-09-23T14:00:00Z', userTimezone: 'UTC' },
      );

      expect(result.isEligible).toBe(false);
      expect(result.skipReason).toBe('RECENT_USER_ACTIVITY');
    });

    it('should reject when daily notification cap is reached', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(NotificationService.getUserPreferences).mockResolvedValue(mockPrefs as any);
      vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);
      // Already sent 2 notifications today (cap is 2)
      vi.mocked(prisma.proactiveAction.count).mockResolvedValue(2);

      const result = await ProactiveEligibilityService.evaluateEligibility(
        'user-1',
        'char-1',
        { mockLocalTime: '2026-09-23T14:00:00Z', userTimezone: 'UTC' },
      );

      expect(result.isEligible).toBe(false);
      expect(result.skipReason).toBe('DAILY_LIMIT_EXCEEDED');
    });

    it('should reject with DISENGAGED_COOLDOWN when 3 or more consecutive actions had no user reply', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(NotificationService.getUserPreferences).mockResolvedValue(mockPrefs as any);
      vi.mocked(prisma.character.findUnique).mockResolvedValue(mockCharacter as any);
      vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.proactiveAction.count).mockResolvedValue(0);

      // 3 unreplied actions sent 12 hours ago (within 72h disengagement window)
      vi.mocked(prisma.proactiveAction.findMany).mockResolvedValue([
        { id: 'act-1', status: 'SENT', createdAt: new Date(Date.now() - 12 * 3600 * 1000) },
        { id: 'act-2', status: 'DELIVERED', createdAt: new Date(Date.now() - 24 * 3600 * 1000) },
        { id: 'act-3', status: 'SENT', createdAt: new Date(Date.now() - 36 * 3600 * 1000) },
      ] as any);

      const result = await ProactiveEligibilityService.evaluateEligibility(
        'user-1',
        'char-1',
        { mockLocalTime: '2026-09-23T14:00:00Z', userTimezone: 'UTC' },
      );

      expect(result.isEligible).toBe(false);
      expect(result.skipReason).toBe('DISENGAGED_COOLDOWN');
      expect(result.reason).toContain('consecutive proactive notifications');
    });
  });
});
