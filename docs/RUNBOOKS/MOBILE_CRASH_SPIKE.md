# Runbook: Mobile Client Crash & ANR Spike

## 1. Symptoms & Alert Triggers
- Sentry alert `MobileCrashRateSpike` (Crash-free sessions drop below $99.5\%$).
- Google Play Console ANR rate $> 0.47\%$ (Google Play bad behavior threshold).
- Customer support ticket influx reporting app crashes on launch or in chat.

## 2. Diagnosis
1. Inspect Sentry Crash Triage dashboard:
   - Group by `app_version`, `os_version`, `device_model`, and `stack_trace`.
   - Identify whether crash occurs in Native layer (e.g. Audio session, Hermes engine) or JavaScript layer.
2. Check if a recent remote configuration change, prompt change, or backend API payload change introduced unexpected schema shapes.

## 3. Mitigation Protocols
1. **Halt Phased Rollout**:
   - In App Store Connect / Google Play Console, immediately pause staged rollout (e.g. at 5%).
2. **Emergency Hotfix / Remote Config Toggle**:
   - If crash is linked to an experimental UI feature, toggle off the corresponding feature flag in Admin Command Center.
   - If caused by bad cached local state, trigger remote cache eviction payload on app start.
3. **Expedited Hotfix Release**:
   - Merge fix to `release/hotfix-x.x.x`, trigger fast-track CI build, and request expedited review from Apple/Google.

## 4. Verification
- Verify crash-free sessions rise above $99.8\%$ on new hotfix build.
- Confirm zero launch-crash reports in Support Desk.

## 5. Escalation
- **Primary**: Mobile Engineering Lead
- **Secondary**: SRE Lead & Product Manager
