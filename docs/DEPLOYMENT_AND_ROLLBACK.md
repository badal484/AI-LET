# Deployment and rollback — Loveek

## Today's production (13 October 2026)

| Piece | Where | Plan |
|---|---|---|
| API | Render web service **AI-LET**, Singapore, free | Auto-deploys from `main` |
| Worker | none | API runs the jobs (`RUN_SCHEDULED_JOBS_IN_API=true`) |
| Database | Neon, us-east-1, free | Move to Singapore before launch |
| Redis | Upstash, free (TLS via `REDIS_URL`) | Paid plan or Render Key Value at scale |
| Admin console | not deployed | `render.yaml` has `lovira-admin` |
| Old service `ai-let.onrender.com` | broken, still running | Suspend |

`render.yaml` is a full blueprint (API + worker + admin + Postgres + Redis in Singapore, starter plans);
the live service was created by hand, so **env changes are made in the Render dashboard**, not the file.

## How a deploy happens

1. Push to `main` → Render builds:
   `corepack pnpm install --frozen-lockfile` → `prisma generate` → build API and its packages →
   `prisma migrate deploy` (needs `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` with Neon's pooler).
2. Start: `cd apps/api && node dist/server.js`. Health check `/health`.
3. A failed build or migration leaves the previous version running.

## Before every production deploy

- [ ] `pnpm -r typecheck` and the API test suite pass locally.
- [ ] New migrations reviewed: additive only (new tables/columns, nullable or with defaults). Never drop or
      rename a column in the same release that stops using it — do it one release later.
- [ ] `pnpm audit --prod` reviewed.
- [ ] After deploy: `/health` shows database and redis healthy; sign in on the phone; send one message.

## Rollback

| Problem | Do this |
|---|---|
| Bad code, no migration | Render → AI-LET → Events → pick the last good deploy → **Rollback**. Or `git revert <commit>` and push to `main`. |
| Bad code with an additive migration | Roll back the code as above; the extra table/column is harmless to the old code. |
| Destructive migration went wrong | Stop: restore the database (below) to a new branch, check it, then point `DATABASE_URL` at it. Never "fix" production data by hand without a backup. |
| Bad app release on Play | Halt the staged rollout in Play Console; ship a fixed build with a higher `versionCode` (Play cannot roll back to a lower one). |
| Leaked secret | Rotate it at the provider, update Render env, redeploy (see `SECURITY_REMEDIATION_LOG.md`). |

## Backups and restore

- Neon keeps history for point-in-time restore; the free plan's window is short (check the Neon
  dashboard → Settings → History retention). A paid plan extends it.
- **Restore drill (do once before launch, then quarterly) — about 15 minutes:**
  1. Neon → Branches → **Create branch** → "From a point in time" → a time a few hours ago. Copy the new
     branch's connection string (direct, not pooler).
  2. Compare it with the live database (read-only, only `SELECT count(*)`):
     ```
     cd apps/api
     SOURCE_URL='<live direct URL>' RESTORED_URL='<branch URL>' npx tsx scripts/maintenance/compareDatabases.ts
     ```
     It prints each table's rows on both sides and ends with ✓ (every table present with data) or ✗.
  3. Write the date, the restore point, how long it took and the result in the table below.
  4. Delete the branch (it holds a copy of users' chats).
- **Real restore (data lost or damaged):** create the branch from just before the incident (as above), check it
  with the same script, then point `DATABASE_URL` (pooler) on Render at the branch's pooler URL and redeploy.
  Users' sign-ins keep working (sessions are in the database copy). Afterwards, rotate the old branch's password.
- Extra safety copy before risky changes:
  `pg_dump "$DATABASE_URL_DIRECT" -Fc -f lovira-$(date +%F).dump` (store encrypted, delete after 30 days —
  it contains users' chats).

| Date | Restore drill result |
|---|---|
| — | not yet done (F-15) |

## Staging

There is no staging environment yet. Minimum useful staging: a second Render service + a Neon branch +
a separate Redis database, `NODE_ENV=staging`, its own secrets. Run migrations and the k6 load test there
first.

## Monitoring

- Render: service metrics, deploy events, logs.
- Admin console → System: job heartbeats (account-deletion, reminders, …), errors, AI cost.
- Set `SENTRY_DSN` for server errors (F-06). Add an uptime monitor on `/health/live` with alerts to email.
