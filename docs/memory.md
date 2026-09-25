# Multi-Tier Memory Engine Specification

## 1. Multi-Tier Memory Hierarchy

Sending entire conversation histories into an LLM causes prompt token explosion, degradation of attention, and astronomical API costs. The platform implements a **5-tier hierarchical memory model**:

```mermaid
graph TD
    subgraph "Tiered Memory Model"
        T1[Tier 1: Short-Term Working Buffer - Last 8-12 Turns]
        T2[Tier 2: Rolling Conversation Summary - Compressed Semantic History]
        T3[Tier 3: Episodic Memories - Discrete Events, Life Milestones]
        T4[Tier 4: Semantic Fact Memory - User Preferences, Biographies, Dislikes]
        T5[Tier 5: Dynamic Relationship Graph - Trust, Affection, Shared Secrets]
    end

    T1 --> ContextSynthesizer[Context Synthesizer]
    T2 --> ContextSynthesizer
    T3 --> ContextSynthesizer
    T4 --> ContextSynthesizer
    T5 --> ContextSynthesizer

    ContextSynthesizer --> PromptInjection[Synthesized Context < 1500 Tokens]
```

---

## 2. Memory Extraction & Ingestion Pipeline

Ingestion is 100% asynchronous and offloaded to background job queues (`BullMQ` on Redis) to maintain sub-second chat latency:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Backend as Express Chat API
    participant Queue as Redis Job Queue (BullMQ)
    participant Worker as Memory Worker
    participant Extractor as Extraction LLM (GPT-4o-mini)
    participant Embedder as Embedding Provider
    participant DB as PostgreSQL (pgvector)

    User->>Backend: Sends message turn
    Backend->>Queue: Push 'extract_memory' job (turnId, userId, charId)
    Backend-->>User: Streams chat response immediately
    Queue->>Worker: Consume job
    Worker->>Extractor: Extract memory candidate facts, type, importance (0-10)
    Extractor-->>Worker: Return structured memory items
    Worker->>Worker: Deduplicate against existing memory hashes
    Worker->>Embedder: Generate vector embeddings (1536d)
    Embedder-->>Worker: Return embedding array
    Worker->>DB: INSERT into memories & memory_embeddings
```

---

## 3. Relevance-Driven Retrieval Algorithm

When assembling the prompt for a new turn, memories are retrieved using a **hybrid scoring formula**:

$$\text{FinalScore} = w_1 \cdot \text{CosineSimilarity} + w_2 \cdot \text{ImportanceScore} + w_3 \cdot \text{RecencyDecay}$$

Where:

- $\text{CosineSimilarity} = 1 - (\vec{E}_{\text{query}} \cdot \vec{E}_{\text{memory}})$
- $\text{ImportanceScore} \in [0.0, 1.0]$ assigned by extraction LLM
- $\text{RecencyDecay} = e^{-\lambda \cdot \Delta t}$ ($\Delta t$ = days elapsed since memory was formed)
- Default weights: $w_1 = 0.55, w_2 = 0.30, w_3 = 0.15$

### Context Window Injection Limits

- Maximum retrieved episodic/semantic memories per turn: **5 items**.
- Maximum token budget for memory block in system prompt: **400 tokens**.
- Irrelevant memories (FinalScore < 0.65) are automatically discarded to prevent prompt pollution.
