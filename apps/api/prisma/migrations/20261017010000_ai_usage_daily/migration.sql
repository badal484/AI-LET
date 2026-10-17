-- Daily totals of AI usage, kept for good (raw ai_usage_events are removed after 90 days by the retention job).
CREATE TABLE "ai_usage_daily" (
    "day" DATE NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "task" VARCHAR(50) NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "cached_tokens" BIGINT NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("day","model","task")
);
