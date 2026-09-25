# Character Routine Policy & Execution Specification

## 1. Routine Types & Triggers

Routines allow characters to establish believable cadence and habits without infinite execution loops:

| Routine Type | Trigger Condition | Example Use Case |
| :--- | :--- | :--- |
| `TIME_BASED` | Scheduled cron expression | Morning greeting, weekly Sunday reflection |
| `EVENT_BASED` | Specific domain event emitted | Follow up after user concludes discussion of a project |
| `CONVERSATION_BASED` | End-of-conversation wrap-up | Summarize open questions for next session |
| `RELATIONSHIP_BASED` | Relationship stage milestone | Companion congratulates user on shared journey |
| `GOAL_BASED` | Character goal task completion | Initiate reflection on newly learned topic |
| `CONTEXT_BASED` | Explicit contextual shift | Return after extended inactivity |

---

## 2. Mandatory Boundary Safeguards

Every routine is strictly bounded by safety invariants enforced in `CharacterRoutineService`:
1. **Cooldown Window**: Minimum 15 minutes cooldown between executions; default 60 minutes.
2. **Frequency Limit**: Maximum 5 executions per day per routine.
3. **Quiet Hours**: Evaluated in user's local timezone (e.g. `22:00` to `08:00`). Routines will not trigger while the user is sleeping.
4. **Proactive Authority**: Even if a routine triggers, it creates only a **candidate proactive proposal**. Delivery is gated by `ProactiveDecisionEngine` and user notification preferences.
5. **No Infinite Loops**: Routines cannot trigger events that trigger the same routine recursively. Event chain depth is capped at 3.
