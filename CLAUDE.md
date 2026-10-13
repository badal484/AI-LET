# Lovira — notes for working in this repo

Lovira is an Android app for chatting with AI characters (India; English and Hinglish). pnpm monorepo.

## Layout

- `apps/api` — Express + Prisma (Postgres 16 + pgvector) + Redis + BullMQ. Entry `src/server.ts`, worker `src/worker.ts`,
  periodic jobs `src/jobs/scheduledJobs.ts`. Character engine in `src/modules/conversations` (persona packs in
  `human/personaPacks`). Public pages: `/legal/*`, `/account/reset-password`.
- `apps/mobile` — React Native 0.87 (Hermes, new arch). `src/config/appInfo.ts` picks the API (release = production).
- `apps/admin` — Next.js 15 admin console (port 3010), proxies `/api/*` to the API.
- `packages/*` — shared types, validation (zod), config, utils.
- `docs/` — the current launch documents are `PRODUCTION_READINESS_AUDIT.md`, `RELEASE_BLOCKERS.md`,
  `PLAY_STORE_RELEASE_CHECKLIST.md`, `TEST_STRATEGY.md`, `DEPLOYMENT_AND_ROLLBACK.md`, `ENVIRONMENT_VARIABLES.md`,
  `SECURITY_THREAT_MODEL.md`, `KNOWN_LIMITATIONS.md`. Many older `PHASE_*`/`CHARACTER_SIMULATION_*` docs describe
  removed features — don't trust them without checking the code.

## Commands

```bash
pnpm install                                  # always pnpm (lockfile), never npm
pnpm -r run typecheck
cd apps/api && npx vitest run                 # needs local Postgres + Redis; migrates the test DB
cd apps/api && npx tsx src/server.ts          # API on :4000 (dev)
cd apps/mobile/android && ./gradlew assembleRelease     # test APK (debug key)
cd apps/mobile/android && ./gradlew bundleRelease -PloviraVersionCode=N   # Play AAB (needs upload key)
```

## Production

Render web service `AI-LET` → https://ai-let-fgx6.onrender.com, auto-deploys from `main` (keep `main` equal to the
working branch). Neon Postgres, Upstash Redis (`REDIS_URL`). No worker: `RUN_SCHEDULED_JOBS_IN_API=true`.
Env reference: `docs/ENVIRONMENT_VARIABLES.md`.

## Rules

- Never commit, log or paste secrets; never put a secret in the app (anything in the APK is public).
- Never run tests, evals, load tests or destructive commands against the production database. Writing to production
  data (copy scripts, migrations by hand) needs the owner's explicit OK.
- Every user query is scoped to the authenticated user; admin actions need a permission and are audited.
- A security fix comes with a test that fails without it. Don't report unexecuted tests as passing.
- Migrations are additive; drop or rename columns one release after the code stops using them.
- The owner keeps work in progress uncommitted in `apps/mobile`: stage exact files, never `git add -A`.
- Character text: no scripted templates; characters follow the user's way of talking (see persona packs).
- Gemini quota is shared with the live app — keep eval runs small.
