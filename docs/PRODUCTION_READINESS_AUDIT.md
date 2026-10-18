# Production readiness audit — Loveek

Audit date: 13 October 2026 · Branch `feat/happiness-engine-gemini-chat` (main is kept equal to it) ·
Auditor: Claude Code, working in the repository.

This is the register of findings. Each finding has an ID that the other documents refer to
(`RELEASE_BLOCKERS.md`, `SECURITY_REMEDIATION_LOG.md`, `KNOWN_LIMITATIONS.md`). Status values:
**Fixed** (code changed and verified), **Partly fixed** (code done, an outside step remains),
**Open**, **Accepted** (owner decision), **Info**.

## 1. What the system is

| Part | Technology | Where it runs |
|---|---|---|
| Android app | React Native 0.87 (Hermes, new architecture), TypeScript, TanStack Query, Notifee + Firebase Messaging, react-native-keychain | Users' phones; package `com.aicompanionmobile` |
| API | Node 24, Express, Prisma 6, zod validation, WebSocket live layer | Render web service `AI-LET` (Singapore, free plan) at https://ai-let-fgx6.onrender.com |
| Background jobs | BullMQ worker (`src/worker.ts`) **or** the API itself (`RUN_SCHEDULED_JOBS_IN_API=true`) | No worker deployed yet |
| Database | PostgreSQL 16 + pgvector | Neon (us-east-1), free plan |
| Cache, rate limits, live events | Redis | Upstash (TLS), free plan |
| Admin console | Next.js 15 (`apps/admin`) | Not deployed |
| AI | Google Gemini API (`GOOGLE_AI_API_KEY`) | Google |
| Push | Firebase Cloud Messaging (server sends with a service account) | Google |
| Payments | Google Play Billing, verified on the server with the Play Developer API | Built, switched off (no Play Console products yet) |
| Email | Resend (password reset) | Built, needs an account and a domain |

The app is a chat app with 32 AI characters (romance, friendship, health, learning, astrology).
Users sign up with email and password. Data per user: account, profile, chats, what characters remember
(memories, embeddings), reminders, notification settings, support messages, purchases.

## 2. Evidence collected

| Check | Result | Evidence |
|---|---|---|
| API type check | Pass | `pnpm -r typecheck`, exit 0 |
| API tests | **853/853 pass** (128 files), plus 5 new tests | `npx vitest run` in `apps/api` |
| Mobile tests | 17/17 pass; 1 suite fails to load (F-22) | `vitest run` in `apps/mobile` |
| Lint | Mobile error fixed; 67 mobile + 867 API warnings remain (mostly `any`) | `pnpm lint` |
| Dependency audit (prod) | 2 high, both build-time tools only (F-21) | `pnpm audit --prod` |
| Cross-user access | 64 user routes probed, no findings (12 Oct) | `scripts/security/crossUserAccess.ts` |
| Release bundle secrets | No server secrets, no demo credentials, no localhost | grep of production JS bundle and APK |
| 16 KB page size | All native libraries aligned, zip aligned | `llvm-readelf`, `zipalign -c -P 16` |
| Target API | 36 (meets the 31 Aug 2026 requirement) | `android/build.gradle` |
| Release build on a phone | The earlier arm64 R8 build ran on a real phone; the new 2-ABI build has not been on a phone yet | adb, 12 Oct |

## 3. Findings

| ID | Sev. | Area | Finding | Status |
|---|---|---|---|---|
| F-01 | High | Auth | "Forgot password" created a reset token but never sent it — anyone who forgot their password was locked out for good. | **Partly fixed** (e449166): Resend email + `/account/reset-password` page, 4 tests. Needs `RESEND_API_KEY`, `EMAIL_FROM` and a verified sending domain. |
| F-02 | High | Jobs / privacy | With no worker deployed, scheduled jobs never ran in production: **account deletions requested 14 days earlier never happened** (Play + DPDP promise), reminders never fired, campaigns and "text first" never sent. | **Partly fixed** (ed027f1): API can run the jobs with Redis locks; verified locally. Needs `RUN_SCHEDULED_JOBS_IN_API=true` on Render. |
| F-03 | High | Release | Release builds were signed with the public debug key; no upload-key setup. | **Partly fixed** (90529a6): upload key read from private Gradle properties; `bundleRelease` refuses the debug key (verified). Key itself not created — needs owner approval. |
| F-04 | High | Secrets | Production secrets were pasted in a chat session: Neon DB password, Upstash Redis password, Firebase service-account private key (twice). | **Open** — rotation plan in `SECURITY_REMEDIATION_LOG.md`. Owner action. |
| F-05 | High | Play policy / legal | Character photos are stock photos of real people (Unsplash) presented as AI personas; several characters share one face. Risk under Play's impersonation/IP rules and the photographers' licence terms; misleading to users. | **Open** — needs owned, AI-generated or model-released images. Product decision. |
| F-06 | High | Operations | No crash reporting in the app, and `SENTRY_DSN` not set on the server: production failures are invisible (the R8 launch crash on 12 Oct was found only by hand). | **Open** — needs a Sentry (or similar) account; app side needs a native SDK. |
| F-07 | Medium | Admin auth | The admin JWT (8 h) kept working after logout; its session was never checked. | **Fixed** (d82ca2d) + regression test that fails without the fix. |
| F-08 | Medium | Admin auth | Admin two-step login accepted any code (no verifier existed). Not reachable: no enrolment, 0 admins with it on. | **Fixed** (54487bf): fails closed. |
| F-09 | Medium | App | The test account's email and password were inside the release JavaScript bundle (button hidden, strings shipped). | **Fixed** (4109726): verified absent from a production bundle. |
| F-10 | Medium | Abuse | Sign-up has no email verification or bot protection; with message limits off (F-11) a script can create accounts and spend AI budget. Limits that exist: 10 sign-ups / 15 min / IP, 20 chat messages / min / account. | **Open** |
| F-11 | Medium | Cost | Daily message limits are off in production by owner decision (pricing undecided). AI spend per account is bounded only by 20 msgs/min. | **Accepted** (owner, 12 Oct). Watch the admin AI-cost screen; turn limits on with payments. |
| F-12 | Medium | Performance | Database in us-east-1, API in Singapore: ~200 ms per query; the home feed took ~4 s and once fell back. | **Open** — move DB to Singapore. |
| F-13 | Medium | Data | Admin-uploaded character photos are written to the server disk, which Render wipes on every deploy, unless S3/R2 is configured. | **Open** |
| F-14 | Medium | Availability | One free-plan instance: sleeps when idle (mitigated by self-ping, c76cad0), ~1 min cold start, no redundancy. | **Partly fixed**; paid plan recommended before launch. |
| F-15 | Medium | Backups | No tested restore. Neon free keeps a short restore window. | **Open** — see `DEPLOYMENT_AND_ROLLBACK.md`. |
| F-16 | Medium | Compatibility | App built for 64-bit ARM only; many Indian budget phones are 32-bit only. | **Fixed** (90529a6): armeabi-v7a + arm64-v8a; build verified. |
| F-17 | Medium | Legal | Privacy policy and terms need the operator's name, contact, address and grievance officer (`LEGAL_*` env), and a lawyer's review. | **Open** — owner facts. |
| F-18 | Medium | Policy | 18+ is only a line at sign-up; no age gate. Romance characters exist. | **Open** — decide target audience 18+ in Play and whether to add a date-of-birth gate. |
| F-19 | Low | Payments | Play notification endpoint is unauthenticated. Not exploitable for entitlements (state is always re-read from Google); could be used to make us call Google. | **Open** — add Pub/Sub push authentication when billing is switched on. |
| F-20 | Low | Auth | User and admin JWTs share a secret and have no audience claim. Not exploitable (admin requires `adminId` + DB lookup + session since F-07). | **Open** (defence in depth) |
| F-21 | Low | Dependencies | `braces` (Metro, dev only; fixed version not published) and `deepmerge-ts` (Prisma CLI) advisories. Neither ships in the app or runs on requests. | **Accepted** |
| F-22 | Low | Tests | `apps/mobile/tests/socialShareFlow.test.ts` tests a removed feature and fails to load. | **Open** — deleting it needs the owner's OK. |
| F-23 | Low | Code quality | 934 lint warnings (`no-explicit-any`, `no-console`). | **Info** |
| F-24 | Low | Safety UX | Per-message feedback has no "offensive/harmful" reason (character report covers it, which meets Play's AI-content rule). | **Open** |
| F-25 | Info | Privacy | Notifications show message text; Android hides it on secure lock screens by default. | **Info** |
| F-26 | Low | CI | GitHub CI, security-scan and staging workflows fail on every push; scheduled keep-awake never ran. | **Open** |
| F-27 | Medium | Release | App ID `com.aicompanionmobile` becomes permanent at the first Play upload. | **Open** — owner decision. |
| F-28 | Low | Secrets | Firebase Android API key is in the APK (normal for Firebase) but unrestricted. | **Open** — restrict to the app's package + SHA-1 in Google Cloud. |
| F-29 | Low | Infra | The old Render service `ai-let.onrender.com` still runs, broken (dead DB). | **Open** — suspend it. |
| F-30 | Medium | Policy | Data safety, content rating, target audience and AI-content declarations not filled yet. | **Open** — drafts in `PLAY_STORE_RELEASE_CHECKLIST.md`. |

Checked and fine (no finding): access/refresh tokens (HS256 pinned, 15 min access, rotating refresh with
reuse detection, session revocation checked on every request, password reset revokes all sessions); generic
login errors (no account enumeration); zod validation on routes; CORS wildcard refused in production;
helmet headers; Redis-backed per-account rate limits; server-side Play purchase verification with
`obfuscatedAccountId`; account deletion in app + web form; `allowBackup=false`; release network config
HTTPS-only; deep links limited to `companion://`; tokens in the Android Keystore; no advertising ID or
third-party analytics; all native libraries 16 KB aligned.

## 4. Verdict

**NOT READY** for Play submission. Code-side fixes are in; the remaining blockers are outside steps and
owner decisions — see `RELEASE_BLOCKERS.md`.
