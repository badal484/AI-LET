# Citation Architecture & Provenance Tracking (Phase 26)

## 1. Overview

Citations establish full traceability and provenance between generated companion answers and the underlying source documents, web pages, or creator world lore. Citations are represented as structured database entities (`CitationRecord`) rather than raw string footnotes.

---

## 2. Citation Data Model

The `CitationRecord` schema stores comprehensive provenance metadata:

```prisma
model CitationRecord {
  id             String              @id @default(uuid())
  messageId      String?             @map("message_id")
  generationId   String?             @map("generation_id")
  sourceType     KnowledgeSourceType @map("source_type")
  documentId     String?             @map("document_id")
  chunkId        String?             @map("chunk_id")
  webSourceId    String?             @map("web_source_id")
  url            String?
  title          String
  pageNumber     Int?                @map("page_number")
  sectionHeading String?             @map("section_heading")
  exactQuote     String?             @map("exact_quote")
  createdAt      DateTime            @default(now()) @map("created_at")

  document  KnowledgeDocument? @relation(fields: [documentId], references: [id], onDelete: Cascade)
  chunk     DocumentChunk?     @relation(fields: [chunkId], references: [id], onDelete: Cascade)
  webSource WebSourceRecord?   @relation(fields: [webSourceId], references: [id], onDelete: Cascade)

  @@index([generationId])
  @@index([documentId])
  @@map("citation_records")
}
```

---

## 3. Deep Linking & Client Resolution

1. **Document Citations**:
   - For PDF and paginated files, the citation includes `pageNumber` and `sectionHeading`.
   - On mobile, tapping a citation pill navigates to `DocumentViewer` targeting the specific page and highlighted section.
2. **Web Citations**:
   - For web research sources, the citation includes `url`, `title`, and `retrievedAt`.
   - Tapping the citation opens the approved sandboxed in-app browser via `SecureBrowserTool`.

---

## 4. Citation Lifecycle & Cascading Integrity

1. **Creation**: When a grounded response is generated, citations matching verified chunks are recorded.
2. **Cascading Deletion**: If a user deletes an uploaded document or collection:
   - `onDelete: Cascade` automatically removes all associated `CitationRecord` rows.
   - Historical conversations preserve message text, while the deleted citation reference gracefully marks the source as `"Source removed by user"`.
3. **Immutability**: Once recorded for a completed generation, citation records are immutable snapshots of the exact knowledge version active at generation time.
