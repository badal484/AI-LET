# AGENT OPERATIONS RUNBOOK & INCIDENT RESPONSE

## 1. Runaway Agent Task or Infinite Tool Loops
### Symptoms
* Spike in task step counts hitting the maximum (`10`).
* Accelerated token consumption and unexpected cost spikes.

### Triage & Mitigation
1. **Activate Global Kill Switch**:
   ```bash
   # In Admin Studio or Redis CLI
   redis-cli SET flag:agent_execution_enabled false
   ```
2. **Terminate Running Tasks**:
   Execute cancellation on active tasks via API:
   `POST /api/v1/admin/agents/tasks/cancel-all?status=executing`
3. **Inspect Task Traces**:
   In Admin Studio, navigate to `/ai/intelligence` → "Agent Tasks & Checkpoints" and identify the offending objective and task loop pattern.
4. **Deploy Step & Tool Limit Adjustments**:
   Update `maxSteps` or lower `maxDurationMs` in configuration.

---

## 2. Tool Abuse or High Failure Rates
### Symptoms
* Elevated 5xx error responses from external APIs (Google Calendar, Web Search).
* `STEP_EXECUTION_FAILED` alerts triggering in BullMQ queues.

### Triage & Mitigation
1. **Disable Specific Offending Tool**:
   ```bash
   redis-cli SET flag:tool_kill_switch:<tool_slug> true
   ```
2. **Check Circuit Breaker Status**:
   In `/ai/models`, verify whether the tool adapter circuit breaker has tripped (`OPEN`).
3. **Inspect Dead Letter Queue (DLQ)**:
   Review failed BullMQ jobs in Redis to diagnose provider rate limits or expired OAuth tokens.

---

## 3. Suspected Prompt Injection / Jailbreak
### Symptoms
* Flagged user reports or SafetyService alerts indicating jailbreak attempts.
* Attempted tool invocation with unauthorized parameters.

### Triage & Mitigation
1. **Inspect Generation Snapshot**:
   Lookup the message ID via `/api/v1/agents/generations/:messageId/explain`.
2. **Review Sanitizer Logs**:
   Confirm whether `ToolResultSanitizer` neutralized the injection pattern.
3. **Quarantine Offending Knowledge Document or Skill**:
   If the prompt injection originated from an ingested document, immediately roll back the document:
   `POST /api/v1/creators/knowledge/:docId/rollback` with target version.

---

## 4. Cost Explosion Incident
### Symptoms
* Daily AI cost exceeding budget threshold (> $500/day).
* High concentration of multimodal or large document extraction requests.

### Triage & Mitigation
1. **Toggle Multimodal Task Flag**:
   ```bash
   redis-cli SET flag:multimodal_tasks_enabled false
   ```
2. **Verify Usage Reservations**:
   Confirm that all tasks are reserving credits in `UsageReservationService` before calling LLMs.
3. **Adjust Creator Sandbox Bounds**:
   Lower creator skill `maxCostUsd` from `$0.50` to `$0.20`.
