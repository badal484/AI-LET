# Authentication & Scopes Guide

The AI Companion Developer Platform provides three robust authentication mechanisms tailored for server backends, client-side browser embeds, and user-facing third-party applications.

---

## 1. API Key Authentication (Server-to-Server)

Server applications authenticate by passing an API key in the `Authorization` header:

```http
GET /v1/characters HTTP/1.1
Host: api.companion.ai
Authorization: Bearer sk_live_9a8f1234567890abcdef...
```

Alternatively, you can pass the key in the `X-Api-Key` header:

```http
X-Api-Key: sk_live_9a8f1234567890abcdef...
```

### Key Formats

* `sk_live_...`: Production Secret Key (full server privileges).
* `pk_live_...`: Production Public Key (restricted client-safe scopes).
* `sk_test_...`: Sandbox / Test Environment Secret Key.
* `pk_test_...`: Sandbox / Test Environment Public Key.

---

## 2. Granular Permission Scopes

Keys should always adhere to the principle of least privilege.

| Scope | Description | Sensitive? |
| :--- | :--- | :--- |
| `characters:read` | View published character profiles and metadata | No |
| `characters:write` | Create, modify, and submit custom characters | No |
| `conversations:read` | Read conversation message history | Yes |
| `conversations:write`| Create and manage conversation threads | No |
| `messages:write` | Post user messages and stream responses | No |
| `memories:read` | Inspect user-approved episodic memories | Yes |
| `memories:write` | Write memories with engine validation | Yes |
| `agents:run` | Execute autonomous agent workflows | Yes |
| `tools:use` | Allow execution of approved tool calls | Yes |
| `webhooks:manage` | Register and inspect webhook endpoints | No |
| `usage:read` | Inspect metered billing and token analytics | No |

---

## 3. OAuth 2.0 PKCE (User-Facing Applications)

For user-facing applications (mobile apps, single page apps), use standard OAuth 2.0 with PKCE:

1. **Authorization Code Request**:
   `GET /oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=characters:read%20conversations:write&code_challenge=...&code_challenge_method=S256`

2. **User Consent & Grant**:
   User reviews requested scopes and approves access.

3. **Token Exchange**:
   `POST /oauth/token` with `grant_type=authorization_code`, `code_verifier=...`.

4. **Access Token Usage**:
   Tokens are prefixed with `dpt_...` and expire in 1 hour. Refresh tokens (`dpr_...`) rotate on every use.

---

## 4. Ephemeral Embed Tokens (Browser Widgets)

For browser widgets and iframes, server backends generate short-lived signed tokens (`POST /projects/:id/embeds/:characterId/tokens`). Server API keys are **never** exposed in client bundles.
