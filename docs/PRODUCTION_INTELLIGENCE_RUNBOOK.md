# Production Intelligence & AI Quality Runbook

**Runbook ID:** RB-OPS-022  
**Severity:** Standard / Incident Response  
**Maintainer:** On-Call AI Engineer & Platform Reliability Commander  

---

## 1. Quick Diagnostic Checklist

When investigating an AI anomaly, response failure, or cost spike, follow this 5-step diagnostic sequence:

### Step 1: Check Circuit Breaker Status
Inspect active circuit breakers:
```bash
curl -s http://localhost:4000/api/v1/admin/intelligence/circuit-breakers \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
*If `AI_COST_CIRCUIT_BREAKER` is tripped (`isTripped: true`), models are automatically operating in lightweight fallback mode.*

### Step 2: Fetch Generation Debug Snapshot
Retrieve full context attribution for the offending generation:
```bash
curl -s http://localhost:4000/api/v1/admin/intelligence/debugger/<GENERATION_ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
Inspect:
- Prompt tokens vs Completion tokens.
- Retrieved memory IDs.
- Injected user preferences.
- Moderation flags.

### Step 3: Execute Safe Sandbox Replay
Reproduce the generation against candidate model/prompt without affecting user state:
```bash
curl -s -X POST http://localhost:4000/api/v1/admin/intelligence/replay \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"generationId": "<GENERATION_ID>", "targetModel": "gpt-4o-mini"}'
```

### Step 4: Add Real Failure Case to Regression Suite
If the response violates quality or safety standards, stage it in the regression dataset:
```bash
curl -s -X POST http://localhost:4000/api/v1/admin/intelligence/failures \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "datasetVersion": "evaluation_dataset_v1",
    "category": "hallucination",
    "sanitizedInput": "User question here...",
    "expectedBehavior": "Expected answer...",
    "observedBehavior": "Observed hallucination...",
    "severity": "P1",
    "source": "USER_REPORT",
    "modelVersion": "gpt-4o-mini",
    "promptVersion": "v1.0",
    "characterVersion": "v1.0"
  }'
```

### Step 5: Reset Personalization for Contaminated Profiles
If a user's inferred preferences became contaminated:
```bash
curl -s -X POST http://localhost:4000/api/v1/personalization/reset \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope": "inferred_only"}'
```

---

## 2. Emergency Actions & Overrides

### Emergency Model Rollback
If a newly deployed model exhibits erratic behavior:
1. Revert the model routing config via Admin API or set `ENABLE_SHADOW_MODEL_ROUTING = false`.
2. All traffic will seamlessly fallback to the baseline primary model (`gpt-4o-mini`).

### Manual Circuit Breaker Override
To override or reset a tripped circuit breaker:
```bash
curl -s -X POST http://localhost:4000/api/v1/admin/intelligence/circuit-breakers/override \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI_COST_CIRCUIT_BREAKER",
    "isTripped": false,
    "reason": "Budget limit refreshed for new billing cycle"
  }'
```
