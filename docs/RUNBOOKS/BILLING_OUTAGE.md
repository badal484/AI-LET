# Runbook: Billing, IAP & Payment Reconciliation Outage

## 1. Symptoms & Alert Triggers
- Prometheus alert `BillingWebhookFailureRate` ($> 5\%$ failed webhook verifications).
- Mobile client reports `PURCHASE_VERIFICATION_FAILED` or subscription entitlement sync delays.
- Discrepancies detected in `BillingReconciliationRecord` mismatch count.

## 2. Diagnosis
1. Inspect webhook retry queue and failed webhook logs in Admin Command Center (`/api/v1/admin/billing`).
2. Check signing secret validity for Stripe (`STRIPE_WEBHOOK_SECRET`) and App Store Shared Secret.
3. Validate database lock contention on `credit_wallets` or `subscriptions` tables.

## 3. Mitigation Protocols
1. **Pause New Checkout Attempts** (if payment gateway is corrupting state):
   Activate Kill Switch `ENABLE_BILLING = false` or `ENABLE_MOBILE_PURCHASES = false`.
2. **Replay Failed Webhooks**:
   Execute manual batch replay in Admin Billing Workspace for all unhandled webhook event IDs:
   ```bash
   curl -X POST https://api.production/api/v1/admin/billing/webhooks/retry-all -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
3. **Emergency Entitlement Grant**:
   If legitimate paying users are blocked due to upstream delay, grant temporary 24-hour grace entitlements via Admin User Desk.

## 4. Verification
- Verify `mismatchCount == 0` in Admin Billing Overview.
- Confirm successful end-to-end sandbox purchase verification.

## 5. Escalation
- **Primary**: Billing & Monetization Lead
- **Secondary**: Financial Operations / Platform Lead
