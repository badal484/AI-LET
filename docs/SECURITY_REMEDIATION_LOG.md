# Security remediation log — Lovira

Newest first. Each entry: finding, change, how it was verified.

## 13 October 2026

| Finding | Change | Commit | Verified by |
|---|---|---|---|
| F-07 Admin JWT valid after logout | Admin middleware now requires the token's session to exist, belong to that admin, and be neither revoked nor expired | d82ca2d | `adminRbac.test.ts`: 401 after logout; the same test gives 200 with the fix removed. Token with no session → 401 |
| F-08 Admin MFA accepted any code | Fails closed until a real TOTP verifier exists | 54487bf | Code review; no admin has MFA on (prod 0/1); `adminRbac.test.ts` passes |
| F-09 Demo credentials in release bundle | Credentials behind a `__DEV__`-only constant; the bundler drops them | 4109726 | Production bundle grep: 0 matches for the email and password |
| F-01 Password reset never delivered | Resend email + `/account/reset-password` page (no-store, no-referrer, rate limited, one-use token, escaped output) | e449166 | `passwordResetPage.test.ts` (4 tests) |
| F-02 Deletions never executed without a worker | API can run scheduled jobs with Redis locks; worker has its own heartbeat | ed027f1 | Local run: jobs recorded OK |
| F-03 Debug-signed release | Upload key from private Gradle properties; `bundleRelease` refuses the debug key; key files git-ignored | 90529a6 | `bundleRelease` fails with the explanatory message |

## 12 October 2026 (earlier session)

Message limits on by default in production; per-account chat rate limit; live-connection token moved to a
header; 404 before streaming for others' chats; dependency audit 13 → 2; release builds use the production
API only; deep links limited to `companion://`; R8 on (with Room/WorkManager keep rules); graceful handling
of a wrong Firebase key; tolerant `REDIS_URL` parsing.

## Pending: secret rotation plan (F-04)

These were pasted into a chat session and must be treated as exposed. Rotate one at a time; after each,
check `/health` and send a test message.

1. **Neon database password:** Neon → Roles → `neondb_owner` → Reset password → update `DATABASE_URL`
   on Render (pooler URL) → redeploy. Any copy in local files (`~/Desktop/lovira-render.env`) must be updated
   or deleted.
2. **Upstash Redis:** Upstash → database → Reset password → update `REDIS_URL` on Render.
3. **Firebase service account:** Google Cloud console → IAM → Service accounts → the Firebase Admin SDK
   account → Keys → add a new JSON key → paste it into `FIREBASE_SERVICE_ACCOUNT_JSON` → redeploy → send a
   test push → **delete the old key**.
4. **Admin password** (`riklestork@gmail.com`): change after first sign-in to the admin console; delete
   `~/Desktop/lovira-render.env` once everything is stored in a password manager.
5. Consider rotating `GOOGLE_AI_API_KEY` if it was ever shared outside Render.

Never paste a secret in chat, an issue or a commit; copy it straight from the provider into Render.
