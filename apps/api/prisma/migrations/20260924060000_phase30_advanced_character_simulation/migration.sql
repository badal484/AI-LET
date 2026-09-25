-- CreateTable
CREATE TABLE IF NOT EXISTS "character_plans" (
    "id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_version_id" VARCHAR(100),
    "goal_id" VARCHAR(100),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_plan_steps" (
    "id" VARCHAR(100) NOT NULL,
    "plan_id" VARCHAR(100) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "dependencies" JSONB,
    "completion_criteria" TEXT,
    "estimated_effort" VARCHAR(50),
    "output" JSONB,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_plan_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_world_states" (
    "id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100),
    "character_version_id" VARCHAR(100),
    "entity_key" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "state_value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_event_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_world_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_world_state_events" (
    "id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100),
    "character_version_id" VARCHAR(100),
    "event_type" VARCHAR(60) NOT NULL,
    "entity_key" VARCHAR(100) NOT NULL,
    "delta" JSONB NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_world_state_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "character_simulation_events" (
    "id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100),
    "character_version_id" VARCHAR(100),
    "event_type" VARCHAR(60) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "state_version" INTEGER NOT NULL DEFAULT 1,
    "correlation_id" VARCHAR(100),
    "idempotency_key" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_simulation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_simulation_settings" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "autonomy_level" VARCHAR(30) NOT NULL DEFAULT 'CONTEXTUAL',
    "proactive_enabled" BOOLEAN NOT NULL DEFAULT true,
    "routines_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "plans_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" VARCHAR(10) NOT NULL DEFAULT '22:00',
    "quiet_hours_end" VARCHAR(10) NOT NULL DEFAULT '08:00',
    "user_timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_simulation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "character_plans_user_id_character_id_status_idx" ON "character_plans"("user_id", "character_id", "status");
CREATE INDEX IF NOT EXISTS "character_plans_character_id_status_idx" ON "character_plans"("character_id", "status");
CREATE INDEX IF NOT EXISTS "character_plans_goal_id_idx" ON "character_plans"("goal_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "character_plan_steps_plan_id_sequence_idx" ON "character_plan_steps"("plan_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "character_world_states_character_id_user_id_entity_key_key" ON "character_world_states"("character_id", "user_id", "entity_key");
CREATE INDEX IF NOT EXISTS "character_world_states_character_id_entity_type_idx" ON "character_world_states"("character_id", "entity_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "character_world_state_events_character_id_entity_key_created_idx" ON "character_world_state_events"("character_id", "entity_key", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "character_simulation_events_idempotency_key_key" ON "character_simulation_events"("idempotency_key");
CREATE INDEX IF NOT EXISTS "character_simulation_events_character_id_user_id_created_at_idx" ON "character_simulation_events"("character_id", "user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "character_simulation_events_correlation_id_idx" ON "character_simulation_events"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_simulation_settings_user_id_character_id_key" ON "user_simulation_settings"("user_id", "character_id");

-- AddForeignKey
ALTER TABLE "character_plans" ADD CONSTRAINT "character_plans_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "character_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_plan_steps" ADD CONSTRAINT "character_plan_steps_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "character_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
