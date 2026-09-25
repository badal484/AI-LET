# Webhooks & Event Delivery Guide

Webhooks notify your systems asynchronously whenever key events occur (e.g. streaming finishes, characters publish, background agent tasks finish, or usage thresholds are crossed).

---

## 1. Webhook Signature Verification

Every outbound webhook delivery includes two security headers:

* `X-Signature`: Hex-encoded HMAC-SHA256 digest of the payload.
* `X-Timestamp`: Unix timestamp (in seconds or ms) when the delivery was signed.

### Node.js / TypeScript Verification

```typescript
import crypto from 'crypto';

export function verifyWebhook(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  const timestamp = parseInt(timestampHeader, 10);
  const now = Math.floor(Date.now() / 1000);

  // Reject replayed events older than tolerance window
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

### Python Verification

```python
import hmac
import hashlib
import time

def verify_webhook(raw_body: str, signature: str, timestamp_str: str, secret: str, tolerance_s: int = 300) -> bool:
    timestamp = int(timestamp_str)
    now = int(time.time())
    if abs(now - timestamp) > tolerance_s:
        return False

    payload = f"{timestamp}.{raw_body}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)
```

---

## 2. Event Format

```json
{
  "id": "evt_msg_1001",
  "type": "message.completed",
  "version": 1,
  "created_at": "2026-09-24T14:22:15.000Z",
  "project_id": "proj_live_9942a",
  "data": {
    "message_id": "msg_8841a",
    "conversation_id": "conv_4412b",
    "content": "Aria's response text...",
    "tokens": 84
  }
}
```

---

## 3. Retries & Dead Letter Queue (DLQ)

Deliveries that return non-2xx status codes or experience connection timeouts are automatically retried using exponential backoff:

1. Attempt 1: Immediate
2. Attempt 2: +60 seconds
3. Attempt 3: +5 minutes
4. Attempt 4: +15 minutes
5. Attempt 5: +1 hour
6. Attempt 6: +6 hours

After 6 failed attempts, the event transitions to `FAILED` (DLQ). Authorized developers can trigger manual replays from the Developer Console.
