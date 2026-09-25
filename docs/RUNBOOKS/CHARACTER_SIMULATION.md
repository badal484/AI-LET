# Operational Runbook: Character Simulation Engine

## 1. System Overview
The Character Simulation Engine coordinates persistent goals, routines, conversational threads, commitments, and behavioral modes for AI companions. It operates asynchronously following conversational events or scheduled routine ticks.

---

## 2. Emergency Kill Switches & Remediation

| Scenario | Symptom | Action / Remediation |
| :--- | :--- | :--- |
| **High AI Cost Spike** | Rapid unexpected spending from simulation calls | Navigate to `/character-simulation` in Admin Console → Click **"Disable All Simulation"** or set `SIMULATION_ENABLED=false` in environment config. |
| **Runaway Routine Loop** | Rapid cyclical triggers on a single character | Deactivate the specific routine via Admin Console or execute `PATCH /api/v1/simulation/routines/:id` with `{ "active": false }`. |
| **Model Outage / Gateway Failure** | Elevated error rates on `SimulationRunRecord` | Engine automatically falls back to deterministic rule synthesis or `NO_ACTION`. Normal conversation chat is completely unaffected. |
| **Redis Outage** | Mutex locking fails | Simulation gracefully degrades to non-locked DB operations without crashing the conversation loop. |
| **Stale / Stuck Goals** | Unresolved goals accumulating for inactive users | Trigger the stale goal batch worker or run `CharacterGoalService.getInstance().processStaleGoals(14)`. |

---

## 3. Standard Operating Procedures (SOPs)

### SOP-01: Replaying a Historical Simulation Run
1. Access the Admin Command Center at `/character-simulation`.
2. Locate the target `SimulationRunRecord` by ID or character name.
3. Switch to the **Simulation Sandbox / Playground** tab.
4. Paste the recorded context hash and click **"Run Simulation (Sandbox Mode)"**.
5. Verify proposals without mutating production user data.

### SOP-02: Auditing Security or Injection Incidents
1. Query `simulation_run_records` where `error_code = 'POLICY_BLOCKED'` or search logs for `SimulationProposalValidator: rejected proposal with injection signature`.
2. Inspect the sanitized proposal and context hash.
3. If necessary, add new banned phrases or update the `CharacterSimulationPolicy`.
