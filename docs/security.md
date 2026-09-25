# Security, Privacy & Compliance Architecture

## 1. Authentication & Token Lifecycle

The platform uses a secure dual-token architecture:

```mermaid
sequenceDiagram
    autonumber
    actor Mobile as Mobile App
    participant API as API Gateway / Express
    participant Redis as Redis Token Blacklist / Session Store
    participant DB as PostgreSQL

    Mobile->>API: POST /api/v1/auth/login (Credentials / OAuth)
    API->>DB: Verify credentials
    API->>API: Generate Access Token (JWT, 15m lifetime)
    API->>API: Generate Refresh Token (UUIDv7, 30d lifetime)
    API->>Redis: Store hashed refresh token & device fingerprint
    API-->>Mobile: Return { accessToken, refreshToken, user }

    Note over Mobile,API: Regular Request with Access Token
    Mobile->>API: GET /api/v1/characters (Bearer AccessToken)
    API->>API: Verify JWT signature & expiration locally
    API-->>Mobile: Response 200 OK

    Note over Mobile,API: Token Expiration & Silent Rotation
    Mobile->>API: Request fails with 401 (Token Expired)
    Mobile->>API: POST /api/v1/auth/refresh { refreshToken }
    API->>Redis: Validate & Revoke old refresh token (Atomic Rotate)
    API->>Redis: Store new refresh token
    API-->>Mobile: Return new { accessToken, refreshToken }
```

---

## 2. Authorization & Role-Based Access Control (RBAC)

Roles:

- `USER`: Standard consumer; access only to own profile, owned conversations, memories, wallets.
- `CREATOR`: Can create, test, and publish custom characters (subject to platform moderation).
- `MODERATOR`: Can review flagged conversations, review moderation queues, soft-ban abusive users.
- `ADMIN`: Full access to admin console, AI routing, financial analytics, prompt version rollbacks, feature flags.

Enforcement:

- Express middleware `authorize(['ADMIN', 'MODERATOR'])` guards all privileged endpoints.
- Row-level access control enforced in domain services ensuring `userId` from verified JWT matches queried records.

---

## 3. Threat Mitigation Matrix

| Vulnerability / Threat            | Mitigation Strategy                                                                                                                                                                                                                              |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prompt Injection / Jailbreaks** | - Pre-generation intent & boundary classifier.<br>- Structural prompt separation: System rules isolated in `<system_instructions>` boundaries with override disclaimers.<br>- Post-generation safety validation before streaming terminal chunk. |
| **DDoS / API Abuse**              | - Redis sliding-window distributed rate limiting (IP-level and authenticated user-level).<br>- Cloudflare / WAF ingress rules.<br>- Strict JSON payload size limits (100KB for text, 10MB for media upload).                                     |
| **Credential Theft / XSS**        | - Mobile tokens stored in OS Keystore (Android) / Keychain (iOS).<br>- HTTP-only, secure, SameSite cookies for administrative web console.<br>- Helmet middleware setting strict CSP, HSTS, and X-Content-Type headers.                          |
| **Secret Exposure**               | - Environment variables parsed and validated strictly via `zod` at boot.<br>- Never return raw errors or database stack traces in client response envelopes.                                                                                     |

---

## 4. Privacy & Data Governance (GDPR / CCPA)

1. **Right to Erasure (Account Deletion)**:
   - User triggers deletion: Account enters 30-day soft-deleted state.
   - Anonymized purge job deletes all messages, vector embeddings, and relationship logs; retains only anonymized financial transaction ledger for tax compliance.
2. **Right to Memory Management**:
   - Users can view and selectively delete individual remembered facts in settings.
   - Deleting a memory cascades to soft-delete the associated `memory_embeddings` vector.
3. **Zero Third-Party Training**:
   - Enterprise agreements / API zero-data-retention flags enabled with AI providers (OpenAI, Anthropic) ensuring user conversation turns are not used for foundation model training.
