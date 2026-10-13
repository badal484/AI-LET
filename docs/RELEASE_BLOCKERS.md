# Release blockers — Lovira (13 October 2026)

Everything that must be done before the app goes to Play testers (closed test) and before production.
**OWNER** = needs the owner (account, money, facts or a decision). Finding IDs refer to
`PRODUCTION_READINESS_AUDIT.md`.

## Before the closed test (testers install it)

| # | What | Who | Finding |
|---|---|---|---|
| 1 | Render → AI-LET → Environment: add `RUN_SCHEDULED_JOBS_IN_API` = `true` (account deletion, reminders) | OWNER (2 min) | F-02 |
| 2 | Rotate the secrets exposed in chat: Neon DB password, Upstash password, Firebase service-account key; update Render env | OWNER | F-04 |
| 3 | Email for password reset: Resend account + a domain you own, verified in Resend → `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_API_URL` on Render | OWNER (domain ~₹800/year) | F-01 |
| 4 | Decide the app ID (permanent) and the Play account type | OWNER | F-27 |
| 5 | Create the upload key and put it in `~/.gradle/gradle.properties`; back it up | OWNER (or approve me to run it) | F-03 |
| 6 | Replace stock photos of real people with owned / AI-generated images | OWNER | F-05 |
| 7 | Fill `LEGAL_*` env (operator name, contact email, address, grievance officer) | OWNER | F-17 |
| 8 | Crash reporting: create a Sentry project (free plan) → `SENTRY_DSN` on Render; approve adding the Sentry SDK to the app | OWNER | F-06 |
| 9 | Play Console: store listing, Data safety, content rating, target audience 18+, reviewer account | OWNER (drafts in the checklist) | F-30 |

## Before production (public)

| # | What | Who | Finding |
|---|---|---|---|
| 10 | Closed test with ≥12 testers for 14 days (new personal account) | OWNER | — |
| 11 | Database in Singapore; restore drill done and recorded | OWNER + me | F-12, F-15 |
| 12 | Paid Render plan (no sleeping, room for a worker) | OWNER (~$7–25/month) | F-14 |
| 13 | Lawyer review of privacy policy and terms | OWNER | F-17 |
| 14 | Decide pricing; turn `BILLING_ENFORCE_LIMITS` back on with payments, or add email verification at sign-up | OWNER | F-10, F-11 |
| 15 | Object storage for admin uploads (Cloudflare R2 free tier) | OWNER | F-13 |
| 16 | Suspend the old `ai-let.onrender.com` service; restrict the Firebase API key | OWNER | F-28, F-29 |

## Done in code (13 Oct)

Reset email + page (F-01, code), scheduled jobs without a worker (F-02, code), upload-key signing and AAB
guard (F-03, code), admin token revocation (F-07), admin 2-step fails closed (F-08), demo credentials out of
the release bundle (F-09), 32-bit ARM (F-16).
