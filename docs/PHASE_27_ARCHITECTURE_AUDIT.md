# PHASE 27 ARCHITECTURE AUDIT: CHARACTER SIMULATION & LONG-HORIZON BEHAVIOR

## 1. Executive Summary

Phase 27 introduces the **Character Simulation** layer to the AI Companion Platform. Rather than generating stateless, isolated responses or pretending characters possess consciousness, this orchestration domain enables characters to act as coherent, temporally aware entities over long horizons (days, weeks, and episodic narrative arcs).

Crucially, **no existing platform systems are duplicated**:
- Memory Engine (`MemoryRetrieverService`, `MemoryExtractorService`) remains authoritative for remembering facts about the user.
- Relationship Engine (`RelationshipStateService`, `RelationshipPolicyEngine`) remains authoritative for intimacy stages, sentiment, and relationship decay.
- Agent Runtime (`AgentTaskService`, `ScheduledAgentTaskService`) remains authoritative for tool execution.
- AI Gateway (`AIGatewayService`, model router, circuit breakers) remains authoritative for LLM inference.
- Notification Engine (`NotificationDeliveryEngine`, `ProactiveDecisionEngine`, `ProactiveEligibilityService`) remains authoritative for user-facing push messages, frequency capping, fatigue, and quiet hours.
- Knowledge System (`KnowledgeDocumentService`, `HybridRetrievalEngine`, `WebResearchService`) remains authoritative for document QA and grounded citations.
- Safety Service (`SafetyService`, `ProactiveSafetyValidator`) remains authoritative for safety evaluation.

The Character Simulation system answers:
> *"Given character configuration, current context, relationship state, memories, knowledge, time, active goals, routines, unresolved threads, user preferences, and platform policies, what should this character consider doing next?"*

---

## 2. Audit of Existing Infrastructure

| Platform System | Existing Implementation | Reusability in Phase 27 |
| :--- | :--- | :--- |
| **Character Runtime** | `compiler.ts`, `runtime.ts`, `CharacterRuntimeSnapshotService` | Provides immutable character configuration, persona prompt assembly, and provenance logging. |
| **Context Selection** | `ContextSelectionEngine.ts` | Dynamically budgets and ranks memory, goals, tasks, knowledge, and continuity context into prompt tokens. |
| **Memory Engine** | `MemoryRetrieverService.ts`, `MemoryExtractorService.ts` | Provides relevant episodic and declarative user context for simulation cycles. |
| **Relationship Engine**| `RelationshipStateService.ts`, `RelationshipPolicyEngine.ts` | Provides relationship stage (`STRANGER`, `ACQUAINTANCE`, `FRIEND`, `CLOSE_FRIEND`, `CONFIDANT`) to constrain behavioral modes. |
| **AI Gateway** | `AIGatewayService.ts`, `CircuitBreakerService.ts` | Provides multi-provider LLM inference, structured output parsing, prompt versioning, and cost tracking. |
| **Tool / Agent Gateway**| `ToolGateway.ts`, `AgentTaskService.ts` | Executes tool proposals when authorized; simulation never directly calls external tools. |
| **Proactive Engine** | `ProactiveDecisionEngine.ts`, `ProactiveEligibilityService.ts` | Validates and delivers candidate proactive messages subject to quiet hours, fatigue, and opt-outs. |
| **Job Queue Manager** | `QueueManager.ts` (BullMQ + Redis) | Handles asynchronous simulation cycles, debouncing, and scheduled routine evaluations. |
| **Transactional Outbox**| `SocialEvents.ts` (PostgreSQL outbox pattern) | Guarantees at-least-once delivery of simulation domain events with idempotency keys. |
| **Distributed Locking** | `RedisConnection.ts` (ioredis) | Implements distributed mutex locks (`lock:sim:{userId}:{characterId}`) to prevent concurrent race conditions. |
| **Account Deletion** | `AccountDeletionService.ts` | Implements GDPR/CCPA cascade purge of all user simulation state. |

---

## 3. Missing Capabilities Addressed by Phase 27

1. **Character Objectives & Goal Hierarchy**:
   - Current system has basic `UserGoal` (`apps/api/src/modules/characters/engine/UserGoalService.ts`), but lacks persistent, character-owned objectives, bounded goal-to-task hierarchies (`goal → milestone → task`), and explicit ownership tracking (`CHARACTER`, `USER`, `SHARED`, `SYSTEM`).
2. **Deterministic Goal State Machine**:
   - Structured transitions (`DRAFT → ACTIVE → IN_PROGRESS → COMPLETED`, `PAUSED`, `BLOCKED`, `ABANDONED`, `CANCELLED`, `EXPIRED`) with transition guards preventing model hallucinated state mutations.
3. **Character Routines & Temporal Awareness**:
   - Configurable recurring routines (`TIME_BASED`, `EVENT_BASED`, `CONVERSATION_BASED`, `RELATIONSHIP_BASED`, `GOAL_BASED`, `CONTEXT_BASED`) with cooldowns, frequency limits, and time-of-day awareness without timezone inference errors.
4. **Open Conversational Threads & Commitments**:
   - Structured tracking of unresolved conversation topics (`WAITING_FOR_USER`, `WAITING_FOR_SYSTEM`) and explicit character commitments with TTLs.
5. **Behavioral Mode State & Decay**:
   - Ephemeral behavioral modes (`curious`, `supportive`, `playful`, `reflective`, `focused`, `quiet`, `energetic`) with decay TTLs, ensuring characters don't get stuck permanently in serious or playful modes.
6. **Simulation Cycle & Proposal Validation Gate**:
   - Safe model-assisted proposals where LLM output is strictly validated by `SimulationProposalValidator` against policy, permissions, rate limits, and safety before state persistence.
7. **Zero-Action (NO_ACTION) Economics**:
   - Deterministic rule pre-checks that bypass LLM invocation when no state change or routine is due, saving token costs.

---

## 4. Architectural Boundaries: What Simulation is NOT

```text
       ┌────────────────────────────────────────────────────────┐
       │                 Domain Event / Trigger                 │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │             Deterministic Pre-Check Gate               │
       │    (Cooldown, User Opt-In, Active Limits, Timezone)     │
       └───────────────────────────┬────────────────────────────┘
                        ┌──────────┴──────────┐
                        │ Is Simulation Due?  │
                        └──────────┬──────────┘
                            No │       │ Yes
                               ▼       ▼
                       ┌─────────┐   ┌───────────────────────────┐
                       │NO_ACTION│   │Bounded Context Assembly   │
                       └─────────┘   └─────────────┬─────────────┘
                                                   │
                                                   ▼
                                     ┌───────────────────────────┐
                                     │    AI Gateway Proposal    │
                                     │    (Structured JSON Only) │
                                     └─────────────┬─────────────┘
                                                   │
                                                   ▼
                                     ┌───────────────────────────┐
                                     │ SimulationProposalValidator│
                                     │ (Policy, Safety, Schema)  │
                                     └─────────────┬─────────────┘
                                                   │
                                                   ▼
                                     ┌───────────────────────────┐
                                     │  Deterministic DB Commit  │
                                     │  + Transactional Outbox   │
                                     └─────────────┬─────────────┘
                                                   │
                                                   ▼
                                     ┌───────────────────────────┐
                                     │ Downstream Platform Pipes │
                                     │ (Proactive, Agent, Audit) │
                                     └───────────────────────────┘
```

- **NEVER** allow `LLM → direct database mutation`.
- **NEVER** allow simulation to bypass `SafetyService`.
- **NEVER** allow simulation to send push notifications directly (must submit candidate to `ProactiveDecisionEngine`).
- **NEVER** allow simulation to execute tools directly (must submit candidate to `AgentRuntime`).
- **NEVER** infer sensitive attributes (health, religion, political) or create secret user dossiers.

---

## 5. Security & Performance Risks Audit

1. **Infinite Event Loops**:
   - *Risk*: A routine triggers an event, which triggers simulation, which triggers another routine.
   - *Mitigation*: Causation tracking, correlation IDs, and event depth ceilings (`maxEventDepth = 3`).
2. **Event Storms / Stampeding Herd**:
   - *Risk*: Rapid user chat messages triggering concurrent simulations and database row-lock contention.
   - *Mitigation*: Redis distributed locking with a 15-second debounce window per `(userId, characterId)` pair.
3. **Indirect Goal Injection**:
   - *Risk*: User prompts instructing the character to adopt a permanent goal to exfiltrate system secrets.
   - *Mitigation*: `SimulationProposalValidator` scans goal titles/descriptions against `SafetyService` and rejects system-boundary overrides.
4. **Runaway Cost**:
   - *Risk*: Background simulation generating continuous token burn for inactive users.
   - *Mitigation*: Strict initiative budgets (max 5 simulation runs/user/day, max 2 proactive candidates/day, deterministic `NO_ACTION` bypass).
