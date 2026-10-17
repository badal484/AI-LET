# AI cost optimisation plan — Lovira

Status: **Phase 1 done 17 Oct 2026 — see the status section; the rest planned** (analysis 14 October 2026). Steps 1 and 3 are safe and quick; steps 2 and 4
change what characters see, so they need before/after evals on all 32 characters first (and an A/B test on
the paid tier). Safety rules are never cut. Related: `DB_OPTIMIZATION_PLAN.md`.

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

## Why cost is per message

AI providers charge per **token** (≈ ¾ of an English word; Hinglish a little more), for everything sent
(input) and everything written back (output). The model has no memory, so every message re-sends what the
character needs to reply: who they are, the rules, what they remember about the user and the recent chat.
After the reply, background calls keep memory up to date. So cost grows with the number of messages.

## Measurements (cost ledger `ai_usage_events`, last 30 days, local)

| Call | Model | Avg input tokens | Avg output tokens |
|---|---|---|---|
| Chat reply | gemini-3.6-flash | 3,203 | 85 |
| Chat reply | gemini-3.5-flash-lite | 3,058 | 35 |
| Profile-card update (every message) | gemini-3.1-flash-lite | 1,319 | 6 |
| Memory extraction (~half of messages; the rest skipped as "nothing to remember") | gemini-3.1-flash-lite | 600 | 48 |

- **~98 % of tokens are input.** Output is tiny.
- `cached_tokens` = 0 on every call (free tier — no implicit caching).
- Measured live cost: **~₹0.21 per message** on Flash-Lite (`scripts/costReport.ts`).

### What one chat reply sends

The conversation is already **not** sent in full: each reply gets the last 20 messages
(`SHORT_TERM_CONTEXT_LIMIT`) plus a running summary (refreshed every 20 messages).

| Part | Tokens | Share |
|---|---|---|
| Fixed instructions — character, rules, texting style, safety | ~2,800 | ~88 % |
| Last 20 messages (users average 25 characters, characters 87) | ~400 | ~12 % |

So the history is a small lever; the **fixed instructions sent with every message** are the big one.

## The plan (biggest saving first)

### 1. Cache the fixed part — ~60–75 % off the biggest piece
- On Gemini's paid tier, a request that **starts** with the same text as a recent one is charged at a large
  discount for that part (implicit caching; check Google's current pricing page for the exact rate).
- Today the prompt starts with parts that change every message (relationship state, recalled memories,
  time of day — see a `prompt_snapshot`), which **prevents caching even on the paid tier**.
- Change: order every request as **character card + rules (identical) → changing context → chat history →
  new message**. Files: `human/compactPrompt.ts`, `engine/contextBuilder.ts`.
- Needs: the paid Gemini tier (also needed for quota and privacy). Verify with `cached_tokens` in the ledger.

### 2. Send each character only what it needs — 2,800 → ~1,500 tokens
- Example: the texting rules carry guidance for every character type ("if you are a psychologist… a crush…
  an astrologer… a neighbour…"); each character should get only its own.
- Merge rules repeated in several places; drop sections that no longer change behaviour.
- Never cut safety, crisis or boundary rules.
- Needs: evals on all 32 characters before/after (`scripts/eval/character.eval.ts`, `people.eval.ts`), then
  an A/B test on half the users.

### 3. Update the profile card less often — ~25 % off background cost
- It runs on every message (~1,300 tokens). Run it only when the message carries something new (same idea as
  `nothingToRemember.ts`, which already skips 48 % of memory work), or at most every 3rd message.
- File: `modules/memory/services/userProfile.service.ts` (called from `afterReply.service.ts`).

### 4. Shorter history — ~5 % off
- Last 12 messages + summary instead of 20; free users could get fewer.
- Needs the same evals (characters must not forget what was just said).

## Expected result

| | Today | After 1–4 |
|---|---|---|
| Input tokens per message (reply + background) | ~4,800 | ~1,900 effective |
| Cost per message | ~₹0.21 | ~₹0.08–0.09 |
| 10k daily users (~300k messages/day) | ~₹16 lakh/month | ~₹6–7 lakh/month |

## More techniques (added 15 Oct 2026)

Extra measurements (local ledger, includes eval runs): every reply is exactly **1 AI call** (no retries or
rewrites), thinking tokens are 0, but **55 % of chat replies used Flash** (≈2.5× Flash-Lite's input price) —
check production before acting, evals over-sample emotional/crisis moments.

### Safe — no visible change for users

| # | Technique | How | Saving |
|---|---|---|---|
| A | **Merge background calls** | Profile-card update (~1,300 tokens, every message) and memory extraction (~600) each re-send the same exchange. One call returns both as structured JSON (`afterReply.service.ts`). | ~40 % of background cost |
| B | **Skip background work for small messages** | "ok", "😂", "hmm": extend `nothingToRemember.ts` (already skips 48 % of memory work) to the profile update. | ~25–35 % of background cost |
| C | **Batch API (50 % cheaper) for non-urgent work** | Pre-generate tomorrow's "text first" messages overnight; summarise old chats in batches. Never for live replies or same-day memory. | 50 % off that work |
| D | **Explicit cache per character** | If implicit caching hits too rarely, store each character's fixed text in Gemini's context cache (small storage fee, guaranteed discount). | Makes step 1 reliable |
| E | **Short facts instead of prose in the changing blocks** | e.g. "Relational Dynamic: Initial Connection (Formative familiarity, polite baseline rapport)…" → "relationship: new, 21 chats". | ~150–300 tokens/message |

### Needs a test first

| # | Technique | How | Saving |
|---|---|---|---|
| F | **Flash only where it helps** | Keep Flash for crisis, safety and boundary moments; test whether "emotional" moments need it (`GEMINI_FLASH_MOMENTS`). Flash 55 % → ~15 % of replies. | Up to ~30 % of chat cost |
| G | **Free users on Flash-Lite with a shorter memory window** | Premium keeps the full experience — a plan difference, not a downgrade. | Depends on free/paid mix |

### Protection (no saving on normal days; stops surprises)

- Daily AI limit per user while message limits are off.
- Monthly budget alert in the admin console; kill switch per feature (web search, text-first).

### Keeping quality

For any change that affects replies (F, G, steps 2 and 4): character evals before/after on all 32 characters
(small runs — shared quota) → A/B test for a week on half the users, comparing 👍/👎 on replies, messages per
session and next-day return → keep only if those hold. Each change sits behind a setting so it can be switched
back instantly.

### Where it lands

| | Cost per message |
|---|---|
| Today | ~₹0.21 |
| After steps 1–4 | ~₹0.08–0.09 |
| Plus A–F | **~₹0.05–0.06** (~70–75 % cheaper; 10k daily users: ~₹16 lakh → ~₹4–5 lakh/month) |

Build first when this starts: **A + B** (safe, quick, no quality risk).

### Avoid (they do hurt quality)

- Reusing old replies for "similar" messages (characters repeat themselves).
- Summarising away the recent chat.
- Cutting safety rules.

## Already done

- Cheapest model for small talk; Flash only for key moments (`GEMINI_FLASH_MOMENTS`).
- Background work on Flash-Lite; memory extraction skipped when there's nothing to remember.
- Several quick user messages answered together in one reply.
- History limited to 20 messages + summary.
- Cost ledger per call and `scripts/costReport.ts`.

## Ruled out

- Gemini Batch API for memory work (jobs can take hours; memory is needed the same day).
- Cutting safety rules or crisis handling to save tokens.
- Replacing chat history with AI summaries only (characters lose what was just said).

## How to check progress

`npx tsx scripts/costReport.ts 7` before and after each step; watch `cached_tokens` and average input tokens
per task in `ai_usage_events`; the admin console's AI cost screen shows ₹ per message.
