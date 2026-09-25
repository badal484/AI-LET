# Single Source of Truth — Product & AI Metric Registry

**Status:** **AUTHORITATIVE REGISTRY**  
**Maintainer:** Analytics & AI Engineering Core  

---

## 1. Metric Hierarchy & Definitions

| Metric ID | Metric Name | Category | Exact Formula | Source Events | Target Pop. | Owner |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **`metric_north_star`** | Meaningful Weekly Active Companionship (MWAC) | `NORTH_STAR` | `COUNT(DISTINCT user_id) with >= 3 distinct days having >= 5 messages with positive sentiment (> 0.6)` | `message.completed`, `conversation.completed` | All verified users | Executive & Product Team |
| **`metric_activation`** | 4-Step Core Activation Rate | `ACTIVATION` | `(COUNT(Users Completing Onboarding + Character Select + First Chat + 3 Turns) / COUNT(Signups)) * 100` | `onboarding.completed`, `message.sent` | New Signups ($< 24\text{h}$) | Growth Team |
| **`metric_d7_retention`** | D7 Cohort Retention | `RETENTION` | `COUNT(Users active on Day 7) / COUNT(Users in Day 0 cohort)` | `session.started`, `message.sent` | Weekly signup cohorts | Product Team |
| **`metric_memory_precision`**| Memory Retrieval Precision | `AI_QUALITY` | `COUNT(Relevant Injected Memories) / COUNT(Total Injected Memories)` | `generation.evaluated`, `memory.retrieved` | Conversations with active memory | AI Quality Team |
| **`metric_ai_cost_per_dau`** | AI Cost per Active User (AI-CP-DAU) | `MONETIZATION` | `SUM(text_cost_usd + voice_cost_usd + media_cost_usd) / COUNT(DAU)` | `ai_generation.trace`, `voice_session.completed` | Daily Active Users | Finance & Infrastructure |
| **`metric_safety_rate`** | Safety Block Rate | `SAFETY` | `(COUNT(High-Severity Moderation Blocks) / COUNT(Total Messages)) * 100` | `moderation.flagged`, `safety_incident.logged` | All User Interactions | Trust & Safety |

---

## 2. Anti-Gaming Principles

1. **Do NOT Optimize Pure Message Volume:** More messages do not automatically mean higher value. Metric `MWAC` requires reciprocal sentiment and natural pacing.
2. **Do NOT Optimize Notification Opens via Clickbait:** Notification success is measured by conversation continuation and low mute/unsubscribe rates.
3. **Do NOT Sacrifice Safety for Engagement:** Any experiment that increases user retention while increasing high-severity safety flags is disqualified immediately.
