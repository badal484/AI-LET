# Runbook: Security Incident, Secret Leak & Account Takeover

## 1. Symptoms & Alert Triggers
- Alert `HighVolumeUnauthorizedAuth` (Brute-force credential stuffing detection).
- Report of leaked API key, database credential, or JWT signing secret.
- Rapid impossible-travel login detection or mass user reports of compromised accounts.

## 2. Containment Protocols (Phase 1: 0 - 15 Minutes)
1. **Revoke Leaked Secret Immediately**:
   - For Provider API Keys (OpenAI / Anthropic / Stripe): Rotate key in provider dashboard and update Kubernetes Secret Manager.
   - For JWT Signing Key (`JWT_SECRET`): Rotate key; immediately invalidates all active session tokens and forces re-authentication.
2. **Isolate Affected Accounts**:
   - Suspend compromised user accounts via Admin User Desk:
   ```bash
   curl -X PATCH https://api.production/api/v1/admin/users/$USER_ID/status \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"status":"SUSPENDED","reason":"Security containment"}'
   ```
3. **Block Malicious IP Ranges**:
   Add offending CIDR blocks to Cloudflare Web Application Firewall (WAF) rule list.

## 3. Eradication & Recovery (Phase 2)
1. Perform forensic audit using `admin_audit_logs` and request correlation IDs.
2. Verify database integrity: ensure no unauthorized balance tampering or role escalation.
3. Redeploy all backend pods with clean environment configurations.

## 4. Post-Incident Requirements
1. Issue secure password reset tokens to affected user emails.
2. Document incident timeline in `IncidentCommandService` and schedule an executive postmortem.
3. Notify compliance and legal teams within mandatory statutory reporting windows (e.g. 72 hours for GDPR).

## 5. Escalation
- **Primary**: Security & Governance Officer (CISO)
- **Secondary**: Lead Systems Architect & Executive Staff
