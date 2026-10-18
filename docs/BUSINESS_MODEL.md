# Business model — Loveek

Decided by the owner on 15 October 2026. Numbers are estimates from measured AI cost (see
`AI_COST_OPTIMIZATION_PLAN.md`); revisit after the first month of real data.

## 1. The model

**One subscription, no free plan.** Anyone can install the app, sign up, browse every character and read their
first message. To chat, they start Premium: **₹1 for the first day, then ₹499 a month** by autopay through
Google Play.

```
Install → sign up → pick a character → reads their first message → sends a message
       → "Start chatting for ₹1" → Google Play (UPI AutoPay / card) → chats all day
       → day 2: ₹499 charged automatically → every month until they cancel in the Play Store
```

| Product | Price | You keep (after 18 % GST and Play's 15 %) | What they get |
|---|---|---|---|
| **Premium (monthly)** | **₹499**, first day ₹1 (new subscribers) | **~₹359** | Every character, up to 150 messages a day, long memory, courses and health programs |
| **Coins** (one currency) | ₹49 = 100 · ₹149 = 330 · ₹399 = 1,000 | ~72 % | Gifts (🌹 10 · ☕ 25 · 🍫 50 · 🧸 100 · 💋 200 for romance characters / ✨ 200 for others · 💍 500) and extra messages beyond 150/day (1 coin each) |

Never advertised as "unlimited" — "up to 150 messages a day".

Always free, with or without Premium: messages about a crisis or an emergency (they always go through and get
helplines).

## 2. Unit economics

AI cost per message: **~₹0.21 today**, **~₹0.10 realistic** once the paid Gemini tier turns on caching (Phase 1
shipped), ~₹0.06 after Phase 2. At ₹0.10 a 40-message/day subscriber leaves **≈ ₹240/month** profit.

**One subscriber, 40 messages a day:**

| | Today | After optimisation |
|---|---|---|
| AI cost per month | ₹252 | ₹72 |
| You keep | ₹359 | ₹359 |
| **Profit** | **₹107** | **₹287** (80 %) |

Break-even: ~57 messages a day today, ~200 after optimisation. The 150/day cap keeps the heaviest users
profitable once costs are optimised (150 × 30 × ₹0.06 = ₹270 < ₹359).

**The ₹1 day:** a trial user costs ~₹2–8 typically, up to ~₹9–32 if they use all 150 messages. If 1 in 10
converts, each subscriber costs ~₹50–150 in trials once and earns ~₹359 every month.

**No free plan** removes the biggest loss of a freemium model (free users chatting at our cost). The costs
left for non-subscribers: the first character message (fixed text, no AI) and "characters text first"
notifications if they're sent to non-subscribers (an AI call each — limit to subscribers or a few nudges).

## 3. Coins and gifts (decided 17 Oct 2026: paid from launch)

- **Coins are the only in-app currency** — no separate message pack. Bought as Google Play one-time products
  (`coins_100`, `coins_330`, `coins_1000`); how many coins a pack gives is set on the server.
- **Gifts cost coins**, charged on the server once per gift (a double tap or retry is charged once); the chat only
  accepts a gift that was paid for. A 💋 is shown for romance characters, a ✨ (same price) for everyone else.
- A gift's AI reply costs about the same as a normal message, so gifts are almost pure margin
  (🌹 ≈ ₹3.5 kept, 💍 ≈ ₹176 kept at the ₹49-pack rate).
- Until payments go live (`BILLING_ENFORCE_LIMITS=false`), gifts are free, like chatting.
- **Later, paid with the same coins:** relationship story chapters, Sakshi's astrology reports, Dev's full courses,
  premium-only characters; then voice and photos.

## 3b. Ads

Not decided by the owner yet. Recommendation: **no ads** — they break trust in a private, emotional product and earn
little in India.

## 3c. Growth (how users are found)

Cheapest first: Instagram Reels / YouTube Shorts of real character chats (funny, emotional) → a "share this
moment" image with the Loveek logo → referrals (both get 3 Premium days) → Play Store listing (keywords: AI
girlfriend Hinglish, AI friend) → micro-creators once retention is proven → paid ads only when one paying user
costs < ₹500.

Funnel: 100 installs → ~60 sign-ups → ~12 start the ₹1 day → ~5 keep paying. A subscriber stays ~6–7 months
(≈15 % monthly churn) ≈ ₹1,500–1,700 profit. Break-even on servers ≈ 25–35 subscribers; ₹1 lakh profit/month ≈ 450.

## 4. Targets

| Metric | Target |
|---|---|
| Sign-up → ₹1 start | 10–20 % |
| ₹1 day → paying (₹499) | 30–50 % of those who start |
| Monthly churn | < 15 % |
| AI cost per message | ≤ ₹0.08 |
| Avg messages per subscriber | watch; adjust the 150 |

## 5. Risks

| Risk | Cover |
|---|---|
| No free taste → fewer sign-ups convert | Strong first character message; the ₹1 day; track sign-up → ₹1; the admin can set a small free allowance (Settings → `limits.freeDaily`) without an app update |
| Autopay surprise / complaints | Paywall states "₹1 today, then ₹499/month from tomorrow"; reminder before the charge; cancel in 3 taps |
| Heavy users | 150/day fair use + packs |
| AI price rises | Optimisations give headroom; cost alerts |
| Play rejects ₹1 or 1 day | Use the lowest price / shortest phase Play allows; the app reads them from Play |
| Play review needs to chat | Reviewer account with Premium granted (admin console) |

## 6. Launch order

1. AI cost optimisations (at least A+B and caching), paid Gemini tier.
2. Play Console: `companion_premium` monthly ₹499 + offer `trial` ₹1 for 1 day; coin packs `coins_100` ₹49,
   `coins_330` ₹149, `coins_1000` ₹399.
3. Turn on `BILLING_ENFORCE_LIMITS=true` together with payments (until then the app stays free for everyone).
4. First month: measure the targets above; adjust.
5. Then one-time purchases (gifts, reports, courses).

## How it's set in the code (15 Oct 2026)

- Free allowance: `limits.freeDaily` default **0** (admin-editable). Premium: `limits.premiumDaily` 150.
- Paywall offers the monthly plan only; trial length and price are read from Google Play.
- Weekly/yearly prices are switched off by `scripts/billing/setupPlayPlans.ts --apply`.
- Limits are **off** in production (`BILLING_ENFORCE_LIMITS=false`) until payments go live.
