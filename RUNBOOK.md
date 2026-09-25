# AI Companion Platform — Production Operational Runbooks

## 1. Incident Severity Levels & Response Matrix

| Severity | Definition | Target Acknowledgment | Target Resolution | Escalation Authority |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core service unavailable (chat down, database down, billing corruption, security breach) | &lt; 5 minutes | &lt; 30 minutes | Incident Commander, VP Engineering |
| **SEV-2 (High)** | Degradation of major feature (AI fallback active, voice service down, image generation down) | &lt; 15 minutes | &lt; 2 hours | Subsystem Tech Lead |
| **SEV-3 (Medium)** | Non-critical background task delay (recommendation recalculation delayed, analytics queue spike) | &lt; 1 hour | &lt; 8 hours | On-Call Engineer |
| **SEV-4 (Low)** | Minor cosmetic or non-customer facing admin glitch | Next business day | Next sprint release | Engineering Team |

---

## 2. Emergency Incident Response Procedure

1. **Acknowledge & Triage:**
   - Create incident channel: `#inc-YYYYMMDD-<short-name>`
   - Appoint **Incident Commander (IC)** and **Communications Lead**.
2. **Mitigate Immediate Impact:**
   - If a provider or feature is failing, activate the corresponding **Operational Kill Switch** via Admin Studio (`/admin/infrastructure`).
   - If bad code was deployed, trigger **Zero-Downtime Rollback**.
3. **Assess Data Integrity:**
   - Verify PostgreSQL transaction logs and Redis replication health.
4. **Resolve & Validate:**
   - Follow specific subsystem runbooks below.
5. **Postmortem:**
   - Conduct blameless postmortem within 48 hours documenting root cause, timeline, contributing factors, and preventative action items.

---

## 3. Subsystem Outage Runbooks

### A. Database Outage & Point-In-Time Recovery (PITR)
- **Symptom:** API logs show `Prisma connection timeout` or 503 errors on `/health/ready`.
- **Immediate Action:**
  1. Check AWS RDS console for automatic Multi-AZ failover status.
  2. If instance corrupted, initiate Point-in-Time Recovery to timestamp immediately preceding incident:
     ```bash
     aws rds restore-db-instance-to-point-in-time \
       --source-db-instance-identifier ai-companion-production-postgres \
       --target-db-instance-identifier ai-companion-postgres-recovered \
       --restore-time 2026-09-24T04:30:00.000Z
     ```
  3. Update `DATABASE_URL` in AWS Secrets Manager / ECS task definition and perform rolling deployment.
  4. Run validation queries: `SELECT count(*) FROM "User"; SELECT count(*) FROM "Conversation";`.

### B. Redis Cluster Outage & Cache Rebuild
- **Symptom:** Redis latency spike or connection refused errors.
- **Behavior:**
  - Database acts as authoritative source of truth.
  - Rate limiters degrade to in-memory sliding windows.
  - BullMQ workers pause and reconnect automatically.
- **Recovery:**
  1. Reconnect or restart ElastiCache cluster nodes.
  2. Verify cache keys warmup from database on next requests.
  3. Clear deadlocks: `redis-cli -h <host> -p 6379 FLUSHDB` (if cache corruption confirmed).

### C. Third-Party AI Provider Outage (OpenAI / Anthropic / Google)
- **Symptom:** Upstream 504 / 502 or 429 rate limit errors from model providers.
- **Behavior:**
  - Circuit breakers (`CircuitBreaker`) automatically open after 4 consecutive failures.
  - Traffic automatically falls back to secondary provider (`Anthropic Claude 3.5` or `Google Gemini Flash`).
  - If all external providers fail, returns a safe neutral response rather than crashing or fabricating data.
- **Manual Intervention:**
  1. Check `/admin/infrastructure` Circuit Breakers panel.
  2. Toggle `DISABLE_EXPENSIVE_MODELS` if quota exhaustion suspected.
  3. After upstream provider recovers, click **"Reset All Breakers"**.

### D. Queue Backlog & Dead Letter Queue (DLQ) Recovery
- **Symptom:** Queue depth &gt; 10,000 jobs or growing DLQ count.
- **Action:**
  1. Scale worker containers via ECS Fargate:
     ```bash
     aws ecs update-service --cluster ai-companion-production-cluster --service worker --desired-count 20
     ```
  2. Inspect failed job reasons in Admin Studio (`/admin/infrastructure` &gt; `Queues & DLQ`).
  3. Resolve root cause (e.g. downstream service reachability).
  4. Click **"Retry Job"** or bulk re-enqueue from DLQ.

---

## 4. Deployment & Rollback Procedures

### Standard Zero-Downtime Rollback
1. Identify previous healthy Docker image tag or Git release hash.
2. In AWS ECS / GitHub Actions:
   ```bash
   aws ecs update-service --cluster ai-companion-production-cluster --service api --force-new-deployment --task-definition ai-companion-api:<previous-stable-tag>
   ```
3. Monitor `/health/ready` and p95 latency. Rollback completes within &lt; 2 minutes.
