# Platform Data Lineage & Event Processing Graph

**Version:** 1.0.0  
**Status:** **OPERATIONAL**  

---

## 1. End-to-End Data Lineage Graph

```mermaid
graph TD
    Client[Client Apps / Mobile / Web] -->|message.completed| IngestChat[Topic: events.chat.messages]
    Client -->|voice_session.completed| IngestVoice[Topic: events.voice.telemetry]
    Worker[AI Extraction Worker] -->|memory.extracted| IngestMem[Topic: events.memory.extracted]
    Billing[Payment Gateway] -->|billing.subscription_renewed| IngestBill[Topic: events.billing.reconciliation]

    IngestChat --> TableChat[(ChatMessage / AIGenerationTrace)]
    IngestVoice --> TableVoice[(VoiceSession / VoiceUsageMeter)]
    IngestMem --> TableMem[(MemoryItem / MemoryExtractionLog)]
    IngestBill --> TableBill[(Subscription / PaymentTransaction)]

    TableChat --> RollupChat[Job: hourly_chat_metrics_rollup]
    TableVoice --> RollupVoice[Job: hourly_voice_cost_rollup]
    TableMem --> RollupMem[Job: daily_memory_quality_audit]
    TableBill --> RollupBill[Job: realtime_revenue_reconciliation]

    RollupChat --> KPI_MWAC[KPI: MWAC & D7 Retention]
    RollupVoice --> KPI_VoiceCost[KPI: Voice Latency P95 & Cost]
    RollupMem --> KPI_Memory[KPI: Memory Precision]
    RollupBill --> KPI_ARPU[KPI: ARPU & Gross Margin]

    style TableChat fill:#1e293b,stroke:#38bdf8,color:#f8fafc
    style TableVoice fill:#1e293b,stroke:#a855f7,color:#f8fafc
    style TableMem fill:#1e293b,stroke:#4ade80,color:#f8fafc
    style TableBill fill:#1e293b,stroke:#f59e0b,color:#f8fafc
```

---

## 2. Lineage Item Specifications

| Lineage ID | Event Name | Producer | Ingestion Topic | Primary DB Tables | Transformation Rollup | Aggregated KPIs | PII Sensitivity |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `lineage_chat_msg` | `message.completed` | API_SERVER | `events.chat.messages` | `ChatMessage`, `AIGenerationTrace` | `hourly_chat_metrics_rollup` | MWAC, D7 Retention, AI-CP-DAU | `REDACTED` |
| `lineage_memory_extract` | `memory.extracted` | AI_WORKER | `events.memory.extracted` | `MemoryItem`, `MemoryExtractionLog` | `daily_memory_quality_audit` | Memory Precision, Conflict Rate | `PSEUDONYMIZED` |
| `lineage_voice_session` | `voice_session.completed`| GATEWAY | `events.voice.telemetry` | `VoiceSession`, `VoiceUsageMeter` | `hourly_voice_cost_rollup` | Voice Latency P95, Voice CP-DAU | `NONE` |
| `lineage_billing_webhook` | `billing.subscription_renewed`| API_SERVER | `events.billing.reconciliation`| `Subscription`, `PaymentTransaction` | `realtime_revenue_reconciliation` | ARPU, Gross Margin, MRR | `REDACTED` |
| `lineage_moderation_event`| `moderation.flagged` | API_SERVER | `events.safety.moderation` | `ModerationReport`, `SafetyIncident` | `realtime_safety_circuit_check` | Safety & Moderation Block Rate | `PSEUDONYMIZED` |

---

## 3. Retention & Deletion Propagation

When a user requests account deletion (`DELETE /api/v1/privacy/account`):
1. User record is soft-deleted and anonymized.
2. Vector embeddings and memory records are permanently deleted from database and vector index.
3. Personalization profile is completely purged from `PersonalizationEngine`.
4. Analytical event rollups retain aggregated counts without individual user identifiers.
