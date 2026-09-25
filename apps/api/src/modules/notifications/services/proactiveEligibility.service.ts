import { prisma } from '../../../infrastructure/database/prisma.js';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';
import { NotificationService } from './notification.service.js';
import type {
  ProactiveSkipReason,
  UserNotificationPreferenceData,
} from '@ai-companion/types';

export interface EligibilityResult {
  isEligible: boolean;
  skipReason?: ProactiveSkipReason;
  reason: string;
  userPreferences?: UserNotificationPreferenceData;
  characterVersionId?: string;
}

export interface EligibilityEvaluationOptions {
  mockLocalTime?: string; // For testing / simulation
  userTimezone?: string;
  simulateRecentInteractionHours?: number;
}

export class ProactiveEligibilityService {
  /**
   * Evaluates comprehensive multi-tiered eligibility rules before running expensive AI generations.
   */
  public static async evaluateEligibility(
    userId: string,
    characterId: string,
    options?: EligibilityEvaluationOptions,
  ): Promise<EligibilityResult> {
    // 1. User Status Check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return {
        isEligible: false,
        skipReason: 'USER_DISABLED_PROACTIVITY',
        reason: 'User account is not active, suspended, or deleted.',
      };
    }

    // 2. User Notification Preferences Check
    const userPrefs = await NotificationService.getUserPreferences(userId);
    if (!userPrefs.proactivityEnabled) {
      return {
        isEligible: false,
        skipReason: 'USER_DISABLED_PROACTIVITY',
        reason: 'User has disabled proactive AI messaging in personalization settings.',
        userPreferences: userPrefs,
      };
    }

    // Character-specific override check
    if (userPrefs.characterOverrides && userPrefs.characterOverrides[characterId]) {
      const charOverride = userPrefs.characterOverrides[characterId];
      if (charOverride?.enabled === false) {
        return {
          isEligible: false,
          skipReason: 'USER_DISABLED_PROACTIVITY',
          reason: `User has specifically disabled proactive messaging for character ${characterId}.`,
          userPreferences: userPrefs,
        };
      }
    }

    // 3. Character Status & Published Version Check
    const character = await prisma.character.findUnique({
      where: { id: characterId, deletedAt: null },
      include: { currentPublishedVersion: true },
    });

    if (!character || character.status !== 'PUBLISHED' || !character.currentPublishedVersion) {
      return {
        isEligible: false,
        skipReason: 'CHARACTER_DISABLED',
        reason: 'Character is not published, draft, archived, or lacks an active version snapshot.',
      };
    }

    const version = character.currentPublishedVersion;
    const proactivityConfig = (version.proactivityConfigData as any) || {};

    if (proactivityConfig.enabled === false) {
      return {
        isEligible: false,
        skipReason: 'CHARACTER_DISABLED',
        reason: 'Character configuration has proactivity disabled.',
        characterVersionId: version.id,
      };
    }

    // 4. Quiet Hours Evaluation
    const timezone = options?.userTimezone || userPrefs.timezone || 'UTC';
    const quietHoursCheck = this.isQuietHoursActive(
      userPrefs.quietHoursEnabled,
      userPrefs.quietHoursStart,
      userPrefs.quietHoursEnd,
      timezone,
      options?.mockLocalTime,
    );

    if (quietHoursCheck.isQuietHours) {
      return {
        isEligible: false,
        skipReason: 'QUIET_HOURS',
        reason: `Quiet hours active in timezone ${timezone} (${userPrefs.quietHoursStart} to ${userPrefs.quietHoursEnd}). Local time is ${quietHoursCheck.localTimeString}.`,
        userPreferences: userPrefs,
        characterVersionId: version.id,
      };
    }

    // 5. Active Conversation & Recent Interaction Cooldown
    const conversation = await prisma.conversation.findUnique({
      where: {
        userId_characterId: {
          userId,
          characterId,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (conversation) {
      // Check active generation lock
      if (conversation.generationLockedUntil && conversation.generationLockedUntil > new Date()) {
        return {
          isEligible: false,
          skipReason: 'ACTIVE_GENERATION',
          reason: 'An active AI generation is currently locked and streaming in this conversation.',
          userPreferences: userPrefs,
          characterVersionId: version.id,
        };
      }

      // Check recent user message buffer (10 minutes default)
      if (options?.simulateRecentInteractionHours !== undefined) {
        if (options.simulateRecentInteractionHours < 0.16) {
          // Less than 10 mins
          return {
            isEligible: false,
            skipReason: 'RECENT_USER_ACTIVITY',
            reason: 'User interacted recently (< 10 minutes ago). Active dialogue turn in progress.',
            userPreferences: userPrefs,
            characterVersionId: version.id,
          };
        }
      } else if (conversation.messages.length > 0) {
        const lastMsg = conversation.messages[0];
        if (lastMsg) {
          const minutesSinceLastMsg = (Date.now() - new Date(lastMsg.createdAt).getTime()) / (1000 * 60);
          if (minutesSinceLastMsg < SYSTEM_CONSTANTS.PROACTIVITY.RECENT_INTERACTION_BUFFER_MINUTES) {
            return {
              isEligible: false,
              skipReason: 'RECENT_USER_ACTIVITY',
              reason: `User interacted ${Math.round(minutesSinceLastMsg)} minutes ago. Conversation is already active.`,
              userPreferences: userPrefs,
              characterVersionId: version.id,
            };
          }
        }
      }
    }

    // 6. Frequency Limits (Daily & Weekly)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [dailySentCount, weeklySentCount, charDailySentCount] = await Promise.all([
      // User daily limit
      prisma.proactiveAction.count({
        where: {
          userId,
          status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'GENERATED', 'QUEUED'] },
          createdAt: { gte: startOfToday },
        },
      }),
      // User weekly limit
      prisma.proactiveAction.count({
        where: {
          userId,
          status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'GENERATED', 'QUEUED'] },
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      // Character daily limit
      prisma.proactiveAction.count({
        where: {
          userId,
          characterId,
          status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'GENERATED', 'QUEUED'] },
          createdAt: { gte: startOfToday },
        },
      }),
    ]);

    const maxDaily = Math.min(
      userPrefs.maxDailyNotifications,
      proactivityConfig.maxDailyMessages || SYSTEM_CONSTANTS.PROACTIVITY.DEFAULT_MAX_DAILY_NOTIFICATIONS,
    );

    if (dailySentCount >= userPrefs.maxDailyNotifications || charDailySentCount >= maxDaily) {
      return {
        isEligible: false,
        skipReason: 'DAILY_LIMIT_EXCEEDED',
        reason: `Daily proactive message cap reached (Sent today: ${dailySentCount}, limit: ${maxDaily}).`,
        userPreferences: userPrefs,
        characterVersionId: version.id,
      };
    }

    if (weeklySentCount >= userPrefs.maxWeeklyNotifications) {
      return {
        isEligible: false,
        skipReason: 'WEEKLY_LIMIT_EXCEEDED',
        reason: `Weekly proactive message cap reached (Sent this week: ${weeklySentCount}, limit: ${userPrefs.maxWeeklyNotifications}).`,
        userPreferences: userPrefs,
        characterVersionId: version.id,
      };
    }

    // 7. Proactive Cooldowns & Disengagement Handling
    const recentActions = await prisma.proactiveAction.findMany({
      where: {
        userId,
        characterId,
        status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (recentActions.length > 0) {
      const lastAction = recentActions[0];
      if (lastAction) {
        const hoursSinceLastAction = (Date.now() - new Date(lastAction.createdAt).getTime()) / (1000 * 60 * 60);
        const minCooldown = proactivityConfig.minInteractionCooldownHours || SYSTEM_CONSTANTS.PROACTIVITY.MIN_COOLDOWN_HOURS;

        if (hoursSinceLastAction < minCooldown) {
          return {
            isEligible: false,
            skipReason: 'COOLDOWN_ACTIVE',
            reason: `Minimum proactive interaction cooldown active (${Math.round(hoursSinceLastAction)}h since last outreach, min required: ${minCooldown}h).`,
            userPreferences: userPrefs,
            characterVersionId: version.id,
          };
        }

        // Count consecutive unreplied proactive messages
        const unrepliedCount = recentActions.filter(a => a.status === 'SENT' || a.status === 'DELIVERED').length;
        if (unrepliedCount >= 3) {
          const extendedCooldown = SYSTEM_CONSTANTS.PROACTIVITY.DISENGAGED_COOLDOWN_HOURS; // 72 hours
          if (hoursSinceLastAction < extendedCooldown) {
            return {
              isEligible: false,
              skipReason: 'DISENGAGED_COOLDOWN',
              reason: `User has not replied to ${unrepliedCount} consecutive proactive notifications. Respecting silence with gentle extended cooldown (${extendedCooldown}h).`,
              userPreferences: userPrefs,
              characterVersionId: version.id,
            };
          }
        }
      }
    }

    return {
      isEligible: true,
      reason: 'All multi-tier eligibility and cooldown policies satisfied.',
      userPreferences: userPrefs,
      characterVersionId: version.id,
    };
  }

  /**
   * Helper to evaluate whether current local time falls within configured quiet hours.
   */
  public static isQuietHoursActive(
    enabled: boolean,
    startStr: string,
    endStr: string,
    timezone: string,
    mockTimeIso?: string,
  ): { isQuietHours: boolean; localTimeString: string } {
    if (!enabled) {
      return { isQuietHours: false, localTimeString: 'Quiet hours disabled' };
    }

    const date = mockTimeIso ? new Date(mockTimeIso) : new Date();

    // Format local time in user's IANA timezone
    let localHours: number;
    let localMinutes: number;

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      localHours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      localMinutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    } catch {
      // Fallback to UTC if timezone is unrecognized
      localHours = date.getUTCHours();
      localMinutes = date.getUTCMinutes();
    }

    const currentMinutes = localHours * 60 + localMinutes;

    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startTotal = (startH ?? 22) * 60 + (startM ?? 30);
    const endTotal = (endH ?? 8) * 60 + (endM ?? 0);

    let isQuiet = false;
    if (startTotal <= endTotal) {
      // Daytime quiet hours e.g. 13:00 to 15:00
      isQuiet = currentMinutes >= startTotal && currentMinutes < endTotal;
    } else {
      // Overnight quiet hours e.g. 22:30 to 08:00
      isQuiet = currentMinutes >= startTotal || currentMinutes < endTotal;
    }

    const localTimeString = `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;

    return {
      isQuietHours: isQuiet,
      localTimeString,
    };
  }
}
