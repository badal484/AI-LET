# Runbook: AI LLM Provider Outage & Model Fallback

## 1. Symptoms & Alert Triggers
- Prometheus alert `AICircuitBreakerTripped` ($> 50\%$ failure rate over 10 requests).
- API logs showing `AI_PROVIDER_UNAVAILABLE`, `AI_TIMEOUT`, or HTTP 429 / 503 from OpenAI/Anthropic.
- Chat message generation timeouts ($> 30\text{s}$).

## 2. Diagnosis
1. Inspect AI provider router error telemetry in Admin Command Center (`/api/v1/admin/ai`).
2. Query upstream provider status dashboards (e.g. status.openai.com / status.anthropic.com).
3. Validate API key quota balances and account credit limits.

## 3. Mitigation Protocols
1. **Automated Router Fallback**:
   The AI Gateway automatically routes subsequent traffic to the secondary fallback model (`CLAUDE_3_5_SONNET` or `CLAUDE_3_5_HAIKU`).
2. **Manual Forced Fallback**:
   In Admin Command Center $\to$ AI Models, toggle primary model status to `DISABLED` or adjust routing weights to 100% Secondary Provider.
3. **Emergency Token Budget Reduction**:
   If upstream rate limits are enforced, temporarily clamp `SHORT_TERM_CONTEXT_LIMIT` to 10 messages and `RESERVE_OUTPUT_TOKENS` to 400.

## 4. Rollback & Restoral
Once upstream provider status returns to normal operational state:
1. Probe primary provider with 5 synthetic test prompts in Admin Evaluation Playground.
2. If all 5 pass, re-enable primary model routing gradually (20% $\to$ 50% $\to$ 100%).

## 5. Escalation
- **Primary**: AI Platform Engineer On-Call
- **Secondary**: Lead AI Architect
