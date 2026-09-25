# Developer Platform Incident Response Runbook

Operational procedures for responding to developer platform incidents, security escalations, and abuse events.

---

## 1. Leaked / Compromised Developer API Key

### Severity: HIGH

1. **Immediate Revocation**:
   * Execute immediate key revocation via Admin Console or API:
     ```bash
     curl -X DELETE "https://api.companion.ai/api/v1/developers/projects/{projectId}/keys/{keyId}" \
       -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>"
     ```
2. **Audit Access Logs**:
   * Filter traces for the compromised `apiKeyId` over the last 72 hours.
   * Identify any unauthorized data access or unexpected tool executions.
3. **Notify Developer**:
   * Send automated security notification to the project owner's registered email.

---

## 2. Webhook Outbound Abuse or SSRF Attempt

### Severity: CRITICAL

1. **Automatic SSRF Shield**:
   * Verify that the DNS resolver blocked the private IP (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, etc.).
2. **Endpoint Suspension**:
   * If an endpoint continuously fails or targets suspicious domains, mark `active: false`.
3. **Emergency Worker Pause**:
   * Toggle the global `webhooks` kill switch in the Developer Platform dashboard.

---

## 3. Runaway Token / Credit Spend (Budget Hard Limit)

### Severity: MEDIUM

1. When a project hits 100% of its monthly budget, `DeveloperUsageMeteringService` automatically flags the project as `RESTRICTED`.
2. New billable requests are rejected with HTTP 429 (`rate_limit_exceeded`).
3. If an account requires emergency spend expansion, the project owner must update their budget in the Developer Console.
