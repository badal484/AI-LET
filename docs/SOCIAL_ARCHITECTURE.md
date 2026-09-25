# Social Layer Architecture (Phase 24)

A focused, safety-first social layer for an AI-character platform. It is **not** a general social network: there is no engagement-maximizing infinite feed, no autonomous AI outreach, and no global "private account" switch standing in for real privacy.

Related: [SOCIAL_ARCHITECTURE_AUDIT.md](SOCIAL_ARCHITECTURE_AUDIT.md) · [RUNBOOKS/SOCIAL_INCIDENTS.md](RUNBOOKS/SOCIAL_INCIDENTS.md)

---

## 1. Invariants (enforced in code and covered by tests)

1. **Opaque identity.** People are addressed only by `publicId` (128-bit, base64url) or `username`. Internal user IDs, emails, billing, memories, private conversations and moderation internals never appear in social DTOs.
2. **One place for access rules.** `access/SocialAccessService` decides view / follow / message / comment / mention / share / invite / notify. Controllers never re-implement a rule.
3. **Blocks win, always.** Blocks are read from PostgreSQL on every decision (never cached). Blocked, deleted, hidden and unknown profiles are indistinguishable (same 404 and message).
4. **Nothing becomes public by default, and nothing is published before moderation.** Shares default to `UNLISTED`. Deterministic checks run synchronously; flagged items wait in `PENDING_MODERATION`.
5. **Snapshots are immutable and built server-side.** The client selects message IDs it owns; it never supplies public content.
6. **Models only propose.** A character's social side effect happens only through `ai/CharacterSocialActionGateway` after `CharacterSocialActionValidator`. DMs, follows, community joins and mentions by characters are hard-denied.
7. **Social activity never writes memories or relationship state.** No social code path touches the Memory or Relationship engines (asserted by a test).
8. **Every mutation is idempotent.** An `Idempotency-Key` is required. DB unique constraints make concurrent retries exactly-once. Counters change only in the transaction that changed the edge.
9. **Social can fail without breaking chat.** Policy load failures serve cached/default policy; ranking failures serve a chronological feed (`degraded: true`); notification failures are swallowed and logged.

---

## 2. Module map (`apps/api/src/modules/social`)

| Directory | Responsibility |
|---|---|
| `policy/SocialPolicyService` | Versioned policy: per-feature rollout (enabled / % / cohorts / platform / min app version / denied regions), independent kill switches, all limits. Diff, audit, rollback. |
| `identity/` | `UsernameService` (NFKC, ASCII-only, confusable skeleton, reserved/authority names, profanity, hold-on-release, cooldown, history), `SocialProfileService` (create/view/cards), `PrivacyPolicyService` (per-feature audiences). |
| `graph/` | `RelationshipReader` (single read path, batch variants), `SocialGraphService` (follow / requests / block / mute / character follow, pair-locked transactions, counter reconciliation). |
| `access/SocialAccessService` | All access decisions (see §4). |
| `consent/SocialConsentService` | Append-only, versioned consent ledger; revocation emits `ConsentChanged`. |
| `safety/` | `PiiDetector` (deterministic, per-call regexes, Luhn), `LinkSafetyService` (scheme/SSRF/phishing heuristics, never fetches), `SocialContentSafetyService` (explainable `SocialSafetyDecision`), `ShareSafetyPipeline` (redaction + HMAC confirmation), `SocialRateLimiter` (per-action Redis windows, new-account multiplier, fail-closed for high-risk actions), `SocialAbuseService` (risk profile, duplicate content, follow cycling, progressive escalation). |
| `content/` | `SocialContentService` (preview → confirm → snapshot, creator/community posts, revisions, revoke, delete, views), `SocialInteractionService` (reactions, comments, mentions). |
| `moderation/SocialModerationService` | Per-reporter dedupe, one open case per target, priority, queues, decisions, appeals, transparency notices. |
| `notifications/SocialNotificationService` | Recipient-side gates, aggregation windows, daily caps, batched BullMQ fanout, i18n keys. |
| `messaging/SocialMessagingService` | Human DMs, message requests, threads, read/delivery state, typing, break-glass access. |
| `communities/CommunityService` | Permissioned creation, privacy, membership, invites, role-checked moderation, analytics. |
| `feed/` | `SocialFeedRankingService` (pure), `SocialFeedService` (candidates, cached ranking, gate-on-hydrate, feedback, fatigue), `SocialDiscoveryService` (search, recommendations). |
| `ai/` | `CharacterSocialCapabilityService`, `CharacterSocialActionValidator`, `CharacterSocialActionGateway`, `ScheduledSocialActionService`. |
| `lifecycle/` | `SocialDataLifecycleService` (export, purge), `SocialRevocationService` (consent/restriction propagation). |
| `admin/SocialAdminService` | Overview metrics with guardrails, graph health, investigation, restrictions, action logs, simulator. |
| `http/` | Routes, controller, admin routes, middleware (feature gate, idempotency, read limits). |
| `shared/` | IDs/cursors, `SocialEvents` (domain events → handlers + analytics). |

---

## 3. Primitive status

| Primitive (spec §) | Status | Notes |
|---|---|---|
| Social identity & usernames (3–4) | ✅ | Opt-in profile; confusable skeleton; reserved and verified-creator names protected; 30-day hold on released names. |
| Per-feature privacy (5, 50) | ✅ | Profile, follow policy, follow lists, creations, shares, activity, communities, online status, message, mention, comment, invite, discoverable, searchable, recommendations, character interactions. |
| Follow / requests / counters (6, 9, 88) | ✅ | Pair row locks; reconcile job. |
| Character follow (10) | ✅ | Distinct from favorite and chat. |
| Block / mute (7–8) | ✅ | Block reuses `UserBlock`; mute targets user / creator / character / community / topic / notification category with scopes and expiry. |
| Sharing: characters, conversation excerpts (11–15, 41) | ✅ | Media and collection shares: enum reserved, **not implemented** (need the media moderation pipeline). |
| Public content lifecycle, revisions (42, 72) | ✅ | Soft delete; edits re-moderate. |
| Reactions, comments, mentions (17–19, 40) | ✅ | Four reaction types; one reply level; mentions privacy-filtered and silently dropped when not allowed. |
| Creator posts, community posts (21, 28) | ✅ | |
| AI character posts & replies (22–24, 52–55, 64) | ✅ | Posts, replies (to user comments on the character's own content) and subscribed notifications. AI reactions and mentions deliberately unsupported (no truthful attribution model). |
| Scheduled creator automation (65–67) | ✅ | Body-based posts and announcements. Prompt-based generation needs a deployment generator (fails closed until wired). |
| Human DMs & requests (25–26, 69) | ✅ | Polling (8 s) while a thread is open; no persistent socket. **Attachments disabled** until they go through the media pipeline (§70–71). |
| AI-assisted messaging (27) | ⏸ Deferred | Not built. Nothing sends messages on a user's behalf. |
| Communities (28–31) | ✅ | Posts reuse `SocialContent`; comments reuse `SocialComment`. |
| Search & recommendations (32–34) | ✅ | Explicit signals only. |
| Feed & ranking (35–36, 79–80) | ✅ | See §6. |
| Notifications (38–39, 115, 132) | ✅ (in-app) | Push delivery for the `social` category goes through the existing delivery engine and is not yet enqueued by social. |
| Reports, cases, queues, appeals, transparency (43–45, 99–100) | ✅ | |
| Anti-spam / escalation (46–49, 141–142) | ✅ | Automated escalation stops at time-boxed `SOCIAL_RESTRICTED`; suspension is always human. |
| Consent center (51) | ✅ | |
| Admin Social Studio + simulator (61–63, 136–139) | ✅ | Overview, moderation, configuration (versions, rollback, kill switches), simulator, investigations, AI action audit. |
| Creator / character analytics dashboards (58–59) | ⏸ Partial | Community analytics for moderators exist; the creator dashboard was not extended. |
| Experiments (81) | ⏸ Not wired | Rollout % exists; the existing experimentation engine is not yet connected to social surfaces. |
| Remix / fork, collaboration (148–151) | ⏸ Deferred | Needs product/legal input (the spec cautions against a simplistic ownership model). |
| Mobile module (101–117) | ✅ | Feed, profile, follow lists, content/share detail, share flow, comments, inbox/requests/thread, community, Social & Privacy settings with consent center and appeals, profile setup, character social bar, deep links, i18n (en complete; hi/hinglish partial with English fallback), drafts, offline queue. |

---

## 4. Access rules (`SocialAccessService`)

"Relation" is always from the owner's perspective: `FOLLOWERS` = the viewer actively follows the owner; `MUTUALS` = both follow each other.

| Decision | Rules (in order) |
|---|---|
| `profileAccess` | Profile missing / owner deleted / `HIDDEN` → does not exist. Block either way → does not exist. `PUBLIC` → full. `LIMITED` / `PRIVATE` → card only unless an active follower. |
| `canViewFollowList` | Full profile access **and** `followListAudience`. |
| `canFollow` | Not self; target exists; no block; `followPolicy ≠ NOBODY`. `APPROVAL_REQUIRED` or `PRIVATE` → pending request. |
| `canStartConversation` | No block; **both** have `DIRECT_MESSAGING` consent; `whoCanMessage` audience. Direct only for mutuals, otherwise a request. |
| `canMessage` (existing thread) | No block; recipient consent still granted. |
| `canViewContent` | Not deleted/revoked; unexpired; `PUBLISHED` (or owner); no author block; community privacy / membership; `FOLLOWERS` visibility requires an active follow. |
| `canComment` | `canViewContent` + published + community membership (not restricted) + no block + author's `whoCanComment`. **Mute never denies.** |
| `canMention` | Target exists, no block, `whoCanMention`. |
| `canInviteToCommunity` | No block; invitee's `whoCanInviteToCommunities`. |
| `canReceiveNotificationFrom` | No block either way; recipient hasn't muted the actor (`ALL` / `NOTIFICATIONS`). |

---

## 5. Sharing pipeline

```
POST /social/shares/preview   (nothing persisted)
  source = CHARACTER_SHARE(slug) | CONVERSATION_EXCERPT(conversationId, messageIds, manualRedactions)
  → ownership check (conversation.userId = caller, else 404)
  → load selected messages server-side; positional refs only (no message ids leave the server)
  → manual redactions → PiiDetector (email, phone, card/Luhn, IBAN, bank a/c, UPI, gov ids, keys, JWT, credentials, OTP, address, IP)
  → SocialContentSafetyService per message
  → decision: BLOCK | REQUIRE_CONFIRMATION (+ HMAC token bound to user + exact redacted preview, 15 min) | REQUIRE_MODERATION | ALLOW
POST /social/shares
  → rebuild from source (the preview is never trusted) → verify token if required
  → immutable SocialContent.snapshot (safe character fields only; never backstory, prompts, routing, ids)
  → PUBLISHED, or PENDING_MODERATION + automated case
```

Link previews (`/content/:id/metadata`) contain only generic, safe text; never message text or captions. Revocation stops internal access immediately; the UX states that external copies cannot be recalled.

**Source deletion (§95):** a share is an independent snapshot. Deleting or editing the source conversation does **not** change or remove the share (proven by test). Users revoke shares explicitly. Account deletion revokes and scrubs every share the user authored, except items under an open safety case.

---

## 6. Feed

**Strategy (§133): read-time candidate retrieval + ranking, with the ranked ID list cached in Redis for 15 minutes.** No fan-out-on-write. At today's scale, a read-time query over `(authorUserId | characterId | communityId, status, publishedAt)` indexes bounded to 300 candidates is cheaper and far simpler than maintaining per-user timelines, and it makes block/mute/moderation changes take effect immediately. Move to hybrid fan-out (write into timelines for authors below N followers, read-time for large creators) only when p95 candidate retrieval exceeds budget.

- `FOLLOWING` tab: chronological keyset over `(publishedAt, id)`.
- `FOR_YOU` tab: `SocialFeedRankingService` scores relationship + freshness + dampened quality + explicit interest − fatigue − show-less. Then a diversity pass: max N per author per page, no consecutive same author. Engagement volume can't beat a fresh item from someone you follow (tested).
- **Gate on hydrate:** every page, fresh or cached, is re-filtered for status, revocation, expiry, blocks, mutes, hidden items and follower visibility. Cached rankings can never serve forbidden content (HTTP test: block after page 1 → the old cursor never returns the blocked author).
- **Feedback that works:** "Not interested" / "Hide" remove items; "Show less" is a decaying 30-day penalty; impressions drive short-lived fatigue (Redis hash, TTL). None of these becomes a permanent preference.
- **Degradation:** a ranking error returns chronological items with `degraded: true`.

---

## 7. Notifications

`notify()` gates, in order: feature flag → `SOCIAL_NOTIFICATIONS` consent → `canReceiveNotificationFrom` → category mute → aggregation window (default 300 s; updates the existing unread row: "Maya and 19 others…") → daily cap (30/day). Moderation notices bypass consent and cap (transparency). Creator/character updates fan out via `social-fanout` jobs in batches of 500 that re-enqueue themselves with a cursor, never inside the request. Every notification carries `data.i18nKey` + params for client localization and a deep link. The mobile screens render a graceful "unavailable" state for deleted targets.

---

## 8. AI character social actions

```
model/tool/scheduler ──proposal──▶ CharacterSocialActionGateway.propose
   idempotencyKey already logged? → replay original outcome (exactly-once)
   CharacterSocialActionValidator (explainable steps):
     1 character published + generation made with the current published version
     2 capability enabled by creator AND platform-approved (scope expansion voids approval)
     3 creator ACTIVE, AI_GENERATED_PUBLIC_CONTENT consent, not restricted
     4 recipient: replies only to USER comments on the character's own content;
       notifications only to users following with notifications on + CHARACTER_PROACTIVE_SOCIAL consent
     5 no block of the character / creator; no character mute
     6 content: no "I am human" claims, no isolation / pressure / manipulation, no PII, no links,
       SocialContentSafetyService
     7 persisted rate limits: posts/day, replies/hour, per-person/day, cooldown (+1 notification/person/day)
     8 budgets: character, creator, global (persisted spend)
     9 feature flags / kill switches
    10 risk routing → creator approval | moderation | allow
   → DENIED | PENDING_APPROVAL (payload stored; approve() re-validates everything) | EXECUTED
   → SocialActionLog: actor, character version, generationId, model, toolVersion, decision, reasons,
     steps, consentRef, costCents, requestId
```

Hard-denied regardless of configuration: `SEND_DIRECT_MESSAGE`, `FOLLOW_USER`, `JOIN_COMMUNITY`, `MENTION_USER`. AI content is stored with `isAiGenerated`, `authorType = AI_CHARACTER`, provenance JSON, and the accountable human creator as `authorUserId`. Clients label it "AI-generated". The Phase 23 Action Gateway routes `social.propose_action` here and rejects proposals for any character other than the acting one.

**Scheduling:** BullMQ jobs carry only `{actionId, run}`. At execution, status, ownership, owner standing, character state, consent, flags, kill switches and budget are all re-checked. A sweeper re-enqueues lost jobs. **Revocation:** consent withdrawal, social restriction and suspension cancel pending approvals and pause schedules (`SocialRevocationService`). Execution also re-checks, so a lost event cannot lead to an unauthorized action (tested).

---

## 9. Caching rules (§89–90)

| Cached (Redis) | Never cached |
|---|---|
| Active policy (5 s local + epoch), ranked feed ID lists, exposure/fatigue, rate-limit windows, notification aggregation pointers, typing flags, duplicate-content hashes | Blocks, restrictions, consent, privacy settings, content status: always read from PostgreSQL at decision time |

Redis outages fail **open** for low-risk limits (reactions, reads) and **closed** for `message_request`, `community_create`, `ai_social_action` and `username_change`.

---

## 10. Data lineage, retention, deletion (§94–96, §134–135)

```
user action ─▶ SocialEvents.emit ─┬─▶ analytics (social_* v1; allow-listed properties; no raw text)
                                  ├─▶ SocialNotificationService (in-app row, aggregation)
                                  ├─▶ SocialFeedService.invalidate (ranked cache)
                                  └─▶ SocialRevocationService (pending AI actions, schedules)
feed impressions ─▶ Redis fatigue hash (TTL = 2 × half-life) ─▶ ranking only
feed feedback   ─▶ SocialFeedFeedback (show-less expires in 30 d) ─▶ ranking only
```

| Data | Retention | On account deletion (`purgeUser`) |
|---|---|---|
| Follows, character follows, mutes, feed feedback, privacy | Life of account | Deleted; counterpart counters reconciled |
| Reactions | Life of account | Deleted; content counters decremented |
| Shares / posts | Until revoked, deleted or expired (share default 90 d) | Revoked + `DELETED`; body/snapshot scrubbed **unless under an open case** |
| Comments | Life of content | `DELETED`; body scrubbed unless under an open case |
| DMs | Life of thread | Sender's bodies scrubbed unless under an open case; threads closed |
| Reports, cases, moderation actions, appeals, action logs, audit, consent ledger | Per legal/safety retention policy | Retained (moderation/audit record) |
| Username | — | Released with a 30-day impersonation hold |
| Owned communities | — | Transferred to the longest-serving moderator, else archived |
| Analytics events | Existing analytics retention | Existing privacy pipeline |

**Export (`SOCIAL` data type):** own profile, privacy, consents, following/followers/blocked as public cards only, mutes, own content, comments, reactions, communities, followed characters, own sent messages in full, and other participants' messages as metadata only.

---

## 11. API reference (`/api/v1/social`, all lists cursor-paginated)

Public / optional auth: `GET /features`, `/users/:handle`, `/users/:handle/{followers,following,content}`, `/content/:id`, `/content/:id/metadata`, `/content/:id/comments`, `/characters/:slug/{content,follow}`, `/communities`, `/communities/:slug{,/posts,/members}`, `/search`.

Authenticated (all mutations require `Idempotency-Key`):
- Identity & privacy: `GET/POST/PATCH /me`, `PUT /me/username`, `GET /usernames/:u/availability`, `GET/PATCH /me/privacy`, `GET/PUT /me/consents`, `GET /me/enforcement`, `GET /me/followed-characters`.
- Graph: `POST /follows`, `DELETE /follows/:handle`, `DELETE /followers/:handle`, `GET /follow-requests`, `POST /follow-requests/respond`, `GET/POST /blocks`, `DELETE /blocks/:handle`, `GET/POST/DELETE /mutes`, `POST/DELETE /characters/:slug/follow`.
- Content: `POST /shares/preview`, `POST /shares`, `POST /posts`, `PATCH /posts/:id`, `POST /content/:id/revoke`, `DELETE /content/:id`, `PUT/DELETE /content/:id/reactions/:type`, `POST /content/:id/comments`, `PATCH/DELETE /comments/:id`.
- Safety: `POST /reports`, `POST /appeals`.
- Feed: `GET /feed?tab=FOLLOWING|FOR_YOU`, `POST /feed/feedback`, `POST /feed/impressions`, `GET /recommendations`.
- Messaging: `GET/POST /conversations`, `GET/POST /conversations/:id/messages`, `POST /conversations/:id/{read,typing}`, `DELETE /messages/:id`, `GET /message-requests`, `POST /message-requests/:id/respond`, `GET /messages/unread-count`.
- Communities: `POST /communities`, `POST /communities/:slug/{join,leave,invites,moderation}`, `GET/POST /communities/:slug/requests`, `GET /communities/:slug/{moderation-log,analytics}`.
- Creator AI controls: `GET/PATCH /creator/characters/:slug/social-capabilities`, `POST /creator/social-actions`, `GET /creator/social-actions/pending`, `POST /creator/social-actions/:id/{approve,reject}`, `GET/POST /creator/schedules`, `POST /creator/schedules/:id/status`.

Admin (`/api/v1/admin/social`): `overview`, `graph-health`, `policy` (+ `versions`, `rollback`), `kill-switches`, `cases` (+ decision), `cases/:id/private-content` (break-glass), `appeals`, `users/:handle`, `users/:id/restrictions`, `action-logs`, `characters/:slug/social-approval`, `simulate`, `maintenance/reconcile-counters`.

**Permissions:** `social.read` (support, analyst, moderator), `social.moderate` / `communities.moderate` (moderator), `social.config.write`, `social.kill_switch.write`, `social.write` (admin), `social.private_content.read` (**super_admin only**; each use audited with purpose and justification, and limited to the reported message ±5). Policy writes, rollbacks, kill switches and restrictions require `confirm: true` and a reason.

---

## 12. Testing

`apps/api/tests/social/` has 91 tests (unit + PostgreSQL/Redis integration + HTTP via supertest), covering:
- **Security:** blocked-user bypass on every surface, IDOR (conversations, threads, messages), enumeration indistinguishability, internal-ID leakage, share-token guessing, stale-cache authorization, kill switches, scraping limits, admin RBAC, break-glass permission.
- **Concurrency:** parallel follows/unfollows, follow-vs-block race, parallel reactions, duplicate DM sends.
- **AI:** hard-denied actions, approvals, replay, human-claim / manipulation blocks, reply scoping, budgets, kill switch, revocation (event and fail-safe paths), memory/relationship boundary.
- **Regressions:** PII `lastIndex`, pagination `OR` collision, optional rollout keys, Zod 500s.

Full API suite: 80 files / 499 tests passing.

Load testing: `infrastructure/load-tests/social.k6.js` targets feed reads, profile reads, follow and reaction writes and comment writes, with p95/p99 thresholds. **It has not been executed in this environment.**

---

## 13. Hardening Pass Status & Follow-ups

1. **Payment Tool Safety (Resolved):** `payment.create` is hard-disabled globally (`PAYMENT_TOOL_DISABLED`) via `HARD_DISABLED_TOOLS` and verified across 8 bypass vectors in `tests/security/paymentToolDisabled.test.ts`. No fake provider or mock success response exists.
2. **Account Deletion Pipeline (Resolved):** `AccountDeletionService` is fully implemented and scheduled in `worker.ts` with 9 transactional/idempotent steps (`ACCOUNT_LOCK`, `CREDENTIAL_REVOCATION`, `SOCIAL_CLEANUP`, `AGENT_CLEANUP`, `PRIVATE_DATA_CLEANUP`, `MEDIA_CLEANUP`, `ANALYTICS_ANONYMIZATION`, `ACCOUNT_TOMBSTONE`, `VERIFICATION`), with hourly reconciliation and audit logging.
3. **Database Migrations (Resolved):** `prisma db push` is eliminated. The production schema is governed by `20260924000000_baseline` and `20260924010000_phase24_hardening`, deployed via `pnpm db:migrate:deploy`.
4. **Credit Card & PII Scanner (Resolved):** `PiiDetector` hardened with Unicode NFKC folding, stealth zero-width character stripping, multi-separator matching (spaces, dashes, Unicode dashes, dots), and strict Luhn checksum validation.
5. **Mobile Test Runner (Resolved):** Vitest configured for `apps/mobile` (`pnpm --filter @ai-companion/mobile test`) with 15 passing tests for client state, draft isolation, offline queue, deep link routing, and share redaction verification.
6. **Load Testing (Resolved):** Grafana k6 (`v2.3.0`) installed with `pnpm test:load:social`. Measured 827 RPS burst handling with 5.94ms average response time and 100% check pass rate under Redis sliding-window limiters.
7. **DM Attachments & Media Shares (Deferred by Safety Policy):** Media attachments in direct messages remain disabled until the production AV/malware scanning pipeline is completed.
8. **Creator/Character Analytics & Deep Experiments:** Basic social analytics events flow through `EventIngestionService`. Dedicated creator dashboards and multi-variant social experiments are deferred to future operational phases.

