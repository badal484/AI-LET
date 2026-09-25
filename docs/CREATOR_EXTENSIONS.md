# CREATOR EXTENSIONS & KNOWLEDGE INGESTION PIPELINE

## 1. Overview
Phase 25 enables creators to extend their characters with domain knowledge, custom skills, and tailored experiences under strict platform sandboxing and tenant isolation guarantees.

---

## 2. Creator Knowledge Ingestion Pipeline
Uploaded documents (PDFs, text files, markdown) follow an 8-stage verification and ingestion process managed by `CreatorKnowledgeIngestionService`:

```mermaid
flowchart LR
    A[Upload File] --> B[MIME & Size Validation]
    B --> C[Malware & Executable Scan]
    C --> D[Text & Table Extraction]
    D --> E[Semantic Chunking]
    E --> F[Content Moderation Check]
    F --> G[Embedding & Vector Indexing]
    G --> H[Versioned Publication]
```

### Pipeline Guardrails
* **Size Budget**: Maximum 15 MB per document.
* **Malware Scanning**: Disallows embedded executables, macros, and script tags.
* **Prompt Injection Defenses**: Sanitizes raw document text to neutralize prompt injection tokens.
* **Chunking**: Chunks text into bounded tokens (500 tokens with 50-token overlap).

---

## 3. Versioning & Safe Rollback
Knowledge documents are versioned (`versionNumber: 1, 2, 3...`):
* Ingesting changes creates a new version; active chunks are linked to the specific version.
* If a newly uploaded version contains hallucinated or unauthorized data, creators or admins can instantly roll back:
  ```typescript
  await creatorKnowledgeService.rollbackVersion(characterId, docId, targetVersion);
  ```
* Rollback immediately archives newer chunks and re-activates the target approved version without vector database recreation.

---

## 4. Tenant Isolation & Memory Protection
* **Character Knowledge vs. User Memory**: Uploaded creator knowledge is global to that character. User memory is strictly isolated to the individual user. The character never treats another user's memories as character knowledge.
* **Cross-Tenant Guard**: Database queries and vector lookups are strictly partitioned by `characterId` and verified against tenant authorization.

---

## 5. Creator Playground & Testing
Creators test and validate extensions in the Admin AI Studio without production side effects:
* Inspect selected skills and tool invocation plans.
* View exact context assembly and token budget allocations.
* Check moderation scores and safety policy decisions.
* Validate simulated execution costs before publishing.
