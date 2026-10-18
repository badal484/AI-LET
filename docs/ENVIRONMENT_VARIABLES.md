# Environment variables — API and worker

Set them in Render → service → Environment (never in the repo). `apps/api/src/config/env.ts` validates the
core ones at startup; in production the server refuses to start with a wildcard `CORS_ORIGIN`, short JWT
secrets or simulated billing. Values here are examples or descriptions, never real secrets.

## Required in production

| Variable | What it is | Example / note |
|---|---|---|
| `NODE_ENV` | `production` | Turns on production safety checks |
| `DATABASE_URL` | Postgres connection | Neon **pooler** URL for the app |
| `REDIS_URL` | Redis connection | `rediss://default:<password>@<host>:6379` (TLS auto for Upstash) — or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing | Long random values (≥32 chars), different from each other |
| `CORS_ORIGIN` | Allowed browser origins | The admin console URL; never `*` |
| `GOOGLE_AI_API_KEY` | Gemini | Paid tier recommended before launch |
| `PUBLIC_API_URL` | The API's public address | `https://ai-let-fgx6.onrender.com` (links in emails, media) |
| `TRUST_PROXY` | Behind Render's proxy | `1` |
| `RUN_SCHEDULED_JOBS_IN_API` | API runs deletions/reminders/campaigns | `true` while there is no worker (F-02) |
| `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` | Migrations through Neon's pooler | `1` |

## Features

| Variable | What it is | Default |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications (the **service account** JSON, not `google-services.json`) | off → pushes disabled, logged |
| `RESEND_API_KEY`, `EMAIL_FROM` | Password-reset email | off → no email sent, logged |
| `BILLING_ENFORCE_LIMITS` | Daily message limits | **on in production unless set to `false`** (currently `false` by owner decision) |
| `OPEN_DAILY_MESSAGES` | Messages per account per day while limits are off | 150 (0 = no cap); also in admin → Settings |
| `UNVERIFIED_DAILY_MESSAGES` | Messages per day until the email is verified | 30; only when Resend email is set up; admin → Settings |
| `AI_DAILY_HARD_CAP_INR` | Hard daily AI spending cap — replies pause when reached (crisis still answered) | ₹3000 (0 = off); admin → Settings |
| `ADMIN_REQUIRE_MFA` | Two-step sign-in for the admin console | **on in production unless `false`**; an admin without it can only reach the setup screen |
| `SECRET_BOX_KEY` (secret, optional) | Key that encrypts admin two-step secrets in the database | derived from `JWT_ACCESS_SECRET` when unset; changing either means admins set up two-step again |
| `FREE_DAILY_MESSAGES`, `PREMIUM_DAILY_MESSAGES` | Limits when enforced | 5 / 150 |
| `CHAT_RATE_LIMIT_PER_MINUTE` | Messages per account per minute | 20 |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME`, `PLAY_SUBSCRIPTION_ID`, `PLAY_PACK_ID` | Google Play purchase verification | off until billing goes live |
| `IMAGEKIT_PRIVATE_KEY` (secret), `IMAGEKIT_FOLDER` (default `/lovira`) | Character photo storage in ImageKit (chosen 18 Oct 2026) — **required in production** | off → R2/S3 if set, else server disk, lost on deploy (F-13) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_URL` | Alternative photo storage (Cloudflare R2/S3), used only without ImageKit | off → server disk, lost on deploy (F-13) |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | Server error reporting | off (F-06) |
| `KEEP_AWAKE` | Self-ping on Render's free plan | on; `false` on a paid plan |
| `LEGAL_OPERATOR_NAME`, `LEGAL_CONTACT_EMAIL`, `LEGAL_ADDRESS`, `GRIEVANCE_OFFICER_NAME`, `GRIEVANCE_OFFICER_EMAIL` | Shown on the privacy/terms pages | empty (F-17) |
| `DEFAULT_CHAT_MODEL`, `CHAT_PROVIDER`, `GEMINI_IMPORTANT_ONLY`, `GEMINI_*_MODEL` | AI model routing | see `docs/scaling.md`, `ai-cost` notes |
| `BACKGROUND_AI_CONCURRENCY` | After-reply AI jobs in the worker | 6 |
| `PROMPT_SNAPSHOT_SAMPLE` | Share of replies whose full prompt is kept for debugging (0–1) | 0.01 |
| `LOG_LEVEL` | Logging | `info` |

## Not used by the product any more

`MISTRAL_*` (removed), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_*`, `APPLE_SHARED_SECRET`,
`SOCIAL_PUBLIC_BASE_URL` — leave unset.

## Never allowed in production

`AGENT_SIMULATED_TOOLS`, `BILLING_SIMULATED_PROVIDERS` (the server refuses to start).

## Mobile app

The app has no secrets. `apps/mobile/src/config/appInfo.ts`: release builds use `PROD_API_ORIGIN`
(`https://ai-let-fgx6.onrender.com`). `google-services.json` (Firebase client config) is git-ignored and
must be present to build. Release signing comes from `~/.gradle/gradle.properties` (`LOVIRA_UPLOAD_*`).
