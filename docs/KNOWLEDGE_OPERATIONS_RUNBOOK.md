# Knowledge Operations & Runbook (Phase 26)

## 1. Operational Overview

This runbook guides Site Reliability Engineers (SRE) and backend engineers in monitoring, scaling, maintaining, and troubleshooting the unified knowledge retrieval, ingestion, and grounded reasoning systems.

---

## 2. Ingestion Queues & Concurrency Management

Knowledge ingestion relies on BullMQ worker queues separated by task criticality:

| Queue Name | Priority | Concurrency | Target Latency | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `knowledge.interactive` | High | 10 per worker | < 3s | User-uploaded single documents & note snippets |
| `knowledge.embedding` | Medium | 20 per worker | < 1s / chunk | Batch pgvector embedding generation via AI Gateway |
| `knowledge.web_research`| Normal | 5 per worker | < 10s / task | Multi-query search, fetch, and extraction |
| `knowledge.reindex` | Low (Batch) | 2 per worker | Background | Full index re-embedding or schema migrations |

### Preventing Queue Starvation
- Interactive user uploads are processed on `knowledge.interactive` and are **never** blocked by large creator batch reindexing jobs.
- If queue depth on `knowledge.embedding` exceeds 5,000 jobs, backpressure activates: rate of new upload intake throttles with `HTTP 429 Retry-After`.

---

## 3. Database & pgvector Index Maintenance

### Vector Index Strategy
- **Index Type**: HNSW (Hierarchical Navigable Small World) with `vector_cosine_ops`.
- **Construction Parameters**: `m = 16`, `ef_construction = 64`.
- **Query Parameter**: `SET hnsw.ef_search = 40;` for optimal balance between p95 latency (< 20ms) and Recall@10 (> 95%).

### Maintenance Commands
```sql
-- Check vector index bloat and status
SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) 
FROM pg_stat_user_indexes 
WHERE indexrelname LIKE '%chunk%embedding%';

-- Reindex chunk vectors after large migrations
REINDEX INDEX CONCURRENTLY document_chunks_embedding_idx;
```

---

## 4. Disaster Recovery & Emergency Kill Switches

### Emergency Feature Flags
In the event of upstream provider outages, malicious scraping, or runaway costs:

1. **Disable Web Research**:
   ```bash
   curl -X POST https://api.companion.internal/admin/system/flags \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"flag": "DISABLE_WEB_RESEARCH", "value": true}'
   ```
2. **Disable Reranking (Fallback to RRF Pure)**:
   ```bash
   curl -X POST https://api.companion.internal/admin/system/flags \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"flag": "DISABLE_RERANKING", "value": true}'
   ```
3. **Emergency Circuit Breaker on Ingestion**:
   ```bash
   curl -X POST https://api.companion.internal/admin/ai/circuit-breaker/reset \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"provider": "openai", "model": "text-embedding-3-small"}'
   ```

---

## 5. Audit & Telemetry Dashboards

- **Knowledge Studio**: Accessible via Admin Console at `/ai/knowledge`.
- **Telemetry Metrics**:
  - `knowledge.retrieval.latency_ms` (p50, p95, p99)
  - `knowledge.retrieval.zero_retrieval_rate` (% queries skipping RAG)
  - `knowledge.grounding.citation_verification_rate` (% citations valid vs purged)
  - `knowledge.ingestion.error_rate` (% failed uploads)
