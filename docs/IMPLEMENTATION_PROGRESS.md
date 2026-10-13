# Implementation progress — production readiness

Started 13 October 2026. Phases follow the production-readiness mission.

| Phase | State | Notes |
|---|---|---|
| 0. Real state of the project | Done | Architecture, Android config, auth, payments, jobs, tests, dependencies inspected. Docs created. |
| 1. Threat model and security | Mostly done | `SECURITY_THREAT_MODEL.md`. Fixed F-07, F-08, F-09. Open: F-10, F-19, F-20, F-28. |
| 2. Reliability and edge cases | Partly | Fixed F-02 (jobs), onboarding endless spinner, home fallback feed, Redis URL parsing, sign-in cold starts (self-ping). No mobile component/e2e tests yet. |
| 3. Data, payments, business logic | Reviewed | Play purchases verified server-side; billing off until pricing is decided. |
| 4. Database and infrastructure | Partly | Env and deploy docs written; restore drill, staging, DB region, object storage open. |
| 5. Tests and automated checks | Partly | API 853/853 + new tests; mobile suite has 1 stale file (F-22); CI workflows failing (F-26). |
| 6. Google Play | Prepared | Target API 36, 16 KB, ABIs, signing guard done. Checklist with Data safety draft. Account, key, listing are owner steps. |
| 7. Performance, UX, accessibility | Not started in this pass | Earlier work: smoothness pass, realtime, simplified screens. |
| 8. Release candidate | Blocked | Needs `RELEASE_BLOCKERS.md` items 1–9. |

## Changelog (this pass)

| Commit | Change | Breaking? |
|---|---|---|
| 4109726 | Demo credentials out of release builds; mobile lint error fixed | No |
| d82ca2d | Admin tokens end at logout/revoke; test helper creates real admin sessions | Admin tokens minted without a session (tests only) stop working |
| 54487bf | Admin 2-step login fails closed | Only for admins with MFA on (none) |
| ed027f1 | Scheduled jobs can run in the API; worker heartbeat key `worker:alive` | No (off until the env var is set) |
| e449166 | Password-reset email and page | No |
| 90529a6 | Upload-key signing, AAB guard, version props, 32-bit ARM | APK size 33 → 47 MB for sideloaded APKs (AAB per-device size unchanged) |
