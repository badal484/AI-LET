# AI cost optimisation plan — Lovira

Status: **planned, not started** (analysis 14 October 2026). Steps 1 and 3 are safe and quick; steps 2 and 4
change what characters see, so they need before/after evals on all 32 characters first (and an A/B test on
the paid tier). Safety rules are never cut. Related: `DB_OPTIMIZATION_PLAN.md`.

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
