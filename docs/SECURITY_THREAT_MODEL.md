# Security threat model — Loveek

Last reviewed: 13 October 2026. Finding IDs (F-xx) refer to `PRODUCTION_READINESS_AUDIT.md`.

## What we protect

| Asset | Why it matters |
|---|---|
| Users' chats and what characters remember | Intimate, emotional, sometimes health-related. A leak would be the worst incident this product can have. |
| Accounts (email, password hash, sessions) | Takeover exposes the chats above. |
| AI budget (Gemini key, per-message cost) | Abuse turns directly into money spent. |
| Production secrets (DB, Redis, Firebase, Gemini, Play service account, JWT secrets) | Each one opens a whole system. |
| Admin console | Can read safety-reviewed chats, delete users, grant Premium, push notifications to everyone. |
| Premium entitlements | Revenue; must not be granted without a real Google Play purchase. |

## Trust boundaries

```
 Phone (untrusted)                     Render (trusted)                      Third parties
 ┌─────────────────┐   HTTPS + JWT   ┌──────────────────────────┐   TLS   ┌────────────────────┐
 │ Loveek app      │ ──────────────▶ │ API (Express)            │ ──────▶ │ Neon Postgres      │
 │ tokens in       │ ◀── WebSocket ─ │  auth, zod validation,   │ ──────▶ │ Upstash Redis      │
 │ Android Keystore│                 │  rate limits, jobs       │ ──────▶ │ Gemini API         │
 └─────────────────┘                 └──────────────────────────┘ ──────▶ │ FCM, Play API,     │
 ┌─────────────────┐  cookie (httpOnly)          ▲                        │ Resend             │
 │ Admin browser   │ ────────────────────────────┘                        └────────────────────┘
 └─────────────────┘   Google Play RTDN (Pub/Sub push) ─▶ /billing/webhooks/google_play
```

The app is **not** a security boundary: anything in the APK (code, strings, the Firebase API key) is
public. Every decision about who may see or change what is made on the server.

## Attackers and what they try

| Attacker | Likely attempts | Defences in place | Gaps |
|---|---|---|---|
| Curious user | Read another user's chat by changing an id | Every query scoped to the token's `userId`; 64 id-taking routes probed (`crossUserAccess.ts`), clean; sending to another's chat 404s before streaming | Re-run the probe before each release |
| Script / bot | Mass sign-ups to use free AI; credential stuffing | 10 sign-ups / 15 min / IP; login rate limit; 20 chat msgs / min / account; generic login errors | No email verification or captcha (F-10); limits off (F-11) |
| Thief with a stolen phone | Use the open session | Tokens in Keystore; Profile → sign out everywhere; password reset revokes all sessions | No app lock (product choice) |
| Network attacker | Read or change traffic | HTTPS only in release (`network_security_config`), Render TLS | No pinning (deliberately: no rotation plan needed) |
| Reverse engineer | Pull secrets from the APK | No server secrets in the app; demo credentials removed (F-09) | Restrict the Firebase key (F-28) |
| Purchase fraud | Fake a Premium purchase, reuse someone's token | Purchase token verified with Google; `obfuscatedAccountId` binds it to the buyer; RTDN payload ignored, state re-read | Authenticate RTDN (F-19) |
| Rogue or phished admin | Read chats, mass-delete, spam pushes | RBAC permissions, audited actions, chats only via logged safety review, httpOnly cookie, session revocation (F-07) | No working 2-step login yet (F-08 fails closed) |
| Someone with a leaked secret | Direct DB / Redis access, signing tokens, sending pushes | Secrets only in Render env | Secrets were exposed in chat — rotate (F-04) |
| Prompt injection via chat | Make a character reveal its instructions or other users' data | The model only ever sees the current user's own data; safety prompts; crisis routing | Model output is not a security boundary — never give it tools that touch other users |

## Data flows that could leak

- **Logs:** request logs carry ids, not message text; the password-reset email body (one-time link) is never logged.
- **Crash reports:** Sentry on the server is configured without chat text; app has none yet (F-06).
- **Push notifications:** contain the character's message text; hidden on secure lock screens by default.
- **AI provider:** chat context is sent to Google's Gemini API to generate replies. The privacy policy says
  so; it must not claim "not used for training" unless the paid tier's terms apply.
- **Backups:** Neon holds copies; deletion propagates to backups only when they expire (state this in the
  privacy policy).

## Abuse and cost controls

Rate limits live in Redis and count per account (or per IP before login). Long-running and periodic work
is bounded: after-reply AI work runs with limited concurrency; scheduled jobs take a Redis lock so two
processes never run the same job; memory search caps candidates at 400.

## Review rhythm

Before every release: `pnpm audit --prod`, `scripts/security/crossUserAccess.ts`, the API test suite, and
a grep of the release bundle for secrets (see `TEST_STRATEGY.md`).
