-- Aligns hand-written Phase 25-30 migrations with schema.prisma: @updatedAt columns carry no DB default,
-- and one index is renamed to Prisma's canonical (length-truncated) name. No data changes.

-- AlterTable
ALTER TABLE "agent_tasks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "character_experiences" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "creator_knowledge_docs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_collections" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_documents" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "oauth_connections" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "skills" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_goals" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "character_world_state_events_character_id_entity_key_created_id" RENAME TO "character_world_state_events_character_id_entity_key_create_idx";

