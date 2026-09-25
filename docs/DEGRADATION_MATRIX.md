# Production Graceful Degradation & Resilience Matrix

## 1. System Resilience Architecture

The AI Companion Platform is engineered with **fault-isolated micro-architectures**. No single subsystem failure (such as an upstream AI provider timeout, voice gateway outage, or background queue delay) is permitted to take down unrelated services or crash the client application.

---

## 2. Comprehensive Subsystem Degradation Matrix

| Failure Scenario | Chat (Text) | Memory Engine | Voice Stream | Media Generation | Discovery & Search | Billing & Purchases | Notifications | Mobile Client UX |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary AI Provider Down (e.g. OpenAI)** | **FALLBACK**: Auto-switches to Anthropic Claude 3.5 Haiku / Sonnet in $< 500\text{ms}$. | **FALLBACK**: Local lightweight embeddings model. | **DEGRADED**: Text synthesis continues; voice latency slightly elevated. | **DEGRADED**: Image generation queued. | **NORMAL**: Keyword & cached vectors active. | **NORMAL**: Independent payment gateway. | **NORMAL**: Contextual scanner active. | User receives streamed reply seamlessly; banner indicates fallback if latency $> 2\text{s}$. |
| **Voice Provider Down (e.g. ElevenLabs)** | **NORMAL**: Text messaging fully operational. | **NORMAL**: Unaffected. | **UNAVAILABLE**: Voice call button displays "Voice temporarily unavailable". | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | Voice screen prompts user to switch to text chat; zero infinite loading spinners. |
| **Media / Image Provider Down** | **NORMAL**: Text chat continues uninterrupted. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **UNAVAILABLE**: Media request button displays "Image gen paused". | **NORMAL**: Avatars served from CDN cache. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | In-chat media placeholder shows "Image unavailable. Credits refunded"; retry available. |
| **Redis Outage / Unreachable** | **DEGRADED**: Fallback to Postgres for session state; in-memory token bucket rate limits. | **DEGRADED**: Bypasses memory cache; queries Postgres directly. | **DEGRADED**: In-memory ephemeral voice session state. | **NORMAL**: Direct DB ledger check. | **DEGRADED**: Bypasses feed cache; direct indexed SQL query. | **NORMAL**: Relies directly on Postgres transactions. | **DEGRADED**: Local memory queue with backpressure. | App remains functional; slight latency increase (+$40\text{ms}$) on uncached feeds. |
| **Background Queue Backlog ($> 1,000$ jobs)** | **NORMAL**: Real-time streaming chat bypasses async worker queue. | **DEGRADED**: Memory extraction delayed; short-term context intact. | **NORMAL**: Direct WebSocket connection. | **DEGRADED**: Batch image jobs queued with ETA. | **NORMAL**: Background ranking sync throttled. | **NORMAL**: Real-time webhooks prioritized in High-Priority queue. | **DEGRADED**: Low-priority proactive messages delayed. | User experiences normal chat; older memory updates appear on next session refresh. |
| **Push Notification Provider Down** | **NORMAL**: Chat, voice, discovery fully operational. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: In-app receipt modal active. | **DEGRADED**: Outgoing push notifications stored in DB queue for retry. | In-app notification bell shows all updates; push delivery recovers automatically upon provider restore. |
| **Database Read Replica Lag ($> 5\text{s}$)** | **NORMAL**: Master node serves critical conversation writes and reads. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **DEGRADED**: Discovery reads served from Redis cache until replica catches up. | **NORMAL**: Master node processes all balance mutations. | **NORMAL**: Unaffected. | Zero user disruption; discovery feed displays recent cached snapshots. |
| **Mobile Client Offline / Network Loss** | **OFFLINE**: Messages buffered locally; visual "Waiting for connection" status. | **LOCAL**: Cached memories viewable. | **PAUSED**: Voice session pauses cleanly; releases audio hardware. | **LOCAL**: Cached media viewer functional. | **LOCAL**: Cached discovery feed displayed. | **PAUSED**: Purchase actions prompt network reconnect. | **LOCAL**: Stored notifications viewable. | Full offline safety; zero lost message drafts; automatic retry when connection returns. |
| **Payment Gateway Delayed Webhook** | **NORMAL**: User receives optimistic pending purchase receipt. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **NORMAL**: Unaffected. | **PENDING**: 15s verification timeout; background reconciliation worker checks status. | **NORMAL**: Unaffected. | Clear "Processing purchase..." state with 15s timeout and automatic credit grant upon reconciliation. |

---

## 3. Graceful Recovery Protocols

1. **Circuit Breakers**: Auto-trip when error rate $> 50\%$ over 10 consecutive requests; 30s half-open cooldown before probing upstream health.
2. **Exponential Backoff with Jitter**: Upstream API retries use $300\text{ms} \times 2^{\text{attempt}} \pm 100\text{ms}$ random jitter to prevent thundering herd spikes.
3. **Idempotency Guarantees**: All financial mutations, credit grants, and message postings check deterministic idempotency hashes before committing.
