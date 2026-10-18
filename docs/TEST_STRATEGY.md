# Test strategy — Loveek

## 1. What exists

| Layer | Tool | Where | Notes |
|---|---|---|---|
| API unit + integration | Vitest + Supertest against a real local Postgres/Redis | `apps/api/tests` (133 files) | Runs migrations on the test DB first. Never point it at production. |
| Authorization (cross-user) | Script | `apps/api/scripts/security/crossUserAccess.ts` | Probes every id-taking user route with another user's ids. |
| Authorization (admin) | Vitest | `tests/adminRbac.test.ts`, `tests/security/authorizationRegression.test.ts` | Includes negative tests (forbidden, revoked). |
| Character quality | Eval scripts | `apps/api/scripts/eval/*.eval.ts` | Uses the Gemini quota — keep runs small. |
| Mobile logic | Vitest | `apps/mobile/tests` (6 files) | No component or end-to-end tests yet. |
| Load | k6 | `infrastructure/load-tests/chat.k6.js` | Staging only, never production. |
| Release artifact | Shell checks | §4 below | Secrets, 16 KB alignment, ABIs. |

## 2. Commands

```bash
pnpm -r run typecheck                                   # all packages
pnpm --filter @ai-companion/api --filter @ai-companion/mobile run lint
cd apps/api && npx vitest run                           # API suite (needs local Postgres + Redis)
cd apps/mobile && npx vitest run
pnpm audit --prod
cd apps/api && npx tsx scripts/security/crossUserAccess.ts   # against a local API
```

## 3. Critical journeys to run by hand on a release build (real phone)

1. Install → sign up → onboarding → pick a character → first reply arrives.
2. Kill the app → reopen → still signed in; chats and unread badges correct.
3. Airplane mode → open a chat → clear error, no endless spinner → back online → recovers.
4. Ask a character "remind me in 2 minutes to drink water" → reminder notification arrives (needs F-02 env).
5. Profile → sign out → sign in again; sign out everywhere.
6. Forgot password → email → page → new password → sign in (needs F-01 email setup).
7. Delete account → signed out → sign in within 14 days cancels it; otherwise gone after 14 days.
8. Report a character from the chat menu → appears in admin Safety.
9. Large font size and dark mode on a small phone: sign-in, chat, profile readable, buttons reachable.
10. 32-bit phone (or emulator `armeabi-v7a`): app starts and chats.

## 4. Release artifact checks

```bash
# Production JS bundle has no secrets, demo credentials or localhost
npx react-native bundle --platform android --dev false --minify true --entry-file index.js --bundle-output /tmp/b.js --assets-dest /tmp/a
grep -cE "ai-companion.local|UserPass123|localhost:4000|BEGIN PRIVATE KEY" /tmp/b.js   # expect 0
# 16 KB alignment
zipalign -c -P 16 -v 4 app-release.apk | tail -1                                       # "Verification successful"
```

## 5. Test matrix (13 October 2026)

| Test | Risk addressed | Expected | Actual | Evidence | Status |
|---|---|---|---|---|---|
| API suite | Regressions across the API | All pass | 853/853 (+16 in changed files re-run) | `vitest run`, exit 0 | Pass |
| Type check, all packages | Broken builds | Exit 0 | Exit 0 | `pnpm -r typecheck` | Pass |
| Mobile suite | Mobile logic | All pass | 17/17 pass; `socialShareFlow` suite fails to load (removed feature, F-22) | `vitest run` | Fail (known) |
| Admin token after logout | Session not ended (F-07) | 401 | 401; 200 without the fix | `adminRbac.test.ts` | Pass |
| Admin token with no session | Forged/minted tokens | 401 | 401 | `adminRbac.test.ts` | Pass |
| Password reset page, full flow | Lockout (F-01) | Old password fails, new works, link one-use | As expected | `passwordResetPage.test.ts` | Pass |
| Reset page HTML injection | XSS via link | Escaped | Escaped | `passwordResetPage.test.ts` | Pass |
| Reset email payload | Wrong link / no email | Resend called with the link | As expected | `passwordResetPage.test.ts` | Pass |
| Scheduled jobs in the API | Deletions/reminders never run (F-02) | Jobs record OK | account-deletion, reminders, campaigns OK | local API run, Redis `console:jobs` | Pass |
| Demo credentials in bundle | Credential leak (F-09) | 0 matches | 0 | bundle grep | Pass |
| 16 KB alignment | Play rejection | Aligned | 18/18 libs, zip OK | `llvm-readelf`, `zipalign` | Pass |
| 2-ABI release build | 32-bit phones excluded (F-16) | Builds, both ABIs | 18 libs each | `assembleRelease` | Pass |
| AAB without upload key | Debug-signed upload | Build refuses | Refuses with message | `bundleRelease` | Pass |
| Release build on a phone (2-ABI) | Startup crash | Starts | Not run — phone not connected | — | Blocked |
| Cross-user access probe | IDOR | No findings | No findings (12 Oct) | `crossUserAccess.ts` | Pass (re-run before release) |
| Dependency audit | Known vulnerabilities | None in shipped code | 2 high, build tools only | `pnpm audit --prod` | Accepted (F-21) |

## 6. Rules

- Never run tests, evals or load tests against production data.
- A security fix ships with a test that fails without it.
- Don't report a test as passing unless it ran; write "Blocked" and why.
