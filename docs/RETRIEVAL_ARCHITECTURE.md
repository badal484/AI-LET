# Hybrid Retrieval Architecture & Engine (Phase 26)

## 1. Overview

The Hybrid Retrieval Engine combines dense semantic vector search (pgvector cosine similarity) with sparse lexical search (PostgreSQL exact and keyword matching). Results from both retrieval channels are combined using **Reciprocal Rank Fusion (RRF)** to deliver resilient recall for technical terms, names, and code snippets, while retaining deep semantic relevance for natural language questions and paraphrases.

---

## 2. Hybrid Retrieval Workflow

```mermaid
flowchart TD
    UserQuery[User Query: 'What did the agreement say about IP assignment?'] --> Classifier{Query Classifier}
    
    Classifier -->|Casual / Greeting| FastPath[Zero Retrieval: Return Direct Response]
    Classifier -->|Factual / Doc / Research| PreAuth[Pre-Retrieval Tenant Filtering]
    
    subgraph Parallel Retrieval Phase
        PreAuth --> DenseRetrieval[Dense Vector Search: pgvector Cosine Distance]
        PreAuth --> SparseRetrieval[Sparse Lexical Search: Postgres Full-Text & Keywords]
    end
    
    DenseRetrieval --> DenseRank[Ranked List D (up to 20 candidates)]
    SparseRetrieval --> SparseRank[Ranked List S (up to 20 candidates)]
    
    DenseRank --> RRF[Reciprocal Rank Fusion Engine]
    SparseRank --> RRF
    
    RRF --> RerankStage{Reranker Enabled?}
    RerankStage -->|Yes| CrossEncoder[AI Gateway Cross-Encoder Reranker]
    RerankStage -->|No| BudgetFilter[Token & Top-K Budget Filter]
    CrossEncoder --> BudgetFilter
    
    BudgetFilter --> TopChunks[Top Grounded Chunks with Composite Scores]
```

---

## 3. Query Classification & Zero-Retrieval Gate

Casual, emotional, or conversational queries must **never** incur database retrieval or embedding API costs.

The classifier inspects incoming queries:
- **Conversational Patterns**: "hi", "hello", "how are you", "what's up", "good morning", "thanks". If matched and total word count <= 10 words, the query is tagged `conversational`.
- **Document Q&A**: "document", "pdf", "chapter", "section", "page", "uploaded", "notes" → `document-specific`.
- **Personal Information**: "what do you know about me", "my preferences", "my birthday" → `personal`.
- **Live Research**: "research", "search web", "latest news", "price of", "compare" → `web_research`.
- **Character Lore**: Canonical worldbuilding or character background → `character-specific`.

---

## 4. Reciprocal Rank Fusion (RRF) Formula

When both semantic and lexical lists are retrieved, candidates are scored using standard RRF:

$$RRF(d) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$

Where:
- $M \in \{\text{semantic}, \text{lexical}\}$
- $k = 60$ (smoothing constant preventing high-rank dominance)
- $r_m(d)$ is the 1-based rank of document chunk $d$ in retrieval method $m$.

If a candidate appears in only one list, its score receives the single reciprocal fraction. Chunks appearing in both dense and sparse top rankings are promoted to the top of the combined candidate list.

---

## 5. Token & Latency Budgeting

Every retrieval invocation enforces strict constraints:
- **Candidate Limit (`maxCandidates`)**: Default 5 chunks (configurable up to 20).
- **Token Budget**: 2,500 tokens maximum context window dedicated to retrieved knowledge.
- **Latency Target**:
  - Semantic lookup: < 25ms (pgvector HNSW index)
  - Lexical lookup: < 10ms (PostgreSQL GIN / B-tree index)
  - Composite RRF merge: < 2ms
  - Total hybrid retrieval p95: < 40ms.

---

## 6. Pre-Retrieval Authorization Guarantees

In accordance with Section 6 of Phase 26 specifications, **authorization filtering occurs before database search execution**:
- The SQL query joins `DocumentChunk` with `KnowledgeDocument` enforcing `ownerId = :currentUserId` OR explicit `sharedCollection` membership.
- User A's queries cannot retrieve User B's private documents under any query formulation.
- Deleted or restricted documents (`status != 'INDEXED'`) are excluded by SQL predicate before ranking.
