# Runbook: PostgreSQL Database Outage & Failover

## 1. Symptoms & Alert Triggers
- Prometheus alert `PostgresConnectionExhaustion` (Pool utilization $> 90\%$).
- API logs showing `SequelizeConnectionError` or `ECONNREFUSED 5432`.
- High disk I/O wait ($> 95\%$) or replication lag alert ($> 30\text{s}$).

## 2. Diagnosis
1. Check active database connection counts and long-running locks:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;
   ```
2. Check PgBouncer connection pool health:
   ```bash
   psql -h pgbouncer-prod -p 6432 -U admin pgbouncer -c "SHOW POOLS;"
   ```

## 3. Mitigation Protocols
1. **Terminate Blocking Long-Running Query**:
   ```sql
   SELECT pg_terminate_backend(blocking_pid);
   ```
2. **Promote Standby Read Replica to Primary**:
   If master hardware or disk fails:
   ```bash
   patronictl -c /etc/patroni/db.yml switchover --master db-node-01 --candidate db-node-02
   ```
3. **Throttling Noncritical DB Workloads**:
   Pause analytics rollup and background memory vector reindexing jobs.

## 4. Rollback & Recovery
If corrupted migration occurred:
1. Stop API traffic by activating Maintenance Mode.
2. Restore from latest point-in-time recovery (PITR) snapshot to a staging database cluster.
3. Validate table row counts and re-point PgBouncer connection string.

## 5. Verification
- Verify database query latency P95 $< 15\text{ms}$.
- Verify zero active connection queue timeouts in API logs.

## 6. Escalation
- **Primary**: Database Administrator (DBA) / Infrastructure Lead
- **Secondary**: Platform Engineering Lead
