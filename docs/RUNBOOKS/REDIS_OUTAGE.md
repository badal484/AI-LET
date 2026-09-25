# Runbook: Redis Cache & In-Memory Cluster Outage

## 1. Symptoms & Alert Triggers
- Prometheus alert `RedisNodeDown` or `RedisMemoryPressure` ($> 90\%$).
- API logs showing `ReplyError: OOM command not allowed` or `MaxRetriesPerRequestError`.
- Chat streaming session initiation delays or rate limiter bypassed.

## 2. Diagnosis
1. Inspect Redis cluster state and memory consumption:
   ```bash
   redis-cli -h redis-prod -p 6379 info memory
   redis-cli -h redis-prod -p 6379 cluster info
   ```
2. Identify runaway key explosion or hot keys:
   ```bash
   redis-cli -h redis-prod -p 6379 --bigkeys
   redis-cli -h redis-prod -p 6379 --hotkeys
   ```

## 3. Mitigation Protocols
1. **Evict Ephemeral Cache Keys**:
   Flush non-critical discovery feed caches:
   ```bash
   redis-cli -h redis-prod -p 6379 eval "return redis.call('del', unpack(redis.call('keys', 'cache:discovery:*')))" 0
   ```
2. **Failover to Replica Node**:
   ```bash
   redis-cli -h redis-prod -p 6379 cluster failover
   ```
3. **Application Graceful Fallback**:
   The API automatically falls back to in-memory local caches and direct PostgreSQL queries per the Degradation Matrix.

## 4. Verification
- Verify memory utilization $< 65\%$.
- Verify redis ping latency $< 1\text{ms}$.

## 5. Escalation
- **Primary**: On-Call DevOps Engineer
- **Secondary**: Infrastructure Lead
