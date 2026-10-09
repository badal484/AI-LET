-- Admin console: safety moments (no message text), support requests, and app settings.
CREATE TABLE IF NOT EXISTS "safety_moments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "character_id" UUID,
  "conversation_id" UUID,
  "message_id" UUID,
  "kind" VARCHAR(30) NOT NULL,
  "helpline_shown" BOOLEAN NOT NULL DEFAULT false,
  "resolved_at" TIMESTAMPTZ(6),
  "resolved_by" UUID,
  "note" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_moments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "safety_moments_created_at_idx" ON "safety_moments"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "safety_moments_kind_created_at_idx" ON "safety_moments"("kind", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "support_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "topic" VARCHAR(40) NOT NULL,
  "message" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "reply" TEXT,
  "replied_by" UUID,
  "replied_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "support_requests_status_created_at_idx" ON "support_requests"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "support_requests_user_id_idx" ON "support_requests"("user_id");

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" VARCHAR(80) NOT NULL,
  "value" JSONB NOT NULL,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
