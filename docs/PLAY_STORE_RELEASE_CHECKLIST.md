# Google Play release checklist — Lovira

Requirements checked against Google's official pages on 13 October 2026:
[target API level](https://support.google.com/googleplay/android-developer/answer/11926878),
[testing for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465).
Items marked **OWNER** need facts, money or a decision from the owner. Nothing here has been submitted.

## 1. Decisions first (they can't be changed later)

- [ ] **OWNER — Play Console account type.** Personal is quickest. A *new personal* account (created after
      13 Nov 2023) must run a **closed test with at least 12 testers, opted in for 14 days in a row**, before
      it can apply for production. Plan for that: ~3 weeks before a public release.
- [ ] **OWNER — App ID** (F-27). Today `com.aicompanionmobile`; it is permanent after the first upload.
      Suggestion: `com.lovira.app`. Changing it also needs a new Firebase Android app (new
      `google-services.json`) and `GOOGLE_PLAY_PACKAGE_NAME` on the server.
- [ ] **OWNER — Upload key** (F-03). Create once, back up in two places (password manager + offline):
      ```bash
      keytool -genkeypair -v -keystore ~/lovira-upload.jks -alias lovira-upload -keyalg RSA -keysize 4096 -validity 10000
      ```
      Then in `~/.gradle/gradle.properties` (not the repo):
      ```
      LOVIRA_UPLOAD_STORE_FILE=/Users/<you>/lovira-upload.jks
      LOVIRA_UPLOAD_STORE_PASSWORD=...
      LOVIRA_UPLOAD_KEY_ALIAS=lovira-upload
      LOVIRA_UPLOAD_KEY_PASSWORD=...
      ```
      Use **Play App Signing** (default): Google keeps the app signing key; a lost upload key can be reset.

## 2. Build the release

- [x] Target API 36 (required for new apps from 31 Aug 2026).
- [x] minSdk 24. 32-bit and 64-bit ARM (F-16). All native libraries 16 KB aligned.
- [x] R8 on, with keep rules for Room/WorkManager (the launch crash of 12 Oct).
- [x] Release talks only to the production API over HTTPS; no demo credentials in the bundle (F-09).
- [x] `bundleRelease` refuses to build without the upload key.
- [ ] Build: `cd apps/mobile/android && ./gradlew bundleRelease -PloviraVersionCode=1 -PloviraVersionName=1.0.0`
      → `app/build/outputs/bundle/release/app-release.aab`. Raise `loviraVersionCode` for every upload.
- [ ] Record the AAB's SHA-256 (`shasum -a 256 app-release.aab`) in the release notes.
- [ ] Install the release on at least one 64-bit and one 32-bit phone (internal testing track) and run the
      journeys in `TEST_STRATEGY.md` §3.

## 3. Server must be ready before testers arrive

See `RELEASE_BLOCKERS.md`. In short: `RUN_SCHEDULED_JOBS_IN_API=true` (or a worker), email for password
reset, `LEGAL_*` env, rotated secrets, crash reporting, DB in Singapore (recommended).

## 4. Store listing

- [ ] App name: **Lovira** (check the name isn't someone's trademark in your category).
- [ ] Short description (≤80 chars) — suggestion: "Chat with AI characters who remember you — friends, love, health & more."
- [ ] Full description: say clearly the characters are **AI, not real people**; list what's real (chat,
      memory, reminders, notifications). No claims of therapy or medical advice.
- [ ] Icon 512×512, feature graphic 1024×500, at least 2 phone screenshots — from the real app.
- [ ] Category: Entertainment (or Social). Contact email. Privacy policy URL:
      `https://ai-let-fgx6.onrender.com/legal/privacy` (or your own domain later).
- [ ] **OWNER — Character photos** (F-05): replace stock photos of real people before publishing screenshots.

## 5. App content declarations (drafts — confirm each)

- **Target audience:** 18+ only (romance characters). Not designed for children.
- **Content rating questionnaire:** user-generated chat with AI; mild romance; no sexual content (characters
  refuse it); references to mental health with helplines. Answer truthfully; expect a Teen/Mature rating.
- **AI-generated content:** yes. Users can report a character from the chat (harassment, explicit, unsafe,
  impersonation) — this is the in-app reporting Play requires.
- **Ads:** none.
- **App access for reviewers:** create a reviewer account on production and give its email/password in
  Play Console (not in the repo).
- **Account deletion:** in app (Profile → Privacy & account → Delete account) and on the web:
  `https://ai-let-fgx6.onrender.com/legal/delete-account`. Deletion happens after 14 days — only once the
  scheduled jobs run in production (F-02).
- **Financial features / health:** none / not a medical app (health characters give general wellness tips
  and point to doctors and helplines).

### Data safety (draft from the code, 13 Oct 2026)

| Data type | Collected | Shared | Why | Optional |
|---|---|---|---|---|
| Email address | Yes | No | Account, password reset | Required |
| Name (what characters call you) | Yes | No | App functionality, personalisation | Required |
| Messages (chats with characters) | Yes | Processed by Google Gemini as a service provider (not "sharing" under Play's definition) | App functionality | Required |
| Other user-generated content (memories, reminders, support messages) | Yes | No | App functionality | — |
| App interactions (first-party analytics events) | Yes | No | Analytics | — |
| Device or other IDs (random app-generated ids, FCM push token) | Yes | No (Firebase delivers pushes) | Notifications, fraud prevention | — |
| Purchase history | Yes (when billing is on) | No | Premium | — |
| Crash logs / diagnostics | Server-side only today | No | — | — |

All data is encrypted in transit. Users can request deletion. No location, contacts, photos, advertising ID.

## 6. Testing gates

- [ ] Internal testing track first (your own phones).
- [ ] **Closed test, 12+ testers, 14 consecutive days** (new personal accounts).
- [ ] Apply for production access; review usually ≤7 days.
- [ ] Production rollout: staged (e.g. 20 %), watch crashes and the API for 48 h, then 100 %.

## 7. Payments (when you switch Premium on)

Follow `docs/payments-setup.md`: create products in Play Console → service account with Play Developer API
→ `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME`, product ids → RTDN topic → set
`BILLING_ENFORCE_LIMITS=true`. Test with licence testers before going live.
