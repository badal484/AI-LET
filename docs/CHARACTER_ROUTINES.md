# CHARACTER ROUTINES & RECURRING RITUALS

## 1. Overview

`CharacterRoutine` defines recurring character habits, check-ins, or thematic rituals (e.g., daily morning reflection, weekly reading recap). Routines are governed schedules, not unconstrained background loops.

---

## 2. Configuration Schema

```typescript
interface CharacterRoutineItem {
  id: string;
  characterId: string;
  name: string;
  description?: string;
  routineType: 'MORNING_REFLECTION' | 'WEEKLY_CHECKIN' | 'CUSTOM_RITUAL' | 'STUDY_SESSION';
  scheduleCron: string; // e.g. "0 9 * * *"
  timezone: string; // IANA format, e.g. "America/New_York"
  active: boolean;
  cooldownMinutes: number; // Minimum gap between executions
  frequencyLimitPerDay: number; // Maximum executions per 24-hour window
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "08:00"
  maxOccurrences?: number;
}
```

---

## 3. Execution & Safety Controls

1. **Quiet Hours Enforcement**:
   - The scheduler queries the user's localized time via `CharacterTimeContextService`.
   - If the current local time falls within quiet hours (e.g., 22:00 - 08:00), execution is postponed or dropped.
2. **Bounded Catch-Up Policy**:
   - If a routine worker is down for extended hours, it never blindly executes every missed occurrence. It executes at most 1 missed occurrence (`maxCatchUpOccurrences: 1`).
3. **Fatigue & Frequency Caps**:
   - Routines enforce per-day caps (`frequencyLimitPerDay`) and minimum cooldowns (`cooldownMinutes`) to prevent conversational spam.
4. **Proactive Hand-Off**:
   - Completed routines that yield proactive outreach do NOT directly send notifications. They generate a `proactive_candidate` consumed by `ProactiveDecisionEngine`.
