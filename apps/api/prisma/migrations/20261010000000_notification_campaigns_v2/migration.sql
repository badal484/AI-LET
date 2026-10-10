-- Admin notification campaigns: banner image, sender (Lovira or a character), buttons, where it shows
-- (push / inbox / in-app banner / popup), local-time sending, quiet hours, frequency cap, and one row
-- per person for delivery, opens and taps.
ALTER TABLE "notification_campaigns"
  ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "sender_character_id" UUID,
  ADD COLUMN IF NOT EXISTS "post_in_chat" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "buttons" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "surfaces" JSONB NOT NULL DEFAULT '["push","inbox"]',
  ADD COLUMN IF NOT EXISTS "sound" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "local_hour" INTEGER,
  ADD COLUMN IF NOT EXISTS "respect_quiet_hours" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "skip_recent_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "clicked_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "campaign_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL REFERENCES "notification_campaigns"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- PENDING (waiting: their local hour / quiet hours) | SENT | SKIPPED | FAILED
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "skip_reason" VARCHAR(60),
  "devices_sent" INTEGER NOT NULL DEFAULT 0,
  "sent_at" TIMESTAMPTZ(6),
  "opened_at" TIMESTAMPTZ(6),
  "clicked_at" TIMESTAMPTZ(6),
  "dismissed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_recipients_campaign_id_user_id_key" ON "campaign_recipients"("campaign_id", "user_id");
CREATE INDEX IF NOT EXISTS "campaign_recipients_campaign_id_status_idx" ON "campaign_recipients"("campaign_id", "status");
CREATE INDEX IF NOT EXISTS "campaign_recipients_user_id_sent_at_idx" ON "campaign_recipients"("user_id", "sent_at" DESC);
