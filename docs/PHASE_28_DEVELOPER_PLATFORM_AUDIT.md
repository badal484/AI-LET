# Phase 28 — Developer Platform, Public API & Extensibility Audit

## 1. Executive Summary & Existing System Inspection
A comprehensive audit of the production companion platform was conducted across `apps/api`, `apps/admin`, `apps/mobile`, `packages/`, database schemas, and background services.

The platform boasts rich core engines (Phases 0–27):
- Authentication, Identity & RBAC (`modules/auth`, `modules/admin`)
- Character Engine & Versioning (`modules/characters`)
- Real-time Streaming Chat & Conversation Engine (`modules/conversations`)
- Memory & Grounded Context Intelligence (`modules/memory`)
- Relationship & Emotional State Engine (`modules/relationships`)
- AI Gateway, Model Routing, Prompt Registry & Economics (`modules/ai`)
- Agent Runtime & Secure Tool Execution Gateway (`modules/agents`)
- Knowledge, Hybrid Retrieval & Web Research (`modules/knowledge`)
- Character Simulation, Goals & Routines (`modules/character-simulation`)
- Credit Ledger & Entitlement Metering (`modules/billing`)
- SafetyService & Content Moderation (`modules/safety`, `modules/moderation`)
- Privacy & Account Deletion Purge (`modules/privacy`)

---

## 2. Reusable Infrastructure & Integration Touchpoints

| Platform Layer | Existing Component | Developer Platform Reuse Strategy |
| :--- | :--- | :--- |
| **Authentication & IAM** | `AuthService`, `JwtService` | Extended with API Key & OAuth 2.0 PKCE flow; no separate credential system |
| **AI Gateway** | `AIGateway.getInstance().generate()` | All public chat, voice & completions route through gateway for cost and model routing |
| **Agent / Tool Runtime** | `AgentTaskService`, `ToolExecutionGateway` | Public `/v1/agent-tasks` routes authorized requests to approved public tool catalog |
| **Character Runtime** | `CharacterService`, `CharacterVersioning` | Public `/v1/characters` serves sanitized, immutable published character versions |
| **Conversation Engine** | `ConversationService`, `ChatStreamClient` | Public `/v1/conversations/:id/messages` delivers SSE events (`message.started`, `message.delta`, `message.completed`) |
| **Billing & Metering** | `UsageReservationService`, `CreditLedgerService` | Ingests `DeveloperUsageRecord` for API calls, token counts, and enforces budgets |
| **Safety & Moderation** | `SafetyService`, `ResponseValidator` | Public requests and external tool responses pass safety filter gates |
| **GDPR / Privacy** | `AccountDeletionService` | Cascade purge deletes developer projects, API keys, OAuth apps, and webhooks on account deletion |

---

## 3. Missing Capabilities Addressed in Phase 28

1. **Developer Domain & Hierarchy**:
   - `DeveloperOrganization` & `DeveloperOrgMember` (RBAC: `OWNER`, `ADMIN`, `DEVELOPER`, `BILLING`, `ANALYST`, `READ_ONLY`).
   - `DeveloperProject` with environment isolation (`DEVELOPMENT`, `STAGING`, `PRODUCTION`).
2. **API Key Infrastructure**:
   - Distinct prefixes (`pk_live_...`, `sk_live_...`, `pk_test_...`, `sk_test_...`).
   - SHA-256 / bcrypt key hashing (secrets shown only once).
   - Fine-grained scopes (`characters:read`, `conversations:write`, `agents:run`, `webhooks:manage`, etc.).
3. **OAuth 2.0 Provider with PKCE**:
   - Public and confidential clients (`authorization_code` + PKCE with `code_challenge` / `code_verifier`).
   - Granular user consent screen and token revocation.
4. **Reliable Webhook Delivery Engine**:
   - HMAC-SHA256 signatures (`X-Signature`, `X-Timestamp`), replay protection.
   - Robust SSRF and DNS rebinding protection blocking private IP ranges (`127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`, etc.).
   - Exponential backoff retries and Dead Letter Queue (DLQ) with admin/developer replay.
5. **Public API Contract & DTO Sanitization**:
   - `/v1/` routes with dedicated public DTOs (preventing ORM leakage of internal prompts, safety rules, or system instructions).
   - Standard error formats with `request_id` and idempotency support (`Idempotency-Key`).
6. **Official TypeScript/JavaScript SDK**:
   - `@ai-companion/sdk` (`PlatformClient`, `WebhookVerifier`, streaming SSE handler).
7. **Embed Widget & Origin Allowlist**:
   - Short-lived ephemeral tokens for iframe/script embeds constrained by project origin allowlists.
8. **OpenAPI Specification**:
   - `docs/openapi/public-v1.yaml`.
