# Payments setup (Google Play)

The code for Premium is built: Google Play Billing in the app, real purchase checks on the server, and the daily message allowance. These steps connect it to your Google Play account. Do them in this order.

## 1. Play Console: products

You need a developer account ($25, one-time) and the app uploaded at least once. An internal testing track is enough. Package: `com.aicompanionmobile`.

Go to **Monetize → Products → Subscriptions → Create subscription**.
- Product ID: `companion_premium` (it must be exactly this).
- Add three base plans:

| Base plan ID | Billing period | Price (India) | Renewal |
|---|---|---|---|
| `monthly` | 1 month | ₹399 | Auto-renewing |
| `weekly` | 1 week | ₹99 | Auto-renewing |
| `yearly` | 1 year | ₹3,999 | Auto-renewing |

- On the `monthly` base plan, add an offer:
  - Offer ID: `trial`
  - Eligibility: new customers only
  - Phase: single payment of ₹1 for 3 days

  If Play won't allow a 3-day single payment, use a 3-day free trial phase instead. The server treats both as a trial.
- Activate the base plans and the offer.

Go to **Monetize → Products → In-app products → Create product**.
- Product ID: `messages_100`
- Price: ₹49
- Name: "100 extra messages"
- Activate it.

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
2. Add a **push subscription** to the topic. Endpoint: `https://ai-let.onrender.com/api/v1/billing/webhooks/google`
3. In Play Console → **Monetize → Monetization setup**, set the topic name and press **Send test notification**.

The server re-reads every notification from Google, so a fake message can't grant anything.

## 4. Database (production)

```
npx prisma migrate deploy
npx tsx scripts/billing/setupPlayPlans.ts --apply
```
This creates the Premium plan (monthly, weekly and yearly) and the message pack, and hides the old placeholder plans.

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
FREE_DAILY_MESSAGES=5
PREMIUM_DAILY_MESSAGES=150
```
Crisis and emergency messages are never counted or blocked.

## Your obligations (India)

- **Clear pricing:** the paywall already shows "₹1 today, then ₹399/month from <date>, renews automatically, cancel anytime in Google Play" above the button. Don't hide or shorten it. Subscription traps are a named dark pattern under the CCPA's 2023 guidelines.
- **Easy cancelling:** "Manage subscription" opens Google Play.
- **Reminder before the first charge:** Google Play handles payments and its own receipts. Check in Play Console whether Google sends a reminder before the trial ends. If it doesn't, ask for an in-app reminder on day 2; the user's trial end date is in `billing_subscriptions.trial_end`.
- **GST:** Play collects and remits GST on in-app sales in India. Check with your CA how it shows in your books.
