# Social Architecture Audit — Phase 24

**Scope:** `apps/api`, `apps/admin`, `apps/mobile`, `packages/*`, `apps/api/prisma/schema.prisma`
**Date:** 2026-09-24
**Outcome:** the pre-existing Phase 24 code was a non-persistent prototype and has been replaced. Existing domains were extended rather than duplicated. Several defects outside the social module were found and are listed in §5.

---

## 1. What already existed

### 1.1 Social-adjacent functionality already in production code (reused, not duplicated)

| Concern | Existing implementation | Phase 24 decision |
|---|---|---|
| Blocks | `UserBlock` (user / character / creator targets) + `UserBlockService` (safety module) | **Reused as the single block table.** Added `@@unique([userId, blockedUserId])` and a reverse index `(blockedUserId, userId)`. Social blocks and "safety" blocks are the same rows, so there is one block system. |
| Creator follows | `CreatorFollow` + `CreatorProfileService.toggleFollow` | **Reused as the creator-audience relationship.** Following an active creator's person profile mirrors into `CreatorFollow`, so creator counts and discovery signals stay consistent. |
| Favorites | `UserFavorite` (user ↔ character) | Kept separate. Character *follow* is a new `CharacterFollow` table. Favoriting, following and chatting are three different relationships. |
| Account restrictions | `UserRestriction` + `EnforcementService` | **Reused.** Added `SOCIAL_RESTRICTED`, `CANNOT_COMMENT`, `CANNOT_DIRECT_MESSAGE`, `CANNOT_SHARE_CONTENT` and `CANNOT_CREATE_COMMUNITIES` to `AccountRestrictionType`. Progressive escalation (§142) writes here. |
| Character reports | `CharacterReport` + `ModerationCase` via `CharacterModerationService.submitUserReport` | **Reused.** Social reports against a *character* delegate to it, with reason codes mapped. Other social targets use new aggregated `SocialModerationCase`s, because `ModerationCase.characterId` is mandatory. |
| Audit | `AuditLog` + `AuditService` | Reused for every social mutation / admin action. |
| In-app notifications | `InAppNotification` + `InAppNotificationService` | Reused; added the `social` category. Aggregation updates the existing unread row rather than creating new rows. |
| Analytics | `AnalyticsEvent` + `EventIngestionService` (PII-stripping) | Reused. Social domain events map to the versioned `social_*` taxonomy (§118) with allow-listed properties only. |
| AI usage metering | `AIUsageEvent` + `AIEconomicsService.recordUsage` | Reused for AI social generation (no separate billing, §83). |
| Queues | `QueueManager` (BullMQ) | Added `social-fanout` and `social-actions` queues + worker processors. |
| Rate limiting / idempotency | `express-rate-limit`, `idempotencyMiddleware` (Redis) | Idempotency middleware reused behind a *mandatory* `Idempotency-Key` for social mutations. Per-action Redis counters were added because the global limiter can't express per-action limits (§141). |
| Negative feedback | `UserNegativeSignal` (character/creator hides) | Not reused for social feed: its targets are hard FKs to characters/creators. `SocialFeedFeedback` covers content/author/topic/community with decay. |
| Deep links | `companion://` + `https://companion.ai` linking config in mobile `App.tsx` | Extended with `/u/:handle`, `/p/:id`, `/share/:id`, `/community/:slug`, `/c/:slug`. |
| Feature flags | `FeatureFlag` table + `FEATURE_FLAGS` keys | **Finding:** no API code evaluates `FeatureFlag` rows or `FEATURE_FLAGS` keys. Social rollout lives in a versioned `SocialPolicyVersion` (per-feature enable / % / cohorts / platform / min app version / region + independent kill switches). The legacy `ENABLE_SOCIAL_*` keys are kept for compatibility but unused. |
| Kill switches | `KillSwitchService` (Redis, fixed key list) and `EmergencyKillSwitch` table | Not extended (its key union is closed, and it isn't versioned). Social kill switches are part of the versioned policy and propagate across instances via a Redis epoch (≤5 s). |

### 1.2 The previous "Phase 24" implementation (removed)

`apps/api/src/modules/social/*` (16 files, ~2,400 lines), `apps/api/tests/socialPlatform.test.ts` and `apps/mobile/src/services/api/socialApi.ts` existed before this work. Every service held state in process-local `Map`s seeded with demo users (`user_elena`, `user_creator_001`). Defects:

| # | Defect | Impact |
|---|---|---|
| P1 | No persistence: follows, blocks, shares, comments, DMs and communities lived in memory. | All data lost on restart; inconsistent across API instances. |
| P2 | Social blocks were a separate in-memory list, disjoint from `UserBlock`. | A user blocked in the core app was not blocked in social (and vice versa). |
| P3 | `GET /social/profiles/:userId` addressed people by internal user UUID. | Enumeration and exposure of internal identifiers (violates §3/§91). |
| P4 | `POST /social/shares` accepted a client-supplied `snapshotPayload`. | The **client** decided what became public; nothing tied a share to data the user owned. |
| P5 | Shares were created with `moderationStatus: 'APPROVED'`. | Publish-then-moderate for all content (violates §16). |
| P6 | `ShareSafetyPipeline` called `.test()` on a module-level `/g` regex (card check) with no subsequent `.replace()`. | `lastIndex` persisted between calls, so the next share could **miss credit-card numbers** (intermittent PII leak). Regression test added. |
| P7 | Profile visibility defaulted to `PUBLIC`; one visibility flag stood in for all privacy. | Not privacy-first; §5 requires per-feature privacy. |
| P8 | Mute of a commenter *denied* commenting. | Mute behaved as a partial block (§8 requires mute ≠ block). |
| P9 | AI character rate limits and budgets were in-memory counters. | Reset on restart; bypassable by horizontal scaling. |

The prototype was backed up before removal and is fully superseded.

---

## 2. Areas inspected with no social functionality

- **Comments, reactions, public posts, communities, human DMs, message requests, username system, social feed, social search:** none existed.
- **Mobile:** no social screens, no i18n library (strings were hardcoded English), no general persistent key-value storage (only `SecureAuthStorage` with a pluggable engine).
- **Admin:** no social pages.

## 3. Phase 23 (agents) findings relevant to social

- `ToolExecutionGateway`, `CharacterCapabilityService`, `UserConsentService` etc. are **in-memory**; capabilities default to disabled and reset on restart. Social actions therefore do **not** rely on them. `social.*` tool calls arriving at the Action Gateway are handed to the durable `CharacterSocialActionGateway`, bound to the acting character.
- ⚠️ `ToolExecutionGateway` `payment.create` returns a fabricated `SUCCESSFUL` transaction without calling any payment provider. **Not changed in this phase**, but it should be fixed or disabled before any production use.

## 4. Privacy pipeline findings

- `PrivacyService.requestAccountDeletion` records a request, but **no executor processes deletion requests**. `SocialDataLifecycleService.purgeUser()` is ready to be called by that executor; wiring the executor itself is outside this phase.
- `generateExportArchive` produces a simulated download URL. A `SOCIAL` section was added to the export payload.

## 5. Platform defects found and fixed during this phase

| Defect | Fix |
|---|---|
| **Validation errors returned HTTP 500 platform-wide.** `@ai-companion/validation` compiles to CommonJS and loads zod's CJS build, while the ESM API loads zod's ESM build, so `err instanceof ZodError` is `false` for every shared schema (dual-package hazard). Every controller that validated with shared schemas (creators, notifications, …) returned `500 INTERNAL_SERVER_ERROR` for bad input and logged it as an unhandled exception. | `errorHandler` also detects Zod errors structurally (`name === 'ZodError'` + `issues` array). Covered by an HTTP test. |
| BullMQ rejects custom job IDs containing `:` unless there are exactly three segments. | Social job IDs use `.` separators (would otherwise have crashed paginated fanout). |

## 6. Architecture decisions

See [SOCIAL_ARCHITECTURE.md](SOCIAL_ARCHITECTURE.md) for the full design. In summary:

1. **Separate public identity** (`SocialProfile`) with an opaque 128-bit `publicId`. Internal IDs, emails, billing, memories and conversations never appear in social DTOs.
2. **One access-decision service** (`SocialAccessService`). Every endpoint consults it. Blocks are always read from PostgreSQL, never from cache.
3. **Server-built immutable snapshots** for sharing, preceded by a deterministic PII pipeline and a confirmation token bound to the exact redacted preview.
4. **Pre-publication moderation.** Automated checks run synchronously; anything uncertain waits in `PENDING_MODERATION`.
5. **AI boundary.** Models only *propose*. `CharacterSocialActionValidator` runs 10 ordered checks, and `CharacterSocialActionGateway` is the only executor. Character-initiated DMs, follows, community joins and mentions are hard-denied.
6. **Versioned social policy** covering feature rollout, kill switches, limits and moderation thresholds, with diff, audit and rollback.
