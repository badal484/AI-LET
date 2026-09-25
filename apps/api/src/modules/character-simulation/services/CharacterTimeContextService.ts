import type { TimeContextDTO } from '@ai-companion/types';

export class CharacterTimeContextService {
  private static instance: CharacterTimeContextService;

  private constructor() {}

  public static getInstance(): CharacterTimeContextService {
    if (!CharacterTimeContextService.instance) {
      CharacterTimeContextService.instance = new CharacterTimeContextService();
    }
    return CharacterTimeContextService.instance;
  }

  /**
   * Resolves authoritative server time context for a user and character.
   * Handles timezone offsets, time of day classification, and elapsed duration.
   */
  public getTimeContext(
    userTimezone: string = 'UTC',
    lastInteractionAt?: Date | string | null,
    now: Date = new Date()
  ): TimeContextDTO {
    const tz = this.sanitizeTimezone(userTimezone);

    let localDateString = now.toISOString().split('T')[0] || '';
    let dayOfWeek = 'Monday';
    let hour = now.getUTCHours();

    try {
      // Format with timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const weekdayPart = parts.find((p) => p.type === 'weekday')?.value;
      const yearPart = parts.find((p) => p.type === 'year')?.value;
      const monthPart = parts.find((p) => p.type === 'month')?.value;
      const dayPart = parts.find((p) => p.type === 'day')?.value;
      const hourPart = parts.find((p) => p.type === 'hour')?.value;

      if (weekdayPart) dayOfWeek = weekdayPart;
      if (yearPart && monthPart && dayPart) {
        localDateString = `${yearPart}-${monthPart}-${dayPart}`;
      }
      if (hourPart) {
        hour = parseInt(hourPart, 10);
      }
    } catch {
      // Fallback to UTC if timezone invalid
      dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getUTCDay()] || 'Monday';
      hour = now.getUTCHours();
    }

    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'afternoon';
    if (hour >= 5 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
    } else if (hour >= 17 && hour < 22) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }

    let elapsedSeconds: number | null = null;
    if (lastInteractionAt) {
      const lastTime = typeof lastInteractionAt === 'string' ? new Date(lastInteractionAt).getTime() : lastInteractionAt.getTime();
      elapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastTime) / 1000));
    }

    return {
      currentTime: now.toISOString(),
      timezone: tz,
      localDate: localDateString,
      dayOfWeek,
      timeOfDay,
      elapsedSinceLastInteractionSeconds: elapsedSeconds,
    };
  }

  /**
   * Checks whether the current time falls inside quiet hours.
   */
  public isInsideQuietHours(
    quietHoursStart: string = '22:00',
    quietHoursEnd: string = '08:00',
    userTimezone: string = 'UTC',
    now: Date = new Date()
  ): boolean {
    const tz = this.sanitizeTimezone(userTimezone);
    let hour = now.getUTCHours();
    let minute = now.getUTCMinutes();

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const h = parts.find((p) => p.type === 'hour')?.value;
      const m = parts.find((p) => p.type === 'minute')?.value;
      if (h) hour = parseInt(h, 10);
      if (m) minute = parseInt(m, 10);
    } catch {
      hour = now.getUTCHours();
      minute = now.getUTCMinutes();
    }

    const currentMinutes = hour * 60 + minute;
    const [startH = 22, startM = 0] = quietHoursStart.split(':').map((v) => parseInt(v, 10));
    const [endH = 8, endM = 0] = quietHoursEnd.split(':').map((v) => parseInt(v, 10));

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // e.g. 01:00 to 06:00
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight e.g. 22:00 to 08:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  private sanitizeTimezone(tz: string): string {
    if (!tz || typeof tz !== 'string') return 'UTC';
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    } catch {
      return 'UTC';
    }
  }
}
