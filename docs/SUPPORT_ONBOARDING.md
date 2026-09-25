# Customer Support Operations & Onboarding Guide

Welcome to the **AI Companion Customer Support & User Trust Team**! This guide outlines ticket triage, privacy rules, standard resolution workflows, and escalation procedures.

---

## 1. Support Priorities & First-Response SLAs

| Priority | Definition | Target First Response | Target Resolution | Escalation Contact |
| :--- | :--- | :--- | :--- | :--- |
| **P0 (Emergency)** | Active security issue, child safety concern, systemic billing failure, user unable to cancel plan. | **$< 15\text{ minutes}$** | **$< 2\text{ hours}$** | On-Call Incident Commander / CISO |
| **P1 (High)** | Inability to log in, paid subscription entitlements not unlocking, severe voice failure. | **$< 2\text{ hours}$** | **$< 8\text{ hours}$** | Billing / Auth Domain Lead |
| **P2 (Medium)** | Intermittent streaming pause, minor audio glitch, character memory confusion, UI bug. | **$< 8\text{ hours}$** | **$< 24\text{ hours}$** | Tier 2 Support / Domain Engineer |
| **P3 (Low)** | General question, feedback, feature request, minor typo in public profile. | **$< 24\text{ hours}$** | 3 business days | Support Specialist |

---

## 2. Privacy & User Data Protection Rules

As a support specialist, you have privileged access to resolve customer issues. **You must strictly adhere to platform privacy standards**:

1. **No Casual Browsing of Private Messages**: The admin desk redacts private conversation content by default. Only diagnostics (timestamps, model IDs, token counts, error codes) are visible.
2. **Explicit Consent Required for Deep Investigation**: If a customer requests investigation into a specific AI response, obtain written confirmation before enabling audited trace review.
3. **Audited Access**: Every time a support specialist views or modifies a user record, a permanent audit log entry is written to `support_audit_logs`.
4. **Never Ask for Passwords or Card Details**: Support will never ask a customer for their account password, CVV, or full credit card number.

---

## 3. Standard Resolution Playbooks

### Scenario A: Paid Subscription Entitlements Missing
- **Symptoms**: Customer purchased subscription on iOS/Android, but characters remain locked.
- **Workflow**:
  1. Look up user ID in Admin Support Desk.
  2. Navigate to Billing Tab $\to$ Check `BillingReconciliationRecord`.
  3. If payment was verified by StoreKit/Stripe but webhook lagged, click **"Force Entitlement Sync"**.
  4. If issue persists, grant 48-hour manual grace entitlement while escalating to Billing Engineering.

### Scenario B: Character Memory Misunderstanding
- **Symptoms**: Customer asks why the AI character forgot a conversation detail from last month.
- **Workflow**:
  1. Explain that the AI utilizes **dynamic vector retrieval** and **short-term context buffers** to focus on the most relevant memories.
  2. Guide customer to **Settings $\to$ Memory Settings** in their mobile app to view, pin, or adjust remembered facts.

### Scenario C: Voice Call Audio Pauses
- **Symptoms**: Customer reports audio pauses when switching between WiFi and 5G cellular.
- **Workflow**:
  1. Explain that network handoffs briefly interrupt the WebSocket audio stream.
  2. Advise customer to ensure a stable network connection or toggle speaker audio.

---

## 4. Escalation Paths

- **Safety & Content Reports** $\to$ `#escalation-moderation`
- **Billing & Refunds** $\to$ `#escalation-billing`
- **Authentication & Security** $\to$ `#escalation-security`
- **Engineering Outages / Bugs** $\to$ `#escalation-engineering`
