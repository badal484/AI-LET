-- CreateTable
CREATE TABLE IF NOT EXISTS "character_goals" (
    "id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "character_version_id" VARCHAR(100),
    "user_id" VARCHAR(100) NOT NULL,
    "owner" VARCHAR(30) NOT NULL DEFAULT 'CHARACTER',
    "category" VARCHAR(60) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "progress_type" VARCHAR(30) NOT NULL DEFAULT 'PERCENTAGE',
    "qualitative_progress" VARCHAR(30),
    "start_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6),
    "last_progress_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "abandoned_at" TIMESTAMPTZ(6),
    "source" VARCHAR(50),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "constraints" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_goal_milestones" (
    "id" VARCHAR(100) NOT NULL,
    "goal_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_goal_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_goal_tasks" (
    "id" VARCHAR(100) NOT NULL,
    "goal_id" VARCHAR(100) NOT NULL,
    "milestone_id" VARCHAR(100),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "assigned_to" VARCHAR(30) NOT NULL DEFAULT 'CHARACTER',
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_goal_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_routines" (
    "id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "character_version_id" VARCHAR(100),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "routine_type" VARCHAR(40) NOT NULL,
    "schedule_cron" VARCHAR(100),
    "timezone_policy" VARCHAR(50) NOT NULL DEFAULT 'USER_LOCAL_OR_UTC',
    "frequency_limit_per_day" INTEGER NOT NULL DEFAULT 1,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 60,
    "quiet_hours_start" VARCHAR(10),
    "quiet_hours_end" VARCHAR(10),
    "priority" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "constraints" JSONB,
    "last_triggered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "open_conversational_threads" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "conversation_id" VARCHAR(100),
    "topic" VARCHAR(200) NOT NULL,
    "context_snippet" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source_message_id" VARCHAR(100),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "open_conversational_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_commitments" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "conversation_id" VARCHAR(100),
    "commitment_type" VARCHAR(40) NOT NULL,
    "description" TEXT NOT NULL,
    "source_message_id" VARCHAR(100),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "attempts_made" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "fulfilled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_simulation_states" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "current_focus" VARCHAR(200),
    "behavior_mode" VARCHAR(40) NOT NULL DEFAULT 'supportive',
    "behavior_reason" TEXT,
    "behavior_expires_at" TIMESTAMPTZ(6),
    "initiative_level" VARCHAR(30) NOT NULL DEFAULT 'BALANCED',
    "last_simulation_at" TIMESTAMPTZ(6),
    "next_eligible_simulation_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_simulation_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "simulation_run_records" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "character_version_id" VARCHAR(100),
    "trigger_type" VARCHAR(40) NOT NULL,
    "trigger_event_id" VARCHAR(100),
    "status" VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
    "model_id" VARCHAR(100),
    "prompt_version" VARCHAR(50),
    "context_hash" VARCHAR(64),
    "output_hash" VARCHAR(64),
    "proposals_count" INTEGER NOT NULL DEFAULT 0,
    "accepted_proposals_count" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(60),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_run_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "simulation_state_snapshots" (
    "id" VARCHAR(100) NOT NULL,
    "simulation_run_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "state_hash" VARCHAR(64) NOT NULL,
    "active_goal_ids" JSONB NOT NULL,
    "open_thread_ids" JSONB NOT NULL,
    "commitment_ids" JSONB NOT NULL,
    "behavior_mode" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_state_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_simulation_policies" (
    "id" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED',
    "initiative_level" VARCHAR(30) NOT NULL DEFAULT 'BALANCED',
    "max_simulations_per_user_day" INTEGER NOT NULL DEFAULT 5,
    "max_proactive_candidates_per_day" INTEGER NOT NULL DEFAULT 2,
    "max_active_goals_per_user" INTEGER NOT NULL DEFAULT 5,
    "max_open_threads_per_user" INTEGER NOT NULL DEFAULT 10,
    "max_active_commitments_per_user" INTEGER NOT NULL DEFAULT 5,
    "proposals_allowed" JSONB NOT NULL,
    "safety_settings" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_simulation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "character_goals_user_id_character_id_status_idx" ON "character_goals"("user_id", "character_id", "status");
CREATE INDEX IF NOT EXISTS "character_goals_character_id_status_idx" ON "character_goals"("character_id", "status");
CREATE INDEX IF NOT EXISTS "character_goals_due_at_idx" ON "character_goals"("due_at");

CREATE INDEX IF NOT EXISTS "character_goal_milestones_goal_id_order_index_idx" ON "character_goal_milestones"("goal_id", "order_index");

CREATE INDEX IF NOT EXISTS "character_goal_tasks_goal_id_status_idx" ON "character_goal_tasks"("goal_id", "status");
CREATE INDEX IF NOT EXISTS "character_goal_tasks_milestone_id_idx" ON "character_goal_tasks"("milestone_id");

CREATE INDEX IF NOT EXISTS "character_routines_character_id_active_idx" ON "character_routines"("character_id", "active");

CREATE INDEX IF NOT EXISTS "open_conversational_threads_user_id_character_id_status_idx" ON "open_conversational_threads"("user_id", "character_id", "status");
CREATE INDEX IF NOT EXISTS "open_conversational_threads_expires_at_idx" ON "open_conversational_threads"("expires_at");

CREATE INDEX IF NOT EXISTS "character_commitments_user_id_character_id_status_idx" ON "character_commitments"("user_id", "character_id", "status");
CREATE INDEX IF NOT EXISTS "character_commitments_expires_at_idx" ON "character_commitments"("expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "character_simulation_states_user_id_character_id_key" ON "character_simulation_states"("user_id", "character_id");

CREATE INDEX IF NOT EXISTS "simulation_run_records_user_id_character_id_created_at_idx" ON "simulation_run_records"("user_id", "character_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "simulation_run_records_status_idx" ON "simulation_run_records"("status");

CREATE INDEX IF NOT EXISTS "simulation_state_snapshots_simulation_run_id_idx" ON "simulation_state_snapshots"("simulation_run_id");
CREATE INDEX IF NOT EXISTS "simulation_state_snapshots_user_id_character_id_idx" ON "simulation_state_snapshots"("user_id", "character_id");

CREATE UNIQUE INDEX IF NOT EXISTS "character_simulation_policies_policy_version_key" ON "character_simulation_policies"("policy_version");

-- AddForeignKey
ALTER TABLE "character_goal_milestones" ADD CONSTRAINT "character_goal_milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "character_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_goal_tasks" ADD CONSTRAINT "character_goal_tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "character_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_goal_tasks" ADD CONSTRAINT "character_goal_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "character_goal_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_state_snapshots" ADD CONSTRAINT "simulation_state_snapshots_simulation_run_id_fkey" FOREIGN KEY ("simulation_run_id") REFERENCES "simulation_run_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
