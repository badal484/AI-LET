# CHARACTER SIMULATION OPERATIONS

## 1. Operational Architecture

The Character Simulation Layer operates using BullMQ queues backed by Redis, persisting authoritative state to PostgreSQL 16.

### 1.1 BullMQ Queues
- `character-simulation`: Main cycle queue for user-interaction-triggered simulation evaluations.
- `simulation-evaluation`: Background evaluations for goals and commitments.
- `routine-scheduler`: Cron-triggered recurring routine evaluation.
- `simulation-reconciliation`: Periodic orphan state reconciliation and state consistency audits.
- `simulation-cleanup`: Expired commitment archival and stale snapshot compaction.

---

## 2. Metrics & Observability

Prometheus metrics exposed by `SimulationAnalyticsService`:
- `simulation_runs_total{status="COMPLETED|NO_ACTION|REJECTED|FAILED"}`
- `simulation_model_calls_total{model="gemini-1.5-pro|gpt-4o"}`
- `simulation_proposals_total{type="UPDATE_GOAL|ADVANCE_PLAN|COMPLETE_ROUTINE|..."}`
- `simulation_rejections_total{reason="SAFETY|DEPENDENCY_UNSATISFIED|QUIET_HOURS|..."}`
- `simulation_cycle_latency_ms{quantile="p50|p95|p99"}`
- `simulation_cost_usd_total`
- `simulation_queue_depth{queue="character-simulation|..."}`

---

## 3. Distributed Concurrency & Locking

- Simulation cycles acquire Redis distributed locks with key:
  `simulation:lock:{characterId}:{userId}`
- Lock TTL: 15,000ms with auto-release upon cycle completion or exception.
- State updates in PostgreSQL use optimistic version checking (`version: { increment: 1 }`).
