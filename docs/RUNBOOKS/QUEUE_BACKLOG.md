# Runbook: Background Queue Backlog & Worker Saturation

## 1. Symptoms & Alert Triggers
- Prometheus alert `BullMQQueueDepthHigh` (Queue depth $> 1,000$ jobs).
- Alert `JobAgeCritical` (Oldest waiting job $> 120\text{s}$).
- Worker memory consumption $> 85\%$.

## 2. Diagnosis
1. Inspect BullMQ queue metrics across queues:
   - `critical`: Billing reconciliation, safety moderation.
   - `standard`: Memory extraction, proactive notification scanner.
   - `batch`: Character discovery indexing, analytics rollups.
2. Check worker pod CPU/Memory and error rates in worker logs:
   ```bash
   kubectl logs -n production -l app=ai-companion-worker --tail=100
   ```

## 3. Mitigation Protocols
1. **Autoscale Worker Pods**:
   ```bash
   kubectl scale deployment ai-companion-worker -n production --replicas=8
   ```
2. **Apply Queue Backpressure**:
   Pause low-priority background queues temporarily:
   ```bash
   curl -X POST https://api.production/api/v1/admin/operations/queues/pause?queue=batch -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
3. **Flush Poison / Stalled Jobs to Dead Letter Queue (DLQ)**:
   Trigger DLQ purge for repeatedly crashing job signatures.

## 4. Verification
- Verify queue depth drops below 100 jobs within 5 minutes.
- Confirm job completion rate $> 50\text{ jobs/s}$.

## 5. Escalation
- **Primary**: Backend / Infrastructure On-Call
- **Secondary**: SRE Lead
