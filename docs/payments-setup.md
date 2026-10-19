# Payments setup (Google Play)

The code for Premium is built: Google Play Billing in the app, real purchase checks on the server, and the daily message allowance. These steps connect it to your Google Play account. Do them in this order.

## 1. Play Console: products

You need a developer account ($25, one-time) and the app uploaded at least once. An internal testing track is enough. Package: `com.aicompanionmobile`.

Go to **Monetize → Products → Subscriptions → Create subscription**.
- Product ID: `companion_premium` (it must be exactly this).
- Add **one** base plan (the only plan sold — no weekly, yearly or free plan; owner's decision, 15 Oct 2026):

| Base plan ID | Billing period | Price (India) | Renewal |
|---|---|---|---|
| `monthly` | 1 month | ₹499 | Auto-renewing |

- On the `monthly` base plan, add an offer:
  - Offer ID: `trial`
  - Eligibility: new customers only
  - Phase: single payment of ₹1 for 1 day (owner's decision, 15 Oct 2026)

  Check two things while creating it — Google's help pages don't state them: the shortest single-payment
  phase Play accepts, and India's minimum price. If 1 day or ₹1 isn't accepted, use the shortest length /
  lowest price Play allows; a free trial is the other option, but Play requires at least 3 days for those.
  The server treats any intro phase as a trial, and the app reads the length and price from Play, so the
  paywall text always matches what Google charges.
- Activate the base plans and the offer.

Go to **Monetize → Products → In-app products → Create product**, three times (consumable coin packs):

| Product ID | Price | Name | Coins |
|---|---|---|---|
| `coins_100` | ₹49 | 100 coins | 100 |
| `coins_330` | ₹149 | 330 coins | 330 |
| `coins_1000` | ₹399 | 1,000 coins | 1,000 |

Coins pay for gifts (🌹 10, ☕ 25, 🍫 50, 🧸 100, 💋/✨ 200, 💍 500) and for messages beyond the daily allowance
(1 coin each). How many coins each pack gives is set on the server (`COIN_PACKS`), never by the app. The old
`messages_100` product, if you already created it, still works as 100 coins.

## 2. Service account (lets the server check purchases with Google)

1. In Google Cloud Console, open the project linked to your Play Console. Create a **service account** and a **JSON key** for it.
2. In Play Console → **Users and permissions**, invite the service account's email. Give it "View financial data" and "Manage orders and subscriptions".
3. In the server's environment (on Render and in `.env`), set:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON=<the whole JSON key, or base64 of it>
   GOOGLE_PLAY_PACKAGE_NAME=com.aicompanionmobile
   ```
   Never commit the key to git.

## 3. Real-time notifications (renewals and cancellations)

1. In Google Cloud → **Pub/Sub**, create a topic, for example `play-billing`. Grant `google-play-developer-notifications@system.gserviceaccount.com` the role **Pub/Sub Publisher** on that topic.
2. Add a **push subscription** to the topic. Endpoint: `https://ai-let-fgx6.onrender.com/api/v1/billing/webhooks/google`.
   **Turn on "Enable authentication"** and pick a service account (it can be the one from step 2). Then set on Render:
   `PUBSUB_PUSH_SERVICE_ACCOUNT=<that service account's email>`. In production the server refuses Play
   notifications without Google's signed token for that account (a forged notification gets 401).
3. In Play Console → **Monetize → Monetization setup**, set the topic name and press **Send test notification**.

The server re-reads every notification from Google, so a fake message can't grant anything.

## 4. Database (production)

```
npx prisma migrate deploy
npx tsx scripts/billing/setupPlayPlans.ts --apply
```
This creates the Premium plan (monthly only; it switches off weekly/yearly prices if an earlier run created them) and the message pack, and hides the old placeholder plans.

## 5. Test before launch

1. Play Console → **License testing**: add your Gmail. Test purchases are free and renew fast (a monthly plan renews every 5 minutes).
2. Install the app from the internal testing track. Open the paywall and buy the ₹1 trial. Check that:
   - you see Premium;
   - `GET /billing/allowance` shows `premium: true, limit: 150`;
   - cancelling in the Play Store keeps Premium until the period ends.
3. Buy a message pack and check that `credits` goes up by 100.

## 6. Turn on the limits (launch day)

```
BILLING_ENFORCE_LIMITS=true      # off by default: nobody is limited until this is set
FREE_DAILY_MESSAGES=0           # no free plan (owner's decision); also editable in the admin console
PREMIUM_DAILY_MESSAGES=150
```
Crisis and emergency messages are never counted or blocked.

## Your obligations (India)

- **Clear pricing:** the paywall already shows "₹1 today, then ₹499/month from tomorrow, renews automatically, cancel anytime in Google Play" above the button. Don't hide or shorten it. Subscription traps are a named dark pattern under the CCPA's 2023 guidelines.
- **Easy cancelling:** "Manage subscription" opens Google Play.
- **Reminder before the first charge:** Google Play handles payments and its own receipts. Check in Play Console whether Google sends a reminder before the trial ends. If it doesn't, add an in-app reminder a few hours before the ₹1 day ends (with a 1-day offer there's no "day 2"); the user's trial end date is in `billing_subscriptions.trial_end`. In India, Google may place the payment authorisation up to 5 days before a renewal, so with a 1-day offer users may see their bank's "upcoming debit" notice on the day they pay ₹1 — the paywall text says plainly that the full price is charged from tomorrow.
- **GST:** Play collects and remits GST on in-app sales in India. Check with your CA how it shows in your books.

## UPI with Razorpay (user choice billing, India)

Built on 19 Oct 2026, so Loveek can sell before the Google Play payout verification (BillDesk / PA-CB) is done.
Premium costs **₹1 today, then ₹499 a month** by UPI Autopay. One UPI PIN pays the ₹1 and sets up the mandate.
Coin packs are one-time payments of ₹49, ₹149 or ₹399.

**Who sees what in the app:**
- Google Play can sell **and** `PLAY_USER_CHOICE_BILLING=true` → Google's own screen offers "Google Play" or "UPI". Choosing UPI opens Razorpay.
- Only Razorpay is set up → UPI opens directly. **Use this mode only for testing**: Play's rules require the choice screen for sales to the public.
- UPI subscribers cancel in **Profile → Your Premium → Cancel Premium**, or in their UPI app.

**Setup:**
1. Razorpay dashboard: the account is **Activated** (KYC done) and **Subscriptions** is enabled.
2. Razorpay → Settings → **Webhooks** → Add:
   - URL: `https://ai-let-fgx6.onrender.com/api/v1/billing/webhooks/razorpay`;
   - a secret you choose;
   - events: `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `payment.captured`, `refund.processed`.
3. On Render (and in `apps/api/.env` for local tests), set:
   ```
   RAZORPAY_KEY_ID=rzp_live_…          (rzp_test_… for testing)
   RAZORPAY_KEY_SECRET=…
   RAZORPAY_WEBHOOK_SECRET=…           (the secret from step 2)
   ```
   `RAZORPAY_PLAN_ID` is optional; the ₹499 monthly plan is created automatically.
4. Play Console → Loveek → **Monetization setup → User choice billing**: enrol (India). Then set `PLAY_USER_CHOICE_BILLING=true`.
5. Google sale reports: set up the service account from step 2 (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME`).
   - Every UPI sale made after Google's choice screen is reported to Google (`externalTransactions`). Failed reports are retried every 10 minutes.
   - Google invoices its fee (about 11%) monthly.
6. Optional: `GST_RATE_PERCENT=18` once you are GST-registered. Google's reports then split out the tax.

Every payment counts only when all of these hold: the checkout signature is valid, Razorpay's own record says it was paid, it belongs to this account, and the amount is the server's price. Signed webhooks keep subscriptions current: renewals, failed debits (3 days of grace, then Premium stops), cancellations and refunds.
