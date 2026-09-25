# Runbook: API Gateway & Core Service Outage

## 1. Symptoms & Alert Triggers
- Prometheus alert `High5xxErrorRate` ($> 1\%$ 5xx errors for $> 2\text{ minutes}$).
- P95 API Latency alert ($> 1,500\text{ms}$).
- Cloudflare edge returning 502 / 504 bad gateway responses.

## 2. Diagnosis
1. Inspect API pod status and crash loops:
   ```bash
   kubectl get pods -n production -l app=ai-companion-api
   kubectl logs -n production -l app=ai-companion-api --tail=100 --prefix
   ```
2. Check memory/CPU starvation or deadlocks:
   ```bash
   kubectl top pods -n production -l app=ai-companion-api
   ```
3. Check database connection pool exhaustion or Postgres lock waits.

## 3. Mitigation Protocols
1. **Scale Replicas**: If high traffic load is saturating pods:
   ```bash
   kubectl scale deployment ai-companion-api -n production --replicas=12
   ```
2. **Restart Unhealthy Pods**: If memory leak or blocked event loop:
   ```bash
   kubectl rollout restart deployment/ai-companion-api -n production
   ```
3. **Activate Rate Limiter Emergency Throttle**:
   Adjust `RATE_LIMIT_MAX_REQUESTS` in ConfigMap or activate Cloudflare under-attack mode.

## 4. Rollback Strategy
If outage coincided with a recent deployment:
```bash
kubectl rollout undo deployment/ai-companion-api -n production
```

## 5. Verification
- Verify HTTP 200 responses on `/health` and `/api/v1/health`.
- Confirm 5xx error rate drops below 0.05% in Grafana dashboard.

## 6. Escalation
- **Primary**: On-Call SRE Lead
- **Secondary**: Backend Platform Lead
