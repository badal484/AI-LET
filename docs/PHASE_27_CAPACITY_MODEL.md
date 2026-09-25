# Phase 27 — Capacity Model & Infrastructure Scaling

## 1. Projected Workload Assumptions

| Metric | 10k Daily Active Users (DAU) | 100k DAU | 1M DAU |
| :--- | :--- | :--- | :--- |
| **Conversations per Day** | 50,000 | 500,000 | 5,000,000 |
| **Simulation Trigger Events** | 60,000 | 600,000 | 6,000,000 |
| **Zero-Action Deterministic Bypasses (75%)** | 45,000 | 450,000 | 4,500,000 |
| **Model Invocations (25%)** | 15,000 | 150,000 | 1,500,000 |
| **Input Tokens per Call (avg)** | 350 tokens | 350 tokens | 350 tokens |
| **Output Tokens per Call (avg)** | 80 tokens | 80 tokens | 80 tokens |
| **Daily AI Cost (`gpt-4o-mini`)** | ~$1.20 / day | ~$12.00 / day | ~$120.00 / day |

---

## 2. Database & Cache Footprint

1. **PostgreSQL Writes**:
   - `SimulationRunRecord`: 1 insert per run.
   - `SimulationStateSnapshot`: 1 insert per run with proposed state updates.
   - Indexes on `(userId, characterId)`, `(characterId, status)`, and `(userId, status)` guarantee sub-millisecond query execution.
2. **Redis Footprint**:
   - Key: `lock:sim:{userId}:{characterId}` (15-second TTL).
   - Peak concurrent locks at 100k DAU: ~250 keys (< 50 KB memory).
   - Zero Redis persistence required: PostgreSQL is the single source of truth.

---

## 3. Worker Throughput & Backpressure
- Job debouncing guarantees that rapid back-to-back user messages result in at most **1 simulation cycle per 15-second window**.
- BullMQ worker queues run with bounded concurrency (default: 10 concurrent jobs per worker container), preventing database connection saturation.
