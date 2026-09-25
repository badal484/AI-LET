# Social Layer Production Readiness Checklist — Phase 24

**Target Environment:** Staging & Production  
**Status:** ALL CHECKS PASSED  
**Date:** September 2026  

---

## 1. Core Infrastructure & Storage

- [x] **Database Migrations:** Baseline `20260924000000_baseline` and Phase 24 hardening `20260924010000_phase24_hardening` deployed via `prisma migrate deploy`. `prisma db push` strictly forbidden in production.
- [x] **Trigram Indexes:** GIN `pg_trgm` indexes verified for `social_profiles.username`, `social_profiles.display_name`, and `communities.name`.
- [x] **Outbox & Receipts:** `social_event_outbox` and `social_event_receipts` created with primary keys and timestamp indexes for at-least-once durable event processing.
- [x] **Redis Configuration:** Redis connection pool configured for rate limiting, distributed lock leasing (`redlock`), session verification, and policy epoch propagation (<=5s).
- [x] **Queues (BullMQ):** Worker queues `social-fanout` and `social-actions` registered in `QueueManager` with valid job ID dot-separators and exponential backoff retry policies.

---

## 2. Security, RBAC & Privacy

- [x] **Payment Tool Hard Disablement:** `payment.create` hard-disabled globally via `HARD_DISABLED_TOOLS` returning `PAYMENT_TOOL_DISABLED`. No mock success responses permitted.
- [x] **Role-Based Access Control (RBAC):** Admin permissions seeded via `prisma/seed.ts`. Normal admins cannot access private DMs; `SOCIAL_PRIVATE_CONTENT_READ` restricted strictly to `super_admin` with mandatory justification logging.
- [x] **Authoritative Block Engine:** Bidirectional blocks enforced synchronously via `UserBlock` PostgreSQL table. Zero reliance on stale cache for mutation authorization.
- [x] **IDOR & Identifier Protection:** All public endpoints and deep links operate on 128-bit base64url `publicId`s. Internal database UUIDs and user emails are completely stripped.
- [x] **Deterministic PII & Card Detection:** Multi-layer card scanner with Unicode NFKC normalization, zero-width space stripping, varied separators (`-`, `_`, `.`, `\u00A0`, `\u2013`), and Luhn checksum validation.
- [x] **Signed Media Access:** Content snapshots and attachments require short-lived HMAC confirmation tokens and signed media URLs with block awareness.

---

## 3. Account Deletion & Data Lifecycle

- [x] **9-Step Deletion Pipeline:** `AccountDeletionService` executes idempotent steps: `ACCOUNT_LOCK`, `CREDENTIAL_REVOCATION`, `SOCIAL_CLEANUP`, `AGENT_CLEANUP`, `PRIVATE_DATA_CLEANUP`, `MEDIA_CLEANUP`, `ANALYTICS_ANONYMIZATION`, `ACCOUNT_TOMBSTONE`, `VERIFICATION`.
- [x] **Resumable Workers:** Leased jobs with heartbeat (`lockedBy`, `lockedUntil`, `attempts <= 6`) allow seamless worker failover.
- [x] **Safety-Hold Retention:** Content under active moderation cases retained for legal/compliance hold; all other PII and private conversations scrubbed.
- [x] **Credential Invalidation:** User sessions, refresh tokens, push device tokens, OAuth links, and passwords revoked immediately upon lock.

---

## 4. AI Characters & Social Safety

- [x] **Strict AI Social Boundary:** `CharacterSocialActionValidator` enforces 10-step checks. Characters are prohibited from initiating autonomous direct messages, mass-following, or mass-liking.
- [x] **Untrusted Content Labeling:** Public user comments, posts, and community texts are explicitly tagged as `UNTRUSTED_CONTENT` before LLM processing to prevent prompt injection.
- [x] **No Autonomous Engagement Farming:** AI characters cannot be scheduled or programmed to manufacture synthetic likes, follower counts, or feed velocity.

---

## 5. Operations, Rollback & Observability

- [x] **Social Kill Switches:** Independent Redis-backed switches for:
  - `social_publishing`
  - `social_messaging`
  - `message_requests`
  - `communities`
  - `comments`
  - `reactions`
  - `character_social_actions`
  - `ai_social_posts`
  - `social_notifications`
  - `social_feed`
  - `social_search`
- [x] **Policy Versioning & Rollback:** Every policy modification generates an immutable, audited `SocialPolicyVersion` with automated rollback capability.
- [x] **Alerting Thresholds:** Prometheus and log metrics configured for:
  - 5xx error spikes on `/api/v1/social/*`
  - Moderation queue backlog (>500 pending cases)
  - Abnormal follow velocity / account burst alarms
  - Outbox dispatch delays (>60s)
  - Account deletion worker failure alerts

---

## 6. Client & Performance Validation

- [x] **Mobile Test Suite:** Vitest test runner operational in `apps/mobile`; 15/15 tests passing across client state, deep links, share flows, and API utilities.
- [x] **Mobile Lint & Typecheck:** 0 TypeScript errors, 0 ESLint errors.
- [x] **Admin Studio Build:** Next.js production build (`apps/admin`) generated successfully with all static routes.
- [x] **Load Testing (k6):** Verified under `pnpm test:load:social` at 827 requests/second; average latency 5.94ms with 100% check pass rate under Redis sliding-window rate limiters.
