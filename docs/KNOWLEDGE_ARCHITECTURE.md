# Unified Knowledge & Grounded Intelligence Architecture (Phase 26)

## 1. Executive Summary

Phase 26 establishes a production-grade, multi-source knowledge retrieval, document ingestion, and grounded reasoning layer for the AI Companion Platform. The system strictly adheres to single-instance platform architecture, reusing the existing **AI Gateway**, **Tool Gateway**, **SafetyService**, **AuthorizationService**, and **AccountDeletionService** without introducing parallel implementations or redundant stores.

The architecture solves the core challenge of multi-context intelligence: enabling characters to answer questions about users, personal documents, creator worldbuilding, and live web research without confusing user memory, character knowledge, public web information, and private documents.

---

## 2. Knowledge Taxonomy & Source Separation

The platform defines 10 explicit, non-interchangeable knowledge source types (`KnowledgeSourceType`):

| Source Type | Scope | Owner | Storage / Pipeline | Grounding & Priority |
| :--- | :--- | :--- | :--- | :--- |
| **1. Character Knowledge** | Character | Creator / Platform | `CharacterKnowledge` / Lore store | Canonical persona & lore; never overrides safety |
| **2. Creator Knowledge** | Creator / Character | Creator | Curated worldbuilding & canonical rules | Immutable once published; versioned |
| **3. Platform Knowledge** | Global | Platform / System | System policies, documentation | Highest systemic authority |
| **4. User Knowledge** | User | User | Explicit profile & user-specified facts | Inferred AI facts never overwrite explicit facts |
| **5. User Documents** | User / Collection | User | `KnowledgeDocument`, `DocumentChunk` | Private, encrypted, signed access only |
| **6. Conversation Context** | Session | User & Character | Active dialogue context buffer | Ephemeral; token-windowed |
| **7. Memory** | User / Character | User | Continuous episodic & semantic memories | Facts/events *about* the user, NOT document text |
| **8. External Sources** | User / Organization | Connector | Third-party integrations & feeds | Untrusted external data; token-scoped |
| **9. Web Sources** | Session / Task | User / Agent | `WebSourceRecord`, `WebResearchTask` | Untrusted public data; SSRF-isolated |
| **10. Tool Results** | Ephemeral | Agent Runtime | `ToolResultSanitizer` buffer | Execution outputs; never become system prompts |

---

## 3. Strict Distinctions: Memory vs. Knowledge vs. Conversation

1. **Memory vs. Knowledge**:
   - **Memory (`MemoryEngine`)**: Represents longitudinal, episodic, affective, and declarative facts *about the user* (e.g., "User loves matcha latte", "User lives in Seattle").
   - **Knowledge (`KnowledgeDocumentService` / `HybridRetrievalEngine`)**: Represents retrievable reference sources, structured files, and research material. Document lookups **never** automatically persist into long-term user memory.
2. **Knowledge vs. Conversation Context**:
   - Conversation context is short-term dialogue history. Retrieved knowledge chunks are selectively pulled into prompt context only for the duration of relevant queries and remain unpersisted unless explicitly noted.
3. **Retrieved Content vs. System Instructions**:
   - Document chunks, web pages, and social sources are strictly demarcated within `<untrusted_source_reference>` blocks. The model instructions strictly prevent reference documents from executing prompt injections or overriding safety policies.

---

## 4. Architectural Component Diagram

```mermaid
flowchart TD
    UserQuery[User Query / Task] --> QueryClassifier[Query Classifier & Zero-Retrieval Gate]
    
    QueryClassifier -->|Casual Chat / Greeting| DirectResponse[Fast Path: Direct Generation (No RAG)]
    QueryClassifier -->|Document / Factual / Research| IntentRouter[Retrieval Intent Router]
    
    subgraph Pre-Retrieval Authorization
        IntentRouter --> AuthFilter[Tenant & Scope Policy Filter]
        AuthFilter --> TenantEnforcement{Owner == User OR Visibility == Shared?}
        TenantEnforcement -->|No| RejectUnauthorized[403 / Omit Candidate]
        TenantEnforcement -->|Yes| AuthorizedSearch[Authorized Search Pipeline]
    end
    
    subgraph Hybrid Retrieval Engine
        AuthorizedSearch --> SemanticSearch[pgvector Cosine Similarity Search]
        AuthorizedSearch --> LexicalSearch[PostgreSQL Full-Text / Exact Keyword]
        SemanticSearch --> RRF[Reciprocal Rank Fusion (RRF)]
        LexicalSearch --> RRF
        RRF --> Reranker[AI Gateway Reranker / Budget Filter]
    end
    
    subgraph Web Research Platform
        AuthorizedSearch --> WebTask[WebResearchService]
        WebTask --> Subqueries[Query Decomposition]
        Subqueries --> SSRFGuard[SecureBrowserTool & SSRF Blocklist]
        SSRFGuard --> Sanitizer[ToolResultSanitizer & De-duplication]
        Sanitizer --> WebSources[WebSourceRecord Snapshot]
    end

    Reranker --> GroundingService[GroundedGenerationService]
    WebSources --> GroundingService
    
    subgraph Grounded Synthesis & Verification
        GroundingService --> PromptSynthesis[Isolated Source Block Assembly]
        PromptSynthesis --> ModelInference[AI Provider Inference]
        ModelInference --> CitationValidator[Citation Verification Engine]
        CitationValidator -->|Verified Citations| OutputPayload[Grounded Response with Citations]
        CitationValidator -->|Hallucinated Citations| StripFabrication[Purge Fabricated Citations]
        StripFabrication --> OutputPayload
    end
```

---

## 5. Pre-Retrieval Multi-Tenant Isolation

Authorization is enforced **prior to query execution**:
- In `HybridRetrievalEngine.search`:
  ```typescript
  const whereClause: Prisma.DocumentChunkWhereInput = {
    document: {
      ownerId: userId,
      status: 'INDEXED',
      ...(collectionId ? { collectionId } : {}),
      ...(characterId ? { OR: [{ characterId }, { characterId: null }] } : {}),
    }
  };
  ```
- Cross-tenant queries are blocked at the database query level; chunks from User B are never retrieved into candidate memory, preventing timing attacks and leakage.

---

## 6. Zero-Retrieval Optimization

Trivial or conversational messages (e.g., greetings, small talk, emotional check-ins) are classified as `conversational` by `HybridRetrievalEngine.classifyQuery`. For these queries:
- No database vector lookups occur.
- No embedding API calls are triggered.
- No web search operations run.
- Latency remains under 15ms TTFT overhead.

---

## 7. Versioning, Audit & Account Deletion

1. **Document Versioning**: Every document update increments `currentVersion` and creates an immutable `DocumentVersion` snapshot. Chunk embeddings reference their specific version ID.
2. **Audit & Trace**: `KnowledgeAuditAndPrivacyService` records retrieval traces (redacted of raw PII) capturing query intent, candidate count, selected sources, and latency.
3. **GDPR / CCPA Account Deletion**: Integrated directly into `AccountDeletionService.purgeUserData`. Deleting an account cascades to delete all `KnowledgeDocument`, `DocumentVersion`, `DocumentChunk`, `KnowledgeCollection`, `KnowledgeCollectionMember`, `WebResearchTask`, `WebSourceRecord`, and `CitationRecord` entries.
