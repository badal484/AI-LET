# Disaster Recovery Procedures & Simulation Drills

## 1. RPO & RTO Targets

| System Component | Recovery Point Objective (RPO) | Recovery Time Objective (RTO) | Strategy |
| :--- | :--- | :--- | :--- |
| **Billing Ledger & Credits** | 0 seconds (zero data loss) | &lt; 5 minutes | Synchronous PostgreSQL ACID transactions with WAL archiving |
| **User Accounts & Profiles** | &lt; 1 minute | &lt; 15 minutes | Multi-AZ RDS synchronous replication + Point-in-Time Recovery |
| **Conversations & Messages** | &lt; 5 minutes | &lt; 15 minutes | Continuous WAL replication and 30-day snapshot history |
| **Search Documents & Vectors**| &lt; 1 hour | &lt; 30 minutes | Rebuildable from canonical Character tables via async reindexer |
| **Redis Caches & Locks** | &lt; 1 hour | &lt; 5 minutes | Auto-rebuilding from database source of truth upon reconnect |
| **S3 Media Assets** | 0 seconds | &lt; 15 minutes | AWS S3 Versioning and Cross-Region Replication (CRR) |

---

## 2. Step-by-Step Recovery Drills

### Scenario A: Primary Database Regional Failure
1. **Detection:** CloudWatch alarm triggers on `DatabaseConnectionLoss` or RDS health failure.
2. **Action:** If automatic failover does not occur within 60s, promote standby replica:
   ```bash
   aws rds failover-db-cluster --db-cluster-identifier ai-companion-cluster
   ```
3. **Application Verification:** Verify API health returns 200 on `/health/ready`.
4. **Data Verification:**
   ```sql
   SELECT count(*) FROM "User";
   SELECT count(*) FROM "Conversation";
   SELECT max("createdAt") FROM "Message";
   ```

### Scenario B: Redis Cluster Crash
1. **Detection:** API logs show `RedisConnectionError`.
2. **Action:**
   - Rate limiters automatically degrade to local in-memory sliding window.
   - Cache reads fall back to database queries.
   - BullMQ workers pause and wait for reconnection.
3. **Restoration:**
   ```bash
   aws elasticache reboot-cache-cluster --cache-cluster-id ai-companion-redis-001
   ```
4. **Verification:** Check `/health/dependencies` returns `redis.isHealthy: true`.

### Scenario C: Complete Cloud Outage / Cross-Region Disaster Recovery
1. Restore latest RDS snapshot in DR region (`us-west-2`).
2. Run Terraform apply against `us-west-2` environment definition.
3. Update Route53 DNS latency records to point traffic to DR Application Load Balancer.
4. Verify end-to-end user chat streaming in staging health check.
