# Business model — Lovira

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
| Message pack | ₹49 for 100 messages | ~₹35 | For days they want more than 150 (anyone can buy one) |

Never advertised as "unlimited" — "up to 150 messages a day".

Always free, with or without Premium: messages about a crisis or an emergency (they always go through and get
helplines).

## 2. Unit economics

AI cost per message: **~₹0.21 today**, ~₹0.06 after the planned optimisations.

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

## 3. Other income (later)

Independent of chat volume: gifts and coins (the 🎁 button exists), astrology reports (₹99–199), Dev's courses
(₹199–499), relationship story chapters (₹49–99), premium-only characters; later voice and photos.

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
2. Play Console: `companion_premium` monthly ₹499 + offer `trial` ₹1 for 1 day; pack `messages_100` ₹49.
3. Turn on `BILLING_ENFORCE_LIMITS=true` together with payments (until then the app stays free for everyone).
4. First month: measure the targets above; adjust.
5. Then one-time purchases (gifts, reports, courses).

## How it's set in the code (15 Oct 2026)

- Free allowance: `limits.freeDaily` default **0** (admin-editable). Premium: `limits.premiumDaily` 150.
- Paywall offers the monthly plan only; trial length and price are read from Google Play.
- Weekly/yearly prices are switched off by `scripts/billing/setupPlayPlans.ts --apply`.
- Limits are **off** in production (`BILLING_ENFORCE_LIMITS=false`) until payments go live.
