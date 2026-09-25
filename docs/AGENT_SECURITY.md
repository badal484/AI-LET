# AGENT SECURITY, SSRF DEFENSES & DATA EXFILTRATION PROTECTION

## 1. Threat Model & Security Posture
The Agent Runtime operates under zero-trust assumptions:
1. All tool outputs are **data**, never executable instructions.
2. Web pages, emails, social posts, and uploaded files are **untrusted**.
3. LLMs must **never receive raw secrets** (OAuth refresh tokens, API keys, database credentials).

---

## 2. Server-Side Request Forgery (SSRF) Defense
The `SecureBrowserTool` enforces strict network-level egress filtering before initiating HTTP requests:

* **Loopback Blocking**: Prohibits requests to `127.0.0.1`, `localhost`, `0.0.0.0`, `::1`.
* **Cloud Metadata Protection**: Strictly blocks `169.254.169.254` (AWS, GCP, Azure metadata endpoints).
* **Private Subnet Blocking**: Prohibits RFC 1918 addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
* **Domain Allowlist**: Only allows verified HTTP/HTTPS schemas on approved public domains.

---

## 3. Tool Result Sanitization & Secret Redaction
Before any tool result is passed to a model or stored in conversation transcripts, `ToolResultSanitizer` performs three defensive operations:

1. **Defuses Prompt Injection**: Strips system prompt override patterns (e.g. `Ignore previous instructions`, `System prompt:`, `You are now in developer mode`).
2. **Redacts Exposed Secrets**: Redacts Authorization headers, Bearer tokens, AWS access keys, OpenAI keys, and private tokens with `[REDACTED_SECRET]`.
3. **Context Flooding Bounds**: Truncates tool outputs exceeding 8,000 characters to prevent context window denial-of-service.

---

## 4. OAuth Vault & Model Isolation
* **Encrypted Storage**: OAuth access and refresh tokens are encrypted at rest using AES-256-GCM with authenticated tags in `OAuthVaultService`.
* **Model Isolation**: Models receive only bounded, transient function parameters. The model never sees raw bearer tokens or authorization secrets.
* **Least-Privilege Scopes**: Requests explicitly demand minimal scopes (`calendar.read` rather than `calendar.*`).

---

## 5. Cross-Tenant Context Isolation
Strict boundary tests ensure that:
* User A cannot access tasks, goals, or memories of User B.
* Character A cannot access private user context from Character B.
* Database queries in all services filter explicitly by `userId` and `characterId`.
