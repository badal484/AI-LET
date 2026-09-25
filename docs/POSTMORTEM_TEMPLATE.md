# Blameless Postmortem Template: [INC-XXX] [Incident Title]

**Date**: YYYY-MM-DD  
**Incident Commander**: [Name]  
**Technical Lead**: [Name]  
**Scribe / Author**: [Name]  
**Severity**: [SEV-0 / SEV-1 / SEV-2]  
**Total Downtime / Degradation**: [X hours Y minutes]  

---

## 1. Executive Summary
Brief high-level summary (3-4 sentences) explaining what occurred, the user impact, how it was resolved, and what primary preventative measures will be taken.

---

## 2. User & Business Impact
- **Affected User Count**: [e.g. ~4,200 active users]
- **Affected Subsystems**: [e.g. Real-time Voice Streaming, In-Chat Image Gen]
- **Financial / Credit Impact**: [e.g. $140 in refunded credits, 0 duplicate charges]
- **Support Volume**: [e.g. 28 P2 support tickets received]

---

## 3. Detailed Chronological Timeline (UTC)
| Timestamp (UTC) | Event / Action / Discovery | Actor |
| :--- | :--- | :--- |
| `14:02` | Automated alert `VoiceSessionDisconnectRate` triggered in `#alerts-prod`. | System Alert |
| `14:06` | Incident declared by On-Call Engineer; Slack war room opened. | J. Doe (IC) |
| `14:14` | Identified upstream rate limiting on primary ElevenLabs TTS cluster. | A. Smith (TL) |
| `14:18` | Activated fallback TTS provider pool (`OPENAI_TTS_1`); latency restored to $< 300\text{ms}$. | A. Smith (TL) |
| `14:48` | Confirmed 30 minutes of stable telemetry. Incident marked resolved. | J. Doe (IC) |

---

## 4. Root Cause Analysis (The 5 Whys)
1. **Why did voice sessions fail?**  
   The primary TTS API returned HTTP 429 Too Many Requests errors.
2. **Why was the rate limit hit?**  
   Concurrent active voice calls increased by 300% following a featured creator campaign.
3. **Why did the system not pre-warm or load-balance across providers?**  
   The dynamic multi-provider routing threshold was hardcoded to single-provider exclusivity.
4. **Why was the dynamic routing threshold hardcoded?**  
   The initial integration assumed a higher baseline concurrency limit from the provider.
5. **Why was the provider limit not validated against peak marketing forecasts?**  
   Marketing campaign projections were not linked to infrastructure capacity planning tickets.

---

## 5. What Went Well vs. What Needs Improvement
### What Went Well
- Automated alert fired within 2 minutes of error rate increase.
- Failover switch was executed cleanly without database restart or user session corruptions.

### Where We Got Lucky
- Text chat was completely unaffected due to domain fault isolation.

### What Needs Improvement
- Public status page was updated 10 minutes after initial detection rather than target $< 5\text{m}$.
- Provider concurrency limits must be audited automatically.

---

## 6. Preventative Action Items

| Action Item | Description | Type | Owner | Target Date | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ACT-001** | Implement dynamic multi-provider TTS weighted round-robin. | Prevention | Eng Team | 2026-10-05 | P1 | Open |
| **ACT-002** | Add automated provider quota usage alerting at 75% threshold. | Monitoring | SRE Team | 2026-10-02 | P1 | Open |
| **ACT-003** | Create automated marketing campaign capacity review checklist. | Process | Ops Lead | 2026-10-10 | P2 | Open |
