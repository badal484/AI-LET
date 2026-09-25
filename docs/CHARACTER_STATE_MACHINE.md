# Character Simulation — State Machine & Transition Specification

## 1. Goal State Machine

The lifecycle of a `CharacterGoal` follows a strictly deterministic finite state machine (FSM). LLMs cannot directly write status strings to the database; every proposal must pass `CharacterGoalService.isValidTransition(currentStatus, targetStatus)`.

```
                ┌──────────────┐
                │    DRAFT     │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐ ◄────── (Refresh / Unpause)
                │    ACTIVE    │
                └──────┬───────┘
                       │
         ┌─────────────┴─────────────┬─────────────┬─────────────┐
         ▼                           ▼             ▼             ▼
  ┌─────────────┐             ┌───────────┐ ┌───────────┐ ┌───────────┐
  │ IN_PROGRESS │             │  PAUSED   │ │  BLOCKED  │ │  EXPIRED  │
  └──────┬──────┘             └─────┬─────┘ └─────┬─────┘ └───────────┘
         │                          │             │
         ├──────────────────────────┼─────────────┤
         │                          │             │
         ▼                          ▼             ▼
  ┌─────────────┐             ┌───────────┐ ┌───────────┐
  │  COMPLETED  │ (Terminal)  │ ABANDONED │ │ CANCELLED │ (Terminal)
  └─────────────┘             └───────────┘ └───────────┘
                                (Terminal)
```

### Transition Table

| Origin Status | Permitted Target Statuses | Notes |
| :--- | :--- | :--- |
| `DRAFT` | `ACTIVE`, `CANCELLED` | Initial setup phase |
| `ACTIVE` | `IN_PROGRESS`, `PAUSED`, `BLOCKED`, `CANCELLED`, `EXPIRED` | Ready for character engagement |
| `IN_PROGRESS` | `COMPLETED`, `PAUSED`, `BLOCKED`, `ABANDONED`, `CANCELLED`, `EXPIRED` | Incremental task work occurring |
| `PAUSED` | `ACTIVE`, `IN_PROGRESS`, `CANCELLED`, `ABANDONED` | Temporarily inactive |
| `BLOCKED` | `ACTIVE`, `IN_PROGRESS`, `CANCELLED`, `ABANDONED` | Awaiting prerequisite event |
| `EXPIRED` | `ACTIVE` | Inactivity timeout; can be refreshed |
| `COMPLETED` | *None* | Terminal state; records `completedAt` |
| `ABANDONED` | *None* | Terminal state; records `abandonedAt` |
| `CANCELLED` | *None* | Terminal state |

---

## 2. Optimistic Concurrency Control

To prevent race conditions during concurrent conversational events or worker retries:
1. Every `CharacterGoal` and `CharacterSimulationState` row maintains an integer `version` field.
2. Updates require `expectedVersion`. If the record was modified by another transaction in flight, an `OptimisticConcurrencyError` is raised and the transaction is cleanly rolled back or recomputed.
3. Database mutations increment the version atomically: `version: { increment: 1 }`.

---

## 3. Progress Tracking Models

Goals support two complementary progress representations:
1. **Quantitative (0.0 to 1.0)**:
   - When milestone-based, progress is `completedMilestones / totalMilestones`.
   - Reaching `1.0` triggers transition to `COMPLETED` and sets `completedAt = now()`.
2. **Qualitative Stages**:
   - `NOT_STARTED` → `EARLY` → `DEVELOPING` → `ADVANCED` → `NEAR_COMPLETE` → `COMPLETE`.

---

## 4. Open Conversational Threads Lifecycle

```
    ┌──────────────┐
    │     OPEN     │ ──(Waiting for user reply)──► ┌───────────────────┐
    └──────┬───────┘                               │ WAITING_FOR_USER  │
           │                                       └─────────┬─────────┘
           ▼                                                 │
    ┌──────────────┐                                         │
    │   RESOLVED   │ ◄───────────────────────────────────────┘
    └──────────────┘
           ▲
           │
    ┌──────────────┐ (TTL Expiration / User Dismissal)
    │  DISMISSED   │ / EXPIRED
    └──────────────┘
```

Threads maintain a default 72-hour TTL. If an unresolved topic is not addressed or renewed within the TTL window, it automatically transitions to `EXPIRED` without spamming the user.

---

## 5. Behavioral Demeanor Decay

Behavior modes (`curious`, `reflective`, `supportive`, `playful`, `focused`, `quiet`, `energetic`) are transient behavioral filters:
- Each mode stores `behaviorExpiresAt` (default TTL: 12–24 hours).
- When `now() > behaviorExpiresAt`, the continuity compiler automatically decays the mode back to the character's baseline (`supportive`).
- A character will never remain locked in an inappropriate emotional state permanently.
