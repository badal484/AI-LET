-- CreateTable
CREATE TABLE IF NOT EXISTS "developer_organizations" (
    "id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "billing_email" VARCHAR(255) NOT NULL,
    "tier" VARCHAR(30) NOT NULL DEFAULT 'FREE',
    "monthly_budget_usd" DOUBLE PRECISION,
    "spend_alert_thresholds" JSONB NOT NULL DEFAULT '[50, 75, 90, 100]',
    "hard_limit_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "developer_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "developer_org_members" (
    "id" VARCHAR(100) NOT NULL,
    "organization_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "role" VARCHAR(30) NOT NULL DEFAULT 'DEVELOPER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "developer_org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "developer_projects" (
    "id" VARCHAR(100) NOT NULL,
    "organization_id" VARCHAR(100),
    "user_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "environment" VARCHAR(30) NOT NULL DEFAULT 'DEVELOPMENT',
    "allowed_origins" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "developer_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "developer_api_keys" (
    "id" VARCHAR(100) NOT NULL,
    "project_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key_prefix" VARCHAR(30) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "key_type" VARCHAR(20) NOT NULL DEFAULT 'SERVER',
    "scopes" JSONB NOT NULL,
    "environment" VARCHAR(30) NOT NULL DEFAULT 'DEVELOPMENT',
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "developer_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_applications" (
    "id" VARCHAR(100) NOT NULL,
    "project_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "client_id" VARCHAR(100) NOT NULL,
    "client_secret_hash" VARCHAR(128),
    "redirect_uris" JSONB NOT NULL,
    "allowed_scopes" JSONB NOT NULL,
    "is_public_client" BOOLEAN NOT NULL DEFAULT false,
    "client_type" VARCHAR(30) NOT NULL DEFAULT 'WEB',
    "logo_url" VARCHAR(500),
    "privacy_policy_url" VARCHAR(500),
    "terms_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "oauth_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_consents" (
    "id" VARCHAR(100) NOT NULL,
    "application_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "granted_scopes" JSONB NOT NULL,
    "consented_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "oauth_tokens" (
    "id" VARCHAR(100) NOT NULL,
    "application_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "access_token_hash" VARCHAR(64) NOT NULL,
    "refresh_token_hash" VARCHAR(64),
    "scopes" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
    "id" VARCHAR(100) NOT NULL,
    "project_id" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(128) NOT NULL,
    "description" VARCHAR(255),
    "event_types" JSONB NOT NULL,
    "environment" VARCHAR(30) NOT NULL DEFAULT 'DEVELOPMENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
    "id" VARCHAR(100) NOT NULL,
    "endpoint_id" VARCHAR(100) NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "status_code" INTEGER,
    "response_body" TEXT,
    "duration_ms" INTEGER,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "next_retry_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "developer_usage_records" (
    "id" VARCHAR(100) NOT NULL,
    "project_id" VARCHAR(100) NOT NULL,
    "metric" VARCHAR(50) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "model_id" VARCHAR(60),
    "endpoint" VARCHAR(120),
    "environment" VARCHAR(30) NOT NULL DEFAULT 'DEVELOPMENT',
    "idempotency_key" VARCHAR(128),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developer_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "developer_embed_configs" (
    "id" VARCHAR(100) NOT NULL,
    "project_id" VARCHAR(100) NOT NULL,
    "character_id" VARCHAR(100) NOT NULL,
    "origin_allowlist" JSONB NOT NULL,
    "theme" JSONB,
    "features" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "developer_embed_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "developer_organizations_slug_key" ON "developer_organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "developer_org_members_organization_id_user_id_key" ON "developer_org_members"("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "developer_org_members_user_id_idx" ON "developer_org_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "developer_projects_user_id_slug_key" ON "developer_projects"("user_id", "slug");
CREATE INDEX IF NOT EXISTS "developer_projects_organization_id_idx" ON "developer_projects"("organization_id");
CREATE INDEX IF NOT EXISTS "developer_projects_user_id_idx" ON "developer_projects"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "developer_api_keys_key_hash_key" ON "developer_api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "developer_api_keys_project_id_revoked_at_idx" ON "developer_api_keys"("project_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "developer_api_keys_key_prefix_idx" ON "developer_api_keys"("key_prefix");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_applications_client_id_key" ON "oauth_applications"("client_id");
CREATE INDEX IF NOT EXISTS "oauth_applications_project_id_idx" ON "oauth_applications"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_consents_application_id_user_id_key" ON "oauth_consents"("application_id", "user_id");
CREATE INDEX IF NOT EXISTS "oauth_consents_user_id_idx" ON "oauth_consents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_tokens_access_token_hash_key" ON "oauth_tokens"("access_token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_tokens_refresh_token_hash_key" ON "oauth_tokens"("refresh_token_hash");
CREATE INDEX IF NOT EXISTS "oauth_tokens_user_id_application_id_idx" ON "oauth_tokens"("user_id", "application_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhook_endpoints_project_id_active_idx" ON "webhook_endpoints"("project_id", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "webhook_deliveries_endpoint_id_status_idx" ON "webhook_deliveries"("endpoint_id", "status");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_event_id_idx" ON "webhook_deliveries"("event_id");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_next_retry_at_idx" ON "webhook_deliveries"("next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "developer_usage_records_idempotency_key_key" ON "developer_usage_records"("idempotency_key");
CREATE INDEX IF NOT EXISTS "developer_usage_records_project_id_metric_timestamp_idx" ON "developer_usage_records"("project_id", "metric", "timestamp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "developer_embed_configs_project_id_character_id_idx" ON "developer_embed_configs"("project_id", "character_id");

-- AddForeignKey
ALTER TABLE "developer_org_members" ADD CONSTRAINT "developer_org_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "developer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "developer_projects" ADD CONSTRAINT "developer_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "developer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "developer_api_keys" ADD CONSTRAINT "developer_api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "developer_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "developer_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "oauth_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "developer_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "developer_usage_records" ADD CONSTRAINT "developer_usage_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "developer_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "developer_embed_configs" ADD CONSTRAINT "developer_embed_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "developer_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
