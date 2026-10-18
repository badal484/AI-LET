# Running Loveek for 10,000+ users a day

What 10k daily users means (≈90% free at 5 messages/day, Premium ≈40): ~85k messages/day, ~8k in the
busiest evening hour (3–5/s at peaks), ~50 replies being written at once, 1–2k apps open, ~3–4 AI calls
per message. The limits are the AI provider, the database and cost — not server CPU.

## Production setup

| Piece | Setting |
|---|---|
| API | **2+ instances** (paid, always on — no sleeping free tier), health check `/health`, behind the host's load balancer. WebSockets must be allowed. |
| Worker | **1 instance** running `start:worker` (reminders, campaigns, text-first, deletions, and the after-reply AI queue). Without it, after-reply work runs inside the API (still works, less protected). |
| Postgres | Managed, daily backups, **pgvector** extension available. Connect the app **through the provider's pooler** (PgBouncer, transaction mode): `DATABASE_URL=…pooler…?pgbouncer=true&connection_limit=10`. Run migrations with the **direct** URL: `DATABASE_URL=<direct> npx prisma migrate deploy`. |
| Redis | Managed, persistence on. Holds rate limits, live updates (pub/sub), queues, counters, caches. |
| Gemini | **Paid tier** with higher per-minute limits. Fallback across Gemini models is built in (busy/slow models are tried last). |
| Images | Character photos in your own storage (S3 / Cloudflare R2) behind a CDN (`S3_*`, `MEDIA_PUBLIC_URL`). |

## Environment

| Variable | Why |
|---|---|
| `TRUST_PROXY=1` | Real client IPs behind the load balancer (default 1). Wrong value = everyone shares one rate limit. |
| `PUBLIC_API_URL` | Admin live connection address. |
| `SENTRY_DSN` | Error tracking (API + worker); off when empty. Never sends chat text or bodies. |
| `BACKGROUND_AI_CONCURRENCY` | After-reply AI jobs at once per worker (default 6). Raise with a higher Gemini tier. |
| `MEMORY_CANDIDATE_LIMIT` | Safety limit on memories per search (default 5000). Similarity is computed in Postgres, so only ids and scores travel. |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | General API limit — counted per **account** (per IP when signed out), shared by all instances via Redis. |

## Built in

- **After-reply AI work is queued** (profile card, memories, summary, relationship): the worker runs it with
  limited concurrency and retries, so peaks can't flood Gemini or slow live replies.
- **Rate limits in Redis**, per account — correct with any number of API instances, fair on shared mobile IPs.
- **Live updates through Redis pub/sub** — any instance or the worker reaches any open app.
- **Memory search in the database (pgvector):** similarity between the message and a person's memories is
  computed inside Postgres — exact, every memory counts, a few hundred bytes back instead of ~11 KB per
  memory. Production Postgres needs the `vector` extension (Render, Neon, Supabase, RDS have it); without it
  the migration skips and the app compares in Node as before.
- **Error tracking** (Sentry) on crashes, 5xx and failed jobs.

## Before launch: load test on staging

```
cd apps/api && npx tsx scripts/loadtest/createUsers.ts 300 > /tmp/lt-users.json
k6 run -e BASE_URL=https://<staging>/api/v1 -e USERS=/tmp/lt-users.json \
       -e APPS=1500 -e BROWSE_RATE=20 -e CHAT_RATE=5 infrastructure/load-tests/chat.k6.js
cd apps/api && npx tsx scripts/loadtest/createUsers.ts --delete
```

`CHAT_RATE` uses the real AI (costs money) unless staging has no Gemini key (then a free mock model).
Pass/fail thresholds: browse p95 < 500 ms, < 1% errors, first reply p95 < 6 s.

Local result (one MacBook, 2026-10-11): 500 open apps + 20 browse requests/s for 45 s → p95 31 ms,
p99 70 ms, 0 errors.

## Cost

At ~₹0.16/message, 85k messages/day ≈ ₹4 lakh/month of AI — about what 1,000 Premium users pay. Watch AI
cost in the admin; next levers: cache more of the prompt (cached input is far cheaper), update memories
every few messages instead of every message, per-user daily AI budget.
