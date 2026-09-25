# Creator Ecosystem & Operations Guide

Welcome to the **Creator Platform Operations Guide**! This document explains creator verification, character publishing standards, monetization payouts, and analytics.

---

## 1. Creator Verification Tiers

| Tier | Eligibility Criteria | Privileges & Benefits |
| :--- | :--- | :--- |
| **Standard (Unverified)** | Any registered user who accepts Creator Guidelines. | Create and publish up to 5 public characters; standard review queue. |
| **Verified Creator** | $\ge 1,000$ active conversations; 0 safety infractions in 60 days. | **Verified Blue Check badge**; priority moderation queue; up to 25 characters; custom voice samples. |
| **Partner Creator** | Invited editorial creators / studios with $\ge 50,000$ active conversations. | **Gold Partner badge**; dedicated support; early access to experimental voice models; featured homepage placement. |

---

## 2. Character Creation Guidelines & Quality Standards

1. **Rich Persona Design**: Every character must have complete identity data, background lore, distinct communication pacing, and a clear archetype.
2. **High-Resolution Imagery**: Avatars and cover art must be high-resolution, original, and compliant with safety standards. No blurry, stock, or watermarked imagery.
3. **Appropriate Tagging**: Accurate category and archetype tagging ensures the discovery algorithm surfaces the character to the right audience.
4. **No Copyright Infringement**: Creators must not copy copyrighted franchises or impersonate real individuals without documented intellectual property authorization.

---

## 3. Creator Monetization & Revenue Share

- **Revenue Share**: 70% Creator Net / 30% Platform Fee on paid character unlocks, premium gifts, and exclusive subscriptions.
- **Credit Accounting**: All earnings are tracked in immutable ledger records (`creator_earnings_ledgers`).
- **Payout Schedule**: Monthly payouts via Stripe Connect / Direct Bank Transfer on the 15th of each month for balances $\ge \$50$.
- **Chargeback & Fraud Protection**: 14-day settlement hold on high-volume transactions to safeguard against fraud.

---

## 4. Creator Analytics & Growth Loop

Creators have access to real-time analytics in their Creator Studio:
- **Conversation Starts**: Number of unique users who initiated a chat.
- **Message Depth**: Average turns per conversation (measures engagement).
- **D1 / D7 Return Rate**: Percentage of users who return to converse again.
- **Voice Usage Minutes**: Audio engagement duration.
- **Favorites & Reviews**: Community ratings and feedback snippets.
