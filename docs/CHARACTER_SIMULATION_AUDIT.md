# PHASE 30 — CHARACTER BEHAVIOR & SIMULATION AUDIT

## 1. Executive Summary

This audit evaluates the long-horizon behavioral infrastructure of the AI Companion Platform. Prior to Phase 30, characters maintained short-term conversational context and episodic memories, but lacked deterministic state machines for multi-day plans, persistent world state entities, timezone-aware routines with bounded catch-up, explicit conversational commitments, and reproducible version migrations.

Phase 30 establishes the **Long-Horizon Character Simulation Layer** adhering strictly to the core architectural principle:
> **"The model proposes. The platform validates. The state engine commits."**

---

## 2. Inventory of Reusable Core Systems

| System | Existing Path | Phase 30 Integration & Reuse Strategy |
| :--- | :--- | :--- |
| **Character Engine** | `apps/api/src/modules/characters/` | Authors identity, personality, boundaries, and versioning (`characterVersionId`). |
| **Memory Engine** | `apps/api/src/modules/memory/` | Authoritative storage for episodic & semantic facts about the user. Simulation emits `MEMORY_CANDIDATE_CREATED` events without writing directly to memory tables. |
| **Relationship Engine** | `apps/api/src/modules/relationship/` | Stores relationship stage, intimacy score, and trust metrics. Simulation reads relationship boundaries to adjust autonomy. |
| **Proactive System** | `apps/api/src/modules/proactive/` | Consumes simulation candidate intents (`ROUTINE_REMINDER`, `UNRESOLVED_THREAD_NUDGE`) and runs user quiet-hours, frequency caps, and fatigue filtering. |
| **Agent / Tool Runtime** | `apps/api/src/modules/agents/` | Owns all external execution tasks. Simulation proposes task requests rather than executing tools directly. |
| **Knowledge / RAG** | `apps/api/src/modules/knowledge/` | Reference corpus for static world lore and character knowledge bases. |
| **Safety Service** | `apps/api/src/modules/safety/` | Validates all model proposals against platform rules and manipulative retention boundaries. |
| **Notification Service** | `apps/api/src/modules/notifications/` | Delivers user notifications across mobile APNs/FCM channels. |
| **Transactional Outbox / Event Bus** | `apps/api/src/modules/events/` | Emits immutable domain events (`character.goal.updated.v1`, `character.world_state.updated.v1`). |

---

## 3. Analysis of Duplicated Concepts & Boundary Violations Prevented

1. **Simulation vs Memory**:
   - *Violation Prevented*: Storing conversational facts in unstructured memory blobs as "simulation state".
   - *Enforced Boundary*: Memory stores what was said/retained about the user. Simulation stores the active state machine of character objectives, step plans, and persistent fictional world state.
2. **Simulation vs Relationship**:
   - *Violation Prevented*: Simulation mutating relationship intimacy scores upon goal completion.
   - *Enforced Boundary*: Simulation emits domain events; RelationshipEngine independently updates relationship metrics.
3. **Simulation vs Proactive Messaging**:
   - *Violation Prevented*: Simulation worker directly dispatching push notifications.
   - *Enforced Boundary*: Simulation generates bounded `proactive_candidate` records submitted to Proactive Engine's candidate pool.
4. **Simulation vs Agent Tasks**:
   - *Violation Prevented*: Character simulation running autonomous bash/API scripts.
   - *Enforced Boundary*: External actions require Agent Runtime confirmation and Tool Gateway authorization.

---

## 4. Current State Ownership & Persistence Model

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        STATE OWNERSHIP TAXONOMY                        │
├─────────────────────────┬─────────────────────────┬────────────────────┤
│ Scope                   │ Entity                  │ Storage Table      │
├─────────────────────────┼─────────────────────────┼────────────────────┤
│ Character-Global        │ Character Goals         │ CharacterGoal      │
│ Character-Global        │ Scheduled Routines      │ CharacterRoutine   │
│ Character-Global        │ Persistent World Lore   │ CharacterWorldState│
│ User-Character Pair     │ Multi-Step Plans        │ CharacterPlan      │
│ User-Character Pair     │ Plan Steps & Dep Graph  │ CharacterPlanStep  │
│ User-Character Pair     │ Commitments             │ CharacterCommitment│
│ User-Character Pair     │ User Autonomy Settings  │ UserSimSettings    │
│ System / Audit          │ Simulation Events Ledger│ CharacterSimEvent  │
│ System / Audit          │ World State Event Stream│ CharacterWSEvent   │
└─────────────────────────┴─────────────────────────┴────────────────────┘
```

---

## 5. Consistency & Concurrency Risks

- **Race Conditions in Multi-Device Conversations**: Mitigated via Redis distributed locking (`simulation:lock:{characterId}:{userId}`) and optimistic version checking on PostgreSQL transactions.
- **Model Hallucination of Prior Commitments**: Mitigated via deterministic source grounding requiring `sourceMessageId` or `sourceEventId` references before commitments or goal updates are committed.
- **Stale Context / Token Budget Overflow**: Mitigated by `SimulationContextPackService` enforcing a strict token budget (< 250 tokens) ranking objectives by priority, recency, and relationship relevance.
- **Runaway Background Model Costs**: Mitigated by deterministic pre-checks (`isRunNeeded` logic) filtering out up to 80% of routine ticks without invoking LLMs.
