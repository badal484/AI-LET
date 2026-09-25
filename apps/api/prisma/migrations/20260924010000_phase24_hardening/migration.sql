-- Phase 24 hardening: pg_trgm search indexes, resumable account-deletion pipeline, social event
-- outbox + consumer receipts, moderation audit fields, per-category social push preferences.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterEnum
ALTER TYPE "AccountDeletionStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "account_deletion_requests" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completed_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "current_step" VARCHAR(40),
ADD COLUMN     "last_error" VARCHAR(1000),
ADD COLUMN     "locked_by" VARCHAR(100),
ADD COLUMN     "locked_until" TIMESTAMPTZ(6),
ADD COLUMN     "started_at" TIMESTAMPTZ(6),
ADD COLUMN     "step_log" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "verified_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "social_moderation_actions" ADD COLUMN     "new_state" VARCHAR(40),
ADD COLUMN     "policy_version" INTEGER,
ADD COLUMN     "previous_state" VARCHAR(40);

-- AlterTable
ALTER TABLE "social_moderation_cases" ADD COLUMN     "decided_policy_version" INTEGER,
ADD COLUMN     "opened_policy_version" INTEGER,
ADD COLUMN     "target_version" INTEGER;

-- AlterTable
ALTER TABLE "user_notification_preferences" ADD COLUMN     "social_category_push" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "social_event_outbox" (
    "id" UUID NOT NULL,
    "event_name" VARCHAR(60) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "actor_id" UUID,
    "target_id" VARCHAR(100),
    "privacy" VARCHAR(20) NOT NULL DEFAULT 'PERSONAL',
    "payload" JSONB NOT NULL,
    "request_id" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" VARCHAR(1000),
    "dispatched_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_event_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_event_receipts" (
    "event_id" UUID NOT NULL,
    "consumer" VARCHAR(60) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_event_receipts_pkey" PRIMARY KEY ("event_id","consumer")
);

-- CreateIndex
CREATE INDEX "social_event_outbox_status_available_at_idx" ON "social_event_outbox"("status", "available_at");

-- CreateIndex
CREATE INDEX "social_event_outbox_created_at_idx" ON "social_event_outbox"("created_at");

-- CreateIndex
CREATE INDEX "social_event_receipts_processed_at_idx" ON "social_event_receipts"("processed_at");

-- CreateIndex
CREATE INDEX "account_deletion_requests_status_locked_until_idx" ON "account_deletion_requests"("status", "locked_until");

-- CreateIndex
CREATE INDEX "communities_name_trgm_idx" ON "communities" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "social_profiles_display_name_trgm_idx" ON "social_profiles" USING GIN ("display_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "social_profiles_username_trgm_idx" ON "social_profiles" USING GIN ("username" gin_trgm_ops);

