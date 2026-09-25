# INCIDENT RUNBOOK: CHARACTER SIMULATION & LONG-HORIZON CONTINUITY

## 1. Trigger Conditions & Severity Levels

| Alert | Condition | Severity | Initial Action |
| :--- | :--- | :--- | :--- |
| **`SimulationCostSpike`** | Hourly simulation model cost exceeds $50.00 | P1 | Engage `disableSimulationModelCalls` kill switch |
| **`ProactiveSpamAnomaly`** | Proactive candidates exceed 50/hour for single user | P1 | Engage `disableSimulationProactive` kill switch |
| **`QueueBacklogHigh`** | `routine-scheduler` queue depth > 5,000 | P2 | Scale worker pool; inspect lock contention |
| **`CrossUserLeakAttempt`** | Scope check rejection spike on world state query | P0 | Halt character simulation; audit DB queries |
| **`StateCorruptionDetected`** | Optimistic lock failure rate > 10% | P2 | Inspect concurrent multi-device session storms |

---

## 2. Emergency Kill Switch Procedures

### 2.1 Disable All Simulation Background Processing
```bash
# Execute via Admin API or Redis flag
curl -X PUT http://localhost:4000/api/v1/simulation/kill-switches \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disableCharacterSimulation": true}'
```

### 2.2 Disable Model Calls (Force Deterministic Mode)
```bash
curl -X PUT http://localhost:4000/api/v1/simulation/kill-switches \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disableSimulationModelCalls": true}'
```

---

## 3. Scoped State Reset (GDPR / User Correction)

If a user reports incorrect character continuity or requests data wiping:
```bash
curl -X POST http://localhost:4000/api/v1/simulation/reset/char-aria \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope": "ALL", "userId": "user-test-01"}'
```
Valid scopes: `GOALS`, `PLANS`, `ROUTINES`, `COMMITMENTS`, `WORLD_STATE`, `ALL`.
