-- Phase 26: Production Knowledge, Retrieval, Web Research, RAG & Grounded Intelligence

-- CreateTable knowledge_documents
CREATE TABLE IF NOT EXISTS "knowledge_documents" (
    "id" VARCHAR(100) NOT NULL,
    "owner_id" VARCHAR(100) NOT NULL,
    "owner_type" VARCHAR(30) NOT NULL DEFAULT 'USER',
    "character_id" VARCHAR(100),
    "title" VARCHAR(255) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "storage_url" VARCHAR(500),
    "content_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
    "failure_reason" TEXT,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "page_count" INTEGER NOT NULL DEFAULT 1,
    "visibility" VARCHAR(30) NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable document_versions
CREATE TABLE IF NOT EXISTS "document_versions" (
    "id" VARCHAR(100) NOT NULL,
    "document_id" VARCHAR(100) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable document_chunks
CREATE TABLE IF NOT EXISTS "document_chunks" (
    "id" VARCHAR(100) NOT NULL,
    "document_id" VARCHAR(100) NOT NULL,
    "version_id" VARCHAR(100),
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "page_number" INTEGER,
    "section_heading" VARCHAR(255),
    "source_offset" INTEGER,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "content_hash" VARCHAR(64) NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable knowledge_collections
CREATE TABLE IF NOT EXISTS "knowledge_collections" (
    "id" VARCHAR(100) NOT NULL,
    "owner_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "visibility" VARCHAR(30) NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable knowledge_collection_members
CREATE TABLE IF NOT EXISTS "knowledge_collection_members" (
    "id" VARCHAR(100) NOT NULL,
    "collection_id" VARCHAR(100) NOT NULL,
    "document_id" VARCHAR(100) NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_collection_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable web_research_tasks
CREATE TABLE IF NOT EXISTS "web_research_tasks" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "conversation_id" VARCHAR(100),
    "query" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    "freshness_policy" VARCHAR(30) NOT NULL DEFAULT 'DAILY',
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "summary" TEXT,
    "findings" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "web_research_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable web_sources
CREATE TABLE IF NOT EXISTS "web_sources" (
    "id" VARCHAR(100) NOT NULL,
    "research_task_id" VARCHAR(100),
    "url" VARCHAR(1000) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "publisher" VARCHAR(255),
    "content_snippet" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "retrieved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "credibility_score" DOUBLE PRECISION,
    "is_accessible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "web_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable citation_records
CREATE TABLE IF NOT EXISTS "citation_records" (
    "id" VARCHAR(100) NOT NULL,
    "message_id" VARCHAR(100),
    "generation_id" VARCHAR(100),
    "source_type" VARCHAR(40) NOT NULL,
    "document_id" VARCHAR(100),
    "chunk_id" VARCHAR(100),
    "web_source_id" VARCHAR(100),
    "url" VARCHAR(1000),
    "title" VARCHAR(500) NOT NULL,
    "page_number" INTEGER,
    "section_heading" VARCHAR(255),
    "exact_quote" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "knowledge_documents_owner_id_status_idx" ON "knowledge_documents"("owner_id", "status");
CREATE INDEX IF NOT EXISTS "knowledge_documents_character_id_idx" ON "knowledge_documents"("character_id");
CREATE INDEX IF NOT EXISTS "knowledge_documents_content_hash_idx" ON "knowledge_documents"("content_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

CREATE INDEX IF NOT EXISTS "document_chunks_document_id_chunk_index_idx" ON "document_chunks"("document_id", "chunk_index");
CREATE INDEX IF NOT EXISTS "document_chunks_content_hash_idx" ON "document_chunks"("content_hash");

CREATE INDEX IF NOT EXISTS "knowledge_collections_owner_id_idx" ON "knowledge_collections"("owner_id");

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_collection_members_collection_id_document_id_key" ON "knowledge_collection_members"("collection_id", "document_id");

CREATE INDEX IF NOT EXISTS "web_research_tasks_user_id_status_idx" ON "web_research_tasks"("user_id", "status");
CREATE INDEX IF NOT EXISTS "web_research_tasks_conversation_id_idx" ON "web_research_tasks"("conversation_id");

CREATE INDEX IF NOT EXISTS "web_sources_research_task_id_idx" ON "web_sources"("research_task_id");
CREATE INDEX IF NOT EXISTS "web_sources_domain_idx" ON "web_sources"("domain");
CREATE INDEX IF NOT EXISTS "web_sources_url_idx" ON "web_sources"("url");

CREATE INDEX IF NOT EXISTS "citation_records_message_id_idx" ON "citation_records"("message_id");
CREATE INDEX IF NOT EXISTS "citation_records_document_id_idx" ON "citation_records"("document_id");
CREATE INDEX IF NOT EXISTS "citation_records_chunk_id_idx" ON "citation_records"("chunk_id");

-- AddForeignKeys
ALTER TABLE "document_versions" DROP CONSTRAINT IF EXISTS "document_versions_document_id_fkey";
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_chunks" DROP CONSTRAINT IF EXISTS "document_chunks_document_id_fkey";
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_chunks" DROP CONSTRAINT IF EXISTS "document_chunks_version_id_fkey";
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_collection_members" DROP CONSTRAINT IF EXISTS "knowledge_collection_members_collection_id_fkey";
ALTER TABLE "knowledge_collection_members" ADD CONSTRAINT "knowledge_collection_members_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "knowledge_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_collection_members" DROP CONSTRAINT IF EXISTS "knowledge_collection_members_document_id_fkey";
ALTER TABLE "knowledge_collection_members" ADD CONSTRAINT "knowledge_collection_members_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "web_sources" DROP CONSTRAINT IF EXISTS "web_sources_research_task_id_fkey";
ALTER TABLE "web_sources" ADD CONSTRAINT "web_sources_research_task_id_fkey" FOREIGN KEY ("research_task_id") REFERENCES "web_research_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
