# Runbook: AI Media & Image Generation Outage

## 1. Symptoms & Alert Triggers
- Prometheus alert `ImageGenFailureRate` ($> 10\%$).
- In-chat image generation jobs timing out ($> 60\text{s}$) or throwing `IMAGE_GENERATION_FAILED`.
- S3/CDN media upload returning 403 / 500 errors.

## 2. Diagnosis
1. Inspect image generation worker pod logs:
   ```bash
   kubectl logs -n production -l app=ai-companion-media-worker --tail=100
   ```
2. Check upstream image provider (e.g. Flux / Midjourney / DALL-E) latency and rate limits.
3. Validate object storage credentials and S3 bucket quota.

## 3. Mitigation Protocols
1. **Activate Media Kill Switch**:
   Toggle `KillSwitchService` key `image_generation` to `false`. Mobile client will gracefully disable media creation buttons while text chat continues uninterrupted.
2. **Auto-Refund Credits for Failed Jobs**:
   Ensure credit refund worker reconciles failed job IDs and credits user wallets automatically.

## 4. Verification
- Generate test avatar in Admin Character Studio.
- Verify image upload to S3, CDN URL resolution, and image display in $< 8\text{s}$.

## 5. Escalation
- **Primary**: Media Platform Engineer
- **Secondary**: Infrastructure Lead
