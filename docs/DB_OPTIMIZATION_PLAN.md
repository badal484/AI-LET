# Database optimisation plan — Lovira

Status: **planned, not started** (analysis 14 October 2026). Do Steps 1–2 before real traffic; Step 3 needs
the owner's OK (it deletes data copies for good); Step 4 at roughly 100k daily users.

## Measurements (14 Oct 2026)

Local database (106 MB, 8,931 messages, 638 test users) — the best sample of real usage. Production was
22 MB with one user and showed the same pattern.

| Table | Size | Share | What it holds | Verdict |
|---|---|---|---|---|
| `message_generation_metadata` | 30 MB | 28 % | The full prompt (`prompt_snapshot`, ~4,400 tokens) for every AI reply, ~11 kB/row | Written, **never read** by any code |
| `memory_embeddings` | 20 MB | 19 % | Each embedding twice: `embedding` jsonb (~11 kB) + `embedding_vec` vector(1536) (~6 kB) | jsonb is only a fallback when pgvector is missing; production has pgvector |
| `messages` | 4 MB | 4 % | The chats, ~476 bytes/message | Keep — the product |
| `message_parts` | 2 MB | 2 % | A second copy of each message's text (8,182/8,182 identical) | Written on every message; the app never reads `parts` |
| Logs (`ai_generation_traces`, `ai_usage_events`, `analytics_events`, `audit_logs`, `safety_evaluation_logs`, `memory_access_logs`, `character_runtime_snapshots`) | ~13 MB | 12 % | One or more rows per message | Useful for a limited time |
| `social_*` (7 tables) | ~6 MB | 6 % | The removed Social feature | Dead |

**About 10 kB is stored per message; ~0.5 kB of it is the message.**

| | Today | After Steps 1–2 |
|---|---|---|
| Per message | ~10 kB | ~1.3 kB |
| 10k daily users (300k messages/day) | ~3 GB/day, ~90 GB/month | ~0.4 GB/day, ~12 GB/month |

Where the code writes it:
- prompt: `apps/api/src/modules/conversations/services/streamingChat.service.ts` (`promptSnapshot: builtContext.systemPrompt`)
- message parts: same file (`parts: { create: … }`, two places); read only in `conversation.service.ts` (`parts` include)
- embeddings: `apps/api/src/modules/memory/services/memoryEmbedding.service.ts` (jsonb; a trigger fills `embedding_vec`);
  search in `memoryVectorSearch.service.ts` (pgvector first, jsonb fallback)

## Step 1 — stop writing waste (code only, nothing deleted)

1. **Prompts:** store a fingerprint (hash of the character version + rules), model, token counts. Keep the full
   prompt only for ~1 % of replies and for replies a user reports; delete those after 7 days.
2. **Embeddings:** write only the vector column, as `halfvec(1536)` (16-bit, ~3 kB instead of ~6 kB; retrieval
   quality practically unchanged — verify with the memory evals). Keep the jsonb fallback only where pgvector
   isn't installed (local setups).
3. **Message parts:** stop creating the duplicate text part; stop including `parts` in the history API.

Tests: chat reply still saved and streamed; memory search returns the same top memories before/after on a
fixed set; message history unchanged for the app.

## Step 2 — retention job (nightly, small batches)

| Data | Keep | Notes |
|---|---|---|
| Messages, memories, reminders | While the account exists | Deleted with the account (14-day grace) |
| `audit_logs` | 1 year | Security / legal |
| `safety_evaluation_logs` | 180 days | Moderation follow-up |
| `ai_usage_events` | 90 days raw; daily totals per model/task/character kept | Cost reports read the totals |
| `analytics_events` | 90 days | Later: export to BigQuery/ClickHouse |
| `ai_generation_traces`, `memory_access_logs`, `character_runtime_snapshots`, sampled prompts | 30 days (prompts 7) | Debugging only |

Run from `jobs/scheduledJobs.ts` (Redis lock), deleting ≤5,000 rows per batch with a short pause, in the
small hours (IST). Record each run in the admin System screen.

## Step 3 — clean up existing data (one migration; owner's OK)

- `UPDATE message_generation_metadata SET prompt_snapshot = NULL` (keep the sampled ones from Step 1).
- Convert `embedding_vec` to `halfvec`, drop the `embedding` jsonb column (after confirming every row has a vector;
  re-embed the 23 old 128-dim rows first).
- Delete duplicate `message_parts` rows.
- Drop the 7 `social_*` tables.
- `VACUUM (ANALYZE)` afterwards (Neon reclaims space on its own; a full `VACUUM FULL` locks tables — avoid).

Backup first: a Neon branch from "now", kept for 7 days.

## Step 4 — at ~100k daily users

- **Partition `messages` by month** (and `ai_usage_events`, `analytics_events`): fast recent queries, cheap upkeep.
- **Archive cold chats:** conversations untouched for 6+ months → compressed JSON in Cloudflare R2 (~10× smaller),
  loaded back when the user scrolls that far. Characters already use only recent messages + the summary.
- `ALTER TABLE … SET COMPRESSION lz4` on large text columns (faster than the default).
- Remove indexes with zero scans **in production statistics** (`pg_stat_user_indexes`), after a month of real use.
- Read replica for history/home/character reads.

## Never

- Delete users' chat history to save space.
- Replace old messages with AI summaries (loses what people care about; archive instead).
- Run cleanup in one huge statement on a live database.
