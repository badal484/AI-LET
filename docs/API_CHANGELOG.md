# Public API Changelog

All notable changes to the AI Companion Public API and Developer Platform are documented in this file.

---

## [1.0.0] - 2026-09-24 — Phase 28 Launch

### Added
- Dedicated Public API gateway mounted at `/v1`.
- Scoped Developer API Keys (`sk_live_`, `pk_live_`, `sk_test_`, `pk_test_`) with SHA-256 secret hashing.
- OAuth 2.0 PKCE authorization code grant and token rotation (`/oauth/authorize`, `/oauth/token`).
- Outbound cryptographic HMAC-SHA256 Webhook Dispatcher with SSRF and DNS-rebinding security shields.
- Real-time Server-Sent Events (SSE) streaming for character messages (`message.started`, `message.delta`, `message.completed`).
- Autonomous Agent Execution endpoints (`POST /v1/agent-tasks`).
- Ephemeral browser embed session tokens and origin allowlist security.
- Metered usage recording and budget spend alerts (50%, 75%, 90%, 100%).
- Official TypeScript/JavaScript SDK (`@ai-companion/sdk` in `packages/sdk-js`).
- Developer Platform Console UI in Admin Command Center.
