# Known limitations — Lovira (13 October 2026)

Things that are true of the product today and that users, reviewers or the team should know.

- **Free hosting.** The API is on Render's free plan: one instance, about a minute to start after a deploy
  or a long idle period (a self-ping keeps it awake otherwise). The database is in the US, so screens take
  a second or more. Not suitable for a public launch at scale (F-12, F-14).
- **No message limits.** Daily limits are switched off until pricing is decided (F-11). AI cost grows with
  usage; abuse is limited only by per-minute and sign-up rate limits.
- **Password reset needs email.** Until Resend is configured with a verified domain, "Forgot password"
  sends nothing (F-01).
- **Scheduled work needs a setting.** Account deletion, reminders, campaigns and "characters text first"
  run only when `RUN_SCHEDULED_JOBS_IN_API=true` is set or a worker is deployed (F-02).
- **No crash reporting in the app** (F-06).
- **AI replies can be wrong.** Characters are AI; health, finance and legal answers are general and point
  to professionals. Facts (e.g. sports results) are not looked up live.
- **Character photos are placeholders** from a stock-photo site and must be replaced (F-05).
- **Admin console** is not deployed; admin uploads need object storage (F-13).
- **Admin two-step login** is not available (it refuses rather than pretending, F-08).
- **18+** is declared at sign-up, not verified (F-18).
- **English and Hinglish only.**
- **Android only.** No iOS build has been prepared.
- **No end-to-end or component tests** for the mobile app; journeys are tested by hand (`TEST_STRATEGY.md`).
