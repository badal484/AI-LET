-- Phase 25: Advanced Character Intelligence, Skills, Goals, and Agent Runtime Persistence

-- CreateTable user_goals
CREATE TABLE "user_goals" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100),
    "conversation_id" VARCHAR(100),
    "category" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "constraints" JSONB,
    "active_task_id" VARCHAR(100),
    "metadata" JSONB,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable agent_tasks
CREATE TABLE "agent_tasks" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100),
    "conversation_id" VARCHAR(100),
    "goal_id" VARCHAR(100),
    "task_type" VARCHAR(40) NOT NULL,
    "objective" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'created',
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "bounds" JSONB NOT NULL,
    "plan_id" VARCHAR(100),
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "actual_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "failure_code" VARCHAR(60),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable agent_plans
CREATE TABLE "agent_plans" (
    "id" VARCHAR(100) NOT NULL,
    "task_id" VARCHAR(100) NOT NULL,
    "objective" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "estimated_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "required_permissions" JSONB NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL,
    "generated_by_model" VARCHAR(100) NOT NULL,
    "prompt_version" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable agent_task_checkpoints
CREATE TABLE "agent_task_checkpoints" (
    "id" VARCHAR(100) NOT NULL,
    "task_id" VARCHAR(100) NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_id" VARCHAR(100) NOT NULL,
    "state_snapshot" JSONB NOT NULL,
    "accumulated_output" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_task_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable high_risk_confirmations
CREATE TABLE "high_risk_confirmations" (
    "token" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "task_id" VARCHAR(100) NOT NULL,
    "step_id" VARCHAR(100) NOT NULL,
    "tool_slug" VARCHAR(100) NOT NULL,
    "arguments_hash" VARCHAR(64) NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL,
    "explanation" TEXT NOT NULL,
    "proposed_arguments" JSONB NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "high_risk_confirmations_pkey" PRIMARY KEY ("token")
);

-- CreateTable skills
CREATE TABLE "skills" (
    "id" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'published',
    "is_creator_skill" BOOLEAN NOT NULL DEFAULT false,
    "creator_id" VARCHAR(100),
    "required_capabilities" JSONB NOT NULL,
    "required_tool_slugs" JSONB NOT NULL,
    "max_steps" INTEGER NOT NULL DEFAULT 10,
    "max_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable skill_versions
CREATE TABLE "skill_versions" (
    "id" VARCHAR(100) NOT NULL,
    "skill_id" VARCHAR(100) NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "config" JSONB NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'published',
    "changelog" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable character_skills
CREATE TABLE "character_skills" (
    "id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "skill_slug" VARCHAR(80) NOT NULL,
    "assignment_type" VARCHAR(30) NOT NULL DEFAULT 'default',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "custom_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable character_experiences
CREATE TABLE "character_experiences" (
    "id" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "character_id" VARCHAR(100),
    "creator_id" VARCHAR(100),
    "goal_template" VARCHAR(100) NOT NULL,
    "required_skill_slugs" JSONB NOT NULL,
    "initial_prompt" TEXT NOT NULL,
    "ui_config" JSONB,
    "evaluation_criteria" JSONB,
    "status" VARCHAR(30) NOT NULL DEFAULT 'published',
    "version" VARCHAR(30) NOT NULL DEFAULT '1.0.0',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable character_runtime_snapshots
CREATE TABLE "character_runtime_snapshots" (
    "id" VARCHAR(100) NOT NULL,
    "conversation_id" VARCHAR(100) NOT NULL,
    "message_id" VARCHAR(100),
    "character_id" VARCHAR(100) NOT NULL,
    "character_version_id" VARCHAR(100) NOT NULL,
    "prompt_version" VARCHAR(50) NOT NULL,
    "behavior_policy_hash" VARCHAR(64) NOT NULL,
    "safety_policy_version" VARCHAR(50) NOT NULL,
    "model_id" VARCHAR(100) NOT NULL,
    "memory_ids" JSONB NOT NULL,
    "relationship_stage" VARCHAR(40),
    "active_goal_id" VARCHAR(100),
    "active_task_id" VARCHAR(100),
    "selected_skill_slugs" JSONB NOT NULL,
    "context_attribution" JSONB,
    "tokens_prompt" INTEGER NOT NULL DEFAULT 0,
    "tokens_completion" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_runtime_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable oauth_connections
CREATE TABLE "oauth_connections" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT,
    "iv" VARCHAR(64) NOT NULL,
    "tag" VARCHAR(64) NOT NULL,
    "scopes" JSONB NOT NULL,
    "account_email" VARCHAR(255),
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable user_tool_consents
CREATE TABLE "user_tool_consents" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "capability_slug" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "consent_version" VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_tool_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable creator_knowledge_docs
CREATE TABLE "creator_knowledge_docs" (
    "id" VARCHAR(100) NOT NULL,
    "creator_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100),
    "title" VARCHAR(200) NOT NULL,
    "source_url" VARCHAR(500),
    "original_filename" VARCHAR(255),
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'READY',
    "moderation_status" VARCHAR(30) NOT NULL DEFAULT 'PASSED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_knowledge_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable creator_knowledge_chunks
CREATE TABLE "creator_knowledge_chunks" (
    "id" VARCHAR(100) NOT NULL,
    "knowledge_id" VARCHAR(100) NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE INDEX "user_goals_user_id_status_idx" ON "user_goals"("user_id", "status");
CREATE INDEX "user_goals_user_id_last_active_at_idx" ON "user_goals"("user_id", "last_active_at" DESC);
CREATE INDEX "user_goals_character_id_idx" ON "user_goals"("character_id");

CREATE INDEX "agent_tasks_user_id_status_idx" ON "agent_tasks"("user_id", "status");
CREATE INDEX "agent_tasks_character_id_idx" ON "agent_tasks"("character_id");
CREATE INDEX "agent_tasks_goal_id_idx" ON "agent_tasks"("goal_id");
CREATE INDEX "agent_tasks_expires_at_idx" ON "agent_tasks"("expires_at");

CREATE UNIQUE INDEX "agent_plans_task_id_key" ON "agent_plans"("task_id");
CREATE INDEX "agent_task_checkpoints_task_id_step_index_idx" ON "agent_task_checkpoints"("task_id", "step_index");

CREATE INDEX "high_risk_confirmations_user_id_is_used_idx" ON "high_risk_confirmations"("user_id", "is_used");
CREATE INDEX "high_risk_confirmations_token_arguments_hash_idx" ON "high_risk_confirmations"("token", "arguments_hash");

CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");
CREATE INDEX "skills_category_status_idx" ON "skills"("category", "status");
CREATE INDEX "skills_is_creator_skill_creator_id_idx" ON "skills"("is_creator_skill", "creator_id");

CREATE UNIQUE INDEX "skill_versions_skill_id_version_key" ON "skill_versions"("skill_id", "version");

CREATE UNIQUE INDEX "character_skills_character_id_skill_slug_key" ON "character_skills"("character_id", "skill_slug");
CREATE INDEX "character_skills_character_id_is_enabled_idx" ON "character_skills"("character_id", "is_enabled");

CREATE UNIQUE INDEX "character_experiences_slug_key" ON "character_experiences"("slug");
CREATE INDEX "character_experiences_category_status_idx" ON "character_experiences"("category", "status");

CREATE INDEX "character_runtime_snapshots_conversation_id_idx" ON "character_runtime_snapshots"("conversation_id");
CREATE INDEX "character_runtime_snapshots_message_id_idx" ON "character_runtime_snapshots"("message_id");
CREATE INDEX "character_runtime_snapshots_character_id_idx" ON "character_runtime_snapshots"("character_id");

CREATE UNIQUE INDEX "oauth_connections_user_id_provider_key" ON "oauth_connections"("user_id", "provider");
CREATE INDEX "oauth_connections_user_id_status_idx" ON "oauth_connections"("user_id", "status");

CREATE INDEX "user_tool_consents_user_id_capability_slug_idx" ON "user_tool_consents"("user_id", "capability_slug");

CREATE INDEX "creator_knowledge_docs_creator_id_status_idx" ON "creator_knowledge_docs"("creator_id", "status");
CREATE INDEX "creator_knowledge_docs_character_id_idx" ON "creator_knowledge_docs"("character_id");

CREATE INDEX "creator_knowledge_chunks_knowledge_id_chunk_index_idx" ON "creator_knowledge_chunks"("knowledge_id", "chunk_index");

-- Foreign Keys
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "user_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_plans" ADD CONSTRAINT "agent_plans_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "agent_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_task_checkpoints" ADD CONSTRAINT "agent_task_checkpoints_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "agent_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_knowledge_chunks" ADD CONSTRAINT "creator_knowledge_chunks_knowledge_id_fkey" FOREIGN KEY ("knowledge_id") REFERENCES "creator_knowledge_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
