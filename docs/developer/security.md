# Developer Platform Security Guidelines

---

## 1. API Secret Management

* **Never Ship Server Keys in Client Bundles**: Secrets prefixed with `sk_live_` or `sk_test_` must reside exclusively in backend environment variables. For client browser widgets, use ephemeral tokens or restricted public keys (`pk_live_`).
* **Secret Hash Storage**: All secret keys are stored using irreversible SHA-256 digests. Raw secrets are shown only once upon creation.
* **Key Rotation**: Rotate keys regularly without downtime by specifying an overlap window (default: 24 hours).

---

## 2. Webhook Ingress & SSRF Protection

The AI Companion Webhook Dispatcher enforces strict network validation before delivering any event:

* **Blocked IP Ranges**:
  * Loopback: `127.0.0.0/8`, `::1`
  * RFC1918 Private IPv4: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  * Link-Local / Cloud Metadata: `169.254.169.254`, `fe80::/10`
* **DNS-Rebinding Defense**: Webhook hostnames are resolved and validated at runtime immediately prior to TCP handshake.

---

## 3. Rate Limiting & Concurrency

Requests are subject to per-project rate limits:
* Production: 600 requests/minute
* Development: 120 requests/minute

Headers returned on all `/v1` requests:
* `X-RateLimit-Limit`
* `X-RateLimit-Remaining`
* `X-RateLimit-Reset`

---

## 4. Tenant Isolation & IDOR Defenses

All resource lookups verify user, project, and organization ownership. A valid API key for Project A cannot read or mutate resources belonging to Project B, even if the database identifier is known.
