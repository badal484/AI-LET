# Optimisation plan — Loveek (overview)

Status: **Phase 1 done 17 Oct 2026 — see the status section; the rest planned** (measured 14 October 2026). This is the index of all optimisation work;
two areas have their own detailed plans:

- AI cost per message → [`AI_COST_OPTIMIZATION_PLAN.md`](AI_COST_OPTIMIZATION_PLAN.md) (~₹0.21 → ~₹0.08)
- Database size and growth → [`DB_OPTIMIZATION_PLAN.md`](DB_OPTIMIZATION_PLAN.md) (~10 kB → ~1.3 kB stored per message)

## Status — Phase 1 done (17 Oct 2026)

| Item | Result | Commit |
|---|---|---|
| Prompt order for caching | Shared, cacheable part of each character's prompt 5–8 % → **86–94 %** (~1,800–4,200 tokens). Discount starts once the Gemini project is on the **paid tier** (owner). | a9ac784 |
| Background calls | Profile update also skips filler messages. **Merging** profile + memory into one call was dropped: measured saving ~3 % of total, with real risk to memory quality; both prompts already put fixed text first (profile's ~1,120 tokens can be cached). Relationship analysis uses no paid AI. | af5baca |
| Database copies | Embeddings stored once (JSON copy cleared by trigger where pgvector runs); full prompt kept for 1 reply in 100; no duplicate message text; nightly retention with `ai_usage_daily` totals. Existing rows untouched (step 3 needs the owner's OK). | 38fa258 |
| Server memory cache | Not needed: settings already cached in memory (20 s), home feed and categories in Redis; remaining Redis use per request is the one rate limiter. | — |
| Category pictures | 6 MB → 83 KB (1024 → 160 px). | f267123 |
| Analytics battery | Sends every 3 min (was 30 s), on backgrounding, backs off when offline. | f267123 |

Verify after the paid tier is on: `cached_tokens` in `ai_usage_events` should be most of `input_tokens` for chat replies; `npx tsx scripts/costReport.ts 7` before/after.

## Suggested order

| # | What | Effort | Gain |
|---|---|---|---|
| 1 | Database to Singapore | Owner creates the Neon project; data copied over | Home screen ~6 s → under 1 s; chats start sooner |
| 2 | Shrink the category pictures | ~15 min | −5.8 MB app size |
| 3 | Analytics every few minutes, not every 30 s | ~30 min | Battery and mobile data |
| 4 | Cache characters, categories and settings in server memory | ~1 h | Fewer Redis commands, faster screens |
| 5 | AI cost steps 1 and 3 (prompt order for caching; fewer profile updates) | ~½ day | ~−40 % AI cost |
| 6 | Database plan steps 1 and 2 (stop writing copies; retention job) | ~½ day | ~−85 % database growth |
| 7 | Smaller embeddings; faster chat start | After evals | Speed and storage |

## 1. Speed — database region

- **Measured:** production home screen **6.2 s**; the same code locally **58 ms** (cold cache) and **5 ms**
  (cached).
- **Why:** API in Singapore, database in Neon us-east-1 (Virginia). Every query is a round trip across the
  Pacific (~200–700 ms each).
- **Fix:** a Neon project in **Singapore (ap-southeast-1)**, copy the data, switch `DATABASE_URL`. Every chat
  reply runs several queries before calling the AI, so replies start sooner too.
- Later (Stage 2): a Mumbai region on AWS/Google Cloud is ~60 ms closer to users than Singapore.

## 2. App size — category pictures

- **Measured:** 13 category "orb" photos in `apps/mobile/src/assets/categories/` are **550–760 kB each
  (~6 MB)**, shown at **28–40 dp** (`HomeScreen.tsx`, `orbImage` / `sectionOrbImage`).
- **Fix:** resize to ~120 px and save as WebP (~10 kB each). Saves **~5.8 MB**, about a quarter of the
  per-device download.

## 3. App size — ship the AAB

- **Measured:** release APK 47 MB = native code for 32-bit (13.2 MB) + 64-bit (18.7 MB) + resources.
- **Fix:** upload the Android App Bundle; Play gives each phone only its own ABI and screen density
  (~25 MB, ~20 MB after item 2). No code change.
- Biggest native libraries: React Native 6.6 MB, billing (`libNitroIap`) 3.7 MB, Hermes 2.4 MB — all needed.

## 4. Battery and data — analytics sending

- **Seen in the phone's log (12 Oct):** `AnalyticsSDK` tries to send every **30 seconds** and retries on
  failure, waking the radio.
- **Fix:** send every few minutes, plus once when the app goes to the background; don't retry while offline.
  File: `apps/mobile/src/services/analytics/AnalyticsSDK.ts`.

## 5. Redis commands — server memory cache

- **Measured:** ~4–7 Redis commands per request (rate-limit counters + cache reads). Upstash's free plan
  (~500k commands/month) lasts ~100k requests.
- **Fix:** keep rarely-changing data (characters, categories, app settings) in each API process's memory for
  ~60 s; invalidate on admin edits (the realtime channel already tells processes about changes).
- Or move to paid Redis before launch (already in `RELEASE_BLOCKERS.md`).

## 6. Memory search — smaller embeddings

- Each memory uses a 1,536-number embedding. Gemini can return **768** numbers (`outputDimensionality`).
  With 16-bit storage (`halfvec`, DB plan step 1): **~6 kB → ~1.5 kB per memory**, faster search.
- Needs: the memory evals to confirm the same memories are found; re-embed existing memories.

## 7. Chat reply speed — time to the first word

- Before calling the AI, a reply loads character, recent messages, summary, profile card and memories,
  partly one after another (`streamingChat.service.ts`).
- **Fix:** load them in parallel; cache the character and rules. First add timing (time to first token) to
  the cost ledger so the gain is measured.

## Already fine (measured)

- Responses are gzip-compressed: home 61 kB → 17 kB.
- Character photos ~50 kB at 600 px — right for the card size.
- Home feed cache works (5 ms cached).
- JavaScript bundle 2.1 MB with Hermes.

## How to measure progress

| Area | How |
|---|---|
| Speed | `curl -w "%{time_total}"` on `/api/v1/home`; time to first token in the ledger (to add) |
| App size | Play Console → Android vitals → app size; `unzip -lv` on the APK/AAB |
| AI cost | `npx tsx scripts/costReport.ts 7`; admin console AI cost screen |
| Database | `pg_total_relation_size` per table (queries in `DB_OPTIMIZATION_PLAN.md`) |
| Redis | Upstash dashboard → commands per day |
