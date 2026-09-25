# Runbook: Social Layer Incidents

All social mitigations are made in **Admin → Social Studio**. Every kill switch and policy change creates a new, audited policy version, propagates to all API instances within about 5 seconds (Redis epoch), and can be rolled back from **Configuration → Version history**. Blocking and reporting can never be switched off.

Core chat does not depend on the social layer: killing any social feature must never affect conversations with characters.

---

## 1. Mass spam / bot wave

**Symptoms:** Graph health shows `abnormalFollowVelocity` or `newAccountBursts`; spike in `COMMENTS` / `USER_CONTENT` queue volume; reports/1k content rising.

1. Overview → confirm the reports/1k and rejection-rate guardrails.
2. Configuration → patch rate limits (e.g. `rateLimits.comment.limit`, `rateLimits.follow.limit`) or `abuse.newAccountRateMultiplier` (e.g. `0.1`).
3. If content is flowing faster than moderation: kill switch `comments` and/or `reactions`.
4. Investigations → look up the top offenders → `SOCIAL_RESTRICTED · 72h`.
5. Roll back limits once the queue drains.

## 2. Mass harassment / brigading of a user or creator

1. Moderation → filter `COMMENTS` / `PROFILES` → action by priority (severity dominates; report count alone never decides).
2. Restrict offenders (`CANNOT_COMMENT` / `SOCIAL_RESTRICTED`).
3. For a targeted creator: temporarily patch `moderation.autoHideReportThreshold` down **only together with** `autoHideRequiresAutomatedSignal: true` (never hide on report count alone).
4. Contact the target through support with blocking and privacy guidance (`whoCanComment`, `whoCanMention` → `FOLLOWERS` / `MUTUALS`).

## 3. Account-takeover campaign

1. Kill switches: `messaging`, `message_requests` (stops phishing via DMs); consider `mentions`.
2. Follow SECURITY_INCIDENT.md for session revocation.
3. Graph health → `messageRequestAbuse` (high block rate + low acceptance) → restrict senders.

## 4. Malicious community

1. Moderation → `COMMUNITIES` queue → `RESTRICT_CONTENT` (community becomes `RESTRICTED`) or `REMOVE_CONTENT` (`SUSPENDED`; invisible).
2. Restrict the owner (`CANNOT_CREATE_COMMUNITIES`).
3. Platform-wide: kill switch `communities` / `creator_communities`.

## 5. AI-generated spam or unsafe AI posts

1. Kill switch `character_social_actions` (stops all character actions, including scheduled ones: the scheduler checks before spending) and/or `ai_social_posts`.
2. AI Social Actions tab → identify the character(s) → **Revoke** social approval.
3. Moderation → `AI_SOCIAL_CONTENT` queue → hide/remove.
4. If budget-related: patch `aiSocial.globalDailyBudgetCents`.

## 6. Notification storm

1. Kill switch `social_notifications` (in-app social notifications stop; moderation notices still send).
2. Check `social-fanout` queue depth (QUEUE_BACKLOG.md). Fanout is batched and cursor-driven, so draining is safe.
3. Tune `notifications.aggregationWindowSeconds` (up) or `maxSocialPerRecipientPerDay` (down), then release.

## 7. Social feed failure

- Ranking errors automatically serve chronological results with `degraded: true` (the client shows a banner).
- If candidate queries overload the database: kill switch `social_feed`, or patch `feed.maxRecencyDays` down.
- Redis loss: ranked-list caching and fatigue are skipped; correctness is unaffected (every page is re-gated from PostgreSQL).

## 8. Messaging outage

Kill switch `messaging`. Pending requests keep their expiry. Threads resume on release. Core chat is unaffected.

## 9. Moderation outage (reviewers unavailable / queue backlog)

Content that needs human review stays `PENDING_MODERATION` (never auto-published). If the backlog is critical: kill switches `public_conversation_sharing` and `comments` to stop inflow, then drain by priority.

## 10. Privacy incident (PII / credential leak in shares)

**Symptoms:** Automated scan alarm or user report of exposed credit card, API key, address, or credentials in a public share.

1. **Immediate Quarantine:** Admin → Social Studio → Moderation → lookup by `publicId` → `REMOVE_CONTENT` (instantly marks content `REMOVED` and wipes public caches).
2. **Revoke Snapshot:** If shared via deep link, execute revocation via `SocialRevocationService.revokeShare(id)`.
3. **Audit Exposure:** Inspect access logs for unique viewers and CDN hits while the item was live.
4. **Scanner Update:** If PII escaped detection, capture anonymized text structure as a regression test in `tests/social/socialUnit.test.ts` and patch `PiiDetector.ts` regex/validation rules.
5. **Kill Switch (if systemic):** If a model or prompt injection caused systemic leakage, activate kill switch `public_conversation_sharing` until patched.

## 11. Account deletion failure / stuck deletion worker

**Symptoms:** Alert `AccountDeletionWorkerFailure` or metric `stuck_deletion_requests > 0`.

1. **Check Leases & Locks:** Query `account_deletion_requests` where `status = 'PROCESSING'` and `locked_until < NOW()`.
2. **Review Step Log:** Inspect `step_log` and `last_error` for the failing step (e.g. `MEDIA_CLEANUP` or `ANALYTICS_ANONYMIZATION`).
3. **Reconcile:** Trigger manual reconciliation:
   ```bash
   pnpm --filter @ai-companion/api exec tsx -e "import { AccountDeletionService } from './src/modules/privacy/services/AccountDeletionService.js'; await AccountDeletionService.reconcile();"
   ```
4. **Crash Recovery:** If worker crashed, expired leases are automatically reclaimed by the next available worker; completed steps recorded in `completed_steps` are skipped.
5. **Terminal Failures:** If `attempts >= MAX_ATTEMPTS (6)`, status is set to `FAILED`. Escalate to on-call database engineer to resolve underlying FK constraint or deadlocks.

## 12. Database inconsistency / orphaned social records

**Symptoms:** Discrepancy between follower counts and actual `UserFollow` rows, or orphaned comments pointing to deleted parents.

1. **Integrity Check:** Run `SocialIntegrityService.runFullAudit()` via Admin Studio or CLI.
2. **Counter Reconcile:** For affected handles:
   ```bash
   pnpm --filter @ai-companion/api exec tsx -e "import { SocialGraphService } from './src/modules/social/graph/SocialGraphService.js'; await SocialGraphService.reconcileCounters(['user_uuid_here']);"
   ```
3. **Orphan Cleanup:** Execute idempotent soft-delete on orphaned comments whose parent or target content is `DELETED`.

## 13. Cache corruption / stale social authorization

**Symptoms:** A blocked user appears in feed recommendations, or an unblocked user cannot view public profiles.

1. **Rule of Truth:** The database (`UserBlock`) is the single authoritative source of truth. Redis cache NEVER authorizes mutations.
2. **Feed Cache Invalidation:** Invalidate user's feed cache:
   ```bash
   pnpm --filter @ai-companion/api exec tsx -e "import { SocialFeedService } from './src/modules/social/feed/SocialFeedService.js'; await SocialFeedService.invalidate('user_uuid_here');"
   ```
3. **Purge Epoch:** Bump the policy epoch key `social:policy:epoch` in Redis to force all nodes to reload policy.

## 14. Event-bus / outbox backlog failure

**Symptoms:** `social_event_outbox` contains rows in `PENDING` with `attempts > 3` or `available_at < NOW() - 5m`.

1. **Inspect Worker:** Verify BullMQ worker for `social-fanout` is running and healthy (`QUEUE_BACKLOG.md`).
2. **Check Dead Letters:** Inspect failed jobs in BullMQ dashboard.
3. **Re-queue Pending Outbox:** Outbox worker will re-attempt rows up to 5 times with exponential backoff before marking `FAILED`.
4. **Deduplication Safety:** Every consumer checks `social_event_receipts` before side effects, so re-dispatches will not produce duplicate notifications or follows.

## 15. Complete social outage

**Symptoms:** Widespread 5xx errors across `/api/v1/social/*` endpoints.

1. **Verify Isolation:** Confirm core chat, memory, and billing continue to operate normally (social failures MUST NOT take down character 1-to-1 chat).
2. **Global Social Kill Switch:** If social database queries or fanout are saturating PostgreSQL:
   - In Admin Studio, toggle `social_feed`, `social_publishing`, `social_messaging`, `communities`, `comments`, and `reactions` to `DISABLED`.
   - All endpoints return immediate HTTP 503 / 403 feature disabled responses, relieving database load.
3. **Database Health:** Check PostgreSQL connection count and lock contention (`DATABASE_OUTAGE.md`).
4. **Drain & Restore:** Once database settles, enable features sequentially: `social_identity` → `user_following` → `social_feed` → `comments` → `messaging`.

---

## Verification after mitigation

- Overview guardrails trending back to baseline.
- Simulator: re-run representative User A → action → User B test cases.
- Roll back temporary policy versions (history displays the visual diff of each change).

## Escalation

- **Primary:** Trust & Safety on-call
- **Secondary:** Social platform engineer on-call → Head of Trust & Safety for account-level enforcement

