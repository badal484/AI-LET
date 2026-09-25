-- Baseline migration.
-- Generated from the schema previously applied with `prisma db push` (no migration history existed).
-- Fresh databases: applied normally by `prisma migrate deploy`.
-- Databases created earlier with `db push`: mark as applied WITHOUT running it:
--   pnpm --filter @ai-companion/api exec prisma migrate resolve --applied 20260924000000_baseline

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccountDeletionStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AccountRestrictionType" AS ENUM ('CANNOT_CREATE_CHARACTER', 'CANNOT_PUBLISH', 'CANNOT_UPLOAD_MEDIA', 'CANNOT_USE_VOICE', 'CANNOT_SEND_MESSAGES', 'CANNOT_PURCHASE', 'ACCOUNT_RESTRICTED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'SOCIAL_RESTRICTED', 'CANNOT_COMMENT', 'CANNOT_DIRECT_MESSAGE', 'CANNOT_SHARE_CONTENT', 'CANNOT_CREATE_COMMUNITIES');

-- CreateEnum
CREATE TYPE "public"."BillingProvider" AS ENUM ('APPLE', 'GOOGLE', 'STRIPE', 'MOCK');

-- CreateEnum
CREATE TYPE "public"."CharacterModerationStatus" AS ENUM ('DRAFT', 'PENDING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."CharacterSourceType" AS ENUM ('OFFICIAL', 'CREATOR', 'PARTNER');

-- CreateEnum
CREATE TYPE "public"."CharacterStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'REVIEW', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "public"."CharacterVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "public"."CharacterVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."CommunityMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'PENDING', 'MUTED', 'BANNED', 'LEFT');

-- CreateEnum
CREATE TYPE "public"."CommunityPrivacy" AS ENUM ('PUBLIC', 'DISCOVERABLE_PRIVATE', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "public"."CommunityRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."CreatorStatus" AS ENUM ('PENDING', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'BANNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."CreatorVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'PARTNER');

-- CreateEnum
CREATE TYPE "public"."CreditTransactionType" AS ENUM ('PURCHASE', 'GRANT', 'CONSUMPTION', 'REFUND', 'EXPIRATION', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "public"."DataExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."DiscoveryEventType" AS ENUM ('IMPRESSION', 'CLICK', 'DETAIL_VIEW', 'CHAT_START', 'FAVORITE', 'DISMISS');

-- CreateEnum
CREATE TYPE "public"."EntitlementSource" AS ENUM ('SUBSCRIPTION', 'PROMOTION', 'ONE_TIME', 'ADMIN_GRANT', 'TRIAL', 'SYSTEM_FREE');

-- CreateEnum
CREATE TYPE "public"."HomeSectionLayout" AS ENUM ('HERO', 'CAROUSEL', 'GRID', 'BANNER', 'CHIPS');

-- CreateEnum
CREATE TYPE "public"."IncidentCategory" AS ENUM ('SAFETY', 'PRIVACY', 'SECURITY', 'BILLING', 'AVAILABILITY');

-- CreateEnum
CREATE TYPE "public"."IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

-- CreateEnum
CREATE TYPE "public"."IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."KillSwitchType" AS ENUM ('DISABLE_CHARACTER_PUBLISHING', 'DISABLE_IMAGE_GENERATION', 'DISABLE_VOICE_CALLS', 'DISABLE_PROACTIVE_NOTIFICATIONS', 'DISABLE_MODEL_PROVIDER', 'DISABLE_CHARACTER');

-- CreateEnum
CREATE TYPE "public"."MemoryCategory" AS ENUM ('PREFERENCE', 'INTEREST', 'GOAL', 'HABIT', 'PERSONAL_FACT', 'IMPORTANT_EVENT', 'RELATIONSHIP', 'COMMUNICATION_PREFERENCE', 'TEMPORARY_CONTEXT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MemoryScope" AS ENUM ('GLOBAL_USER', 'CHARACTER_SPECIFIC');

-- CreateEnum
CREATE TYPE "public"."MemorySensitivity" AS ENUM ('NORMAL', 'SENSITIVE', 'HIGHLY_SENSITIVE');

-- CreateEnum
CREATE TYPE "public"."MemorySignalType" AS ENUM ('EXPLICIT', 'IMPLICIT', 'INFERRED', 'SYSTEM_GENERATED');

-- CreateEnum
CREATE TYPE "public"."MemoryStatus" AS ENUM ('CANDIDATE', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."MemoryType" AS ENUM ('EPISODIC', 'SEMANTIC_FACT', 'PREFERENCE', 'RELATIONSHIP_MILESTONE');

-- CreateEnum
CREATE TYPE "public"."MessageSenderType" AS ENUM ('USER', 'CHARACTER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."MessageStatus" AS ENUM ('PENDING', 'STREAMING', 'SENT', 'FAILED', 'INTERRUPTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."ModerationDecisionType" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'SUSPEND', 'UNPUBLISH');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "public"."PlanInterval" AS ENUM ('MONTH', 'YEAR', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "public"."PriceCurrency" AS ENUM ('INR', 'USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DRAFT');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME', 'CREDIT_PACK', 'ADD_ON');

-- CreateEnum
CREATE TYPE "public"."PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_CREDITS', 'TRIAL_EXTENSION');

-- CreateEnum
CREATE TYPE "public"."ReconciliationStatus" AS ENUM ('MATCH', 'MISMATCH', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."RejectionReasonCode" AS ENUM ('PROHIBITED_CONTENT', 'IMPERSONATION', 'COPYRIGHT_CONCERN', 'SAFETY_CONFIGURATION', 'MISLEADING_DESCRIPTION', 'SEXUAL_CONTENT_POLICY', 'MINOR_SAFETY', 'HARASSMENT', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RelationshipStage" AS ENUM ('STRANGER', 'ACQUAINTANCE', 'FRIEND', 'CLOSE_FRIEND', 'CONFIDANT', 'ROMANTIC_PARTNER');

-- CreateEnum
CREATE TYPE "public"."ReportReasonCode" AS ENUM ('UNSAFE', 'HARASSMENT', 'IMPERSONATION', 'COPYRIGHT', 'SEXUAL_CONTENT', 'MISLEADING', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SafetyDecision" AS ENUM ('ALLOW', 'ALLOW_WITH_TRANSFORM', 'BLOCK', 'REVIEW', 'ESCALATE');

-- CreateEnum
CREATE TYPE "public"."SafetyRiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."SafetySurface" AS ENUM ('INPUT', 'OUTPUT', 'CREATOR_CONTENT', 'KNOWLEDGE', 'MEDIA', 'VOICE', 'PROACTIVE', 'STREAM');

-- CreateEnum
CREATE TYPE "public"."ScheduledSocialActionStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."SocialAppealStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'UPHELD', 'REVERSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."SocialAudience" AS ENUM ('EVERYONE', 'FOLLOWERS', 'MUTUALS', 'NOBODY');

-- CreateEnum
CREATE TYPE "public"."SocialAuthorType" AS ENUM ('USER', 'CREATOR', 'AI_CHARACTER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "public"."SocialCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "public"."SocialCommentStatus" AS ENUM ('PENDING_MODERATION', 'PUBLISHED', 'HIDDEN', 'REMOVED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."SocialContentKind" AS ENUM ('CHARACTER_SHARE', 'CONVERSATION_EXCERPT', 'MEDIA_SHARE', 'COLLECTION_SHARE', 'CREATOR_POST', 'CHARACTER_POST', 'COMMUNITY_POST');

-- CreateEnum
CREATE TYPE "public"."SocialContentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PENDING_MODERATION', 'PUBLISHED', 'RESTRICTED', 'HIDDEN', 'REJECTED', 'DELETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."SocialContentVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'FOLLOWERS', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "public"."SocialDirectMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'DELETED', 'MODERATED');

-- CreateEnum
CREATE TYPE "public"."SocialDirectThreadStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."SocialFollowPolicy" AS ENUM ('EVERYONE', 'APPROVAL_REQUIRED', 'NOBODY');

-- CreateEnum
CREATE TYPE "public"."SocialFollowStatus" AS ENUM ('ACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "public"."SocialMessageRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."SocialModerationQueue" AS ENUM ('PROFILES', 'USER_CONTENT', 'COMMENTS', 'MESSAGES', 'COMMUNITIES', 'CREATORS', 'AI_SOCIAL_CONTENT', 'MEDIA');

-- CreateEnum
CREATE TYPE "public"."SocialMuteScope" AS ENUM ('ALL', 'POSTS', 'COMMENTS', 'NOTIFICATIONS');

-- CreateEnum
CREATE TYPE "public"."SocialMuteTargetType" AS ENUM ('USER', 'CREATOR', 'CHARACTER', 'COMMUNITY', 'TOPIC', 'NOTIFICATION_CATEGORY');

-- CreateEnum
CREATE TYPE "public"."SocialProfileVisibility" AS ENUM ('PUBLIC', 'LIMITED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."SocialReactionType" AS ENUM ('LIKE', 'FAVORITE', 'APPRECIATION', 'USEFUL');

-- CreateEnum
CREATE TYPE "public"."SocialReportTargetType" AS ENUM ('PROFILE', 'CHARACTER', 'CONTENT', 'COMMENT', 'DIRECT_MESSAGE', 'COMMUNITY', 'CREATOR');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'PAUSED', 'CANCELLED', 'EXPIRED', 'INCOMPLETE', 'PAYMENT_FAILED');

-- CreateEnum
CREATE TYPE "public"."UsageReservationStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."WebhookProcessingStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "public"."account_deletion_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "public"."AccountDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
    "anonymize_financial_records" BOOLEAN NOT NULL DEFAULT true,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activation_funnel_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "anonymous_id" VARCHAR(100),
    "event_type" VARCHAR(50) NOT NULL,
    "step_key" VARCHAR(50),
    "character_id" UUID,
    "onboarding_version" INTEGER NOT NULL DEFAULT 1,
    "experiment_key" VARCHAR(50),
    "platform" VARCHAR(30) NOT NULL DEFAULT 'mobile',
    "app_version" VARCHAR(30),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_funnel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_role_assignments" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_sessions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "session_token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "normalized_email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" VARCHAR(255),
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_evaluation_datasets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_evaluation_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_evaluation_results" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "test_case_id" UUID NOT NULL,
    "generated_output" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "reasoning" TEXT,
    "violations" TEXT[],
    "regression_delta" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_evaluation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_evaluation_runs" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "dataset_version" INTEGER NOT NULL DEFAULT 1,
    "character_id" UUID,
    "character_version_id" UUID,
    "prompt_version_id" UUID,
    "model_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "total_cases" INTEGER NOT NULL DEFAULT 0,
    "passed_cases" INTEGER NOT NULL DEFAULT 0,
    "failed_cases" INTEGER NOT NULL DEFAULT 0,
    "average_latency_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "composite_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_breakdown" JSONB NOT NULL DEFAULT '{}',
    "regression_status" VARCHAR(30) NOT NULL DEFAULT 'NO_REGRESSION',
    "baseline_run_id" UUID,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_evaluation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_evaluation_test_cases" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'dialogue',
    "input_prompt" TEXT NOT NULL,
    "user_message" TEXT NOT NULL,
    "character_id" UUID,
    "character_config_snapshot" JSONB,
    "memory_context_snapshot" JSONB,
    "relationship_state_snapshot" JSONB,
    "expected_properties" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_evaluation_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_generation_traces" (
    "id" UUID NOT NULL,
    "request_id" VARCHAR(100) NOT NULL,
    "user_id" UUID,
    "character_id" UUID,
    "character_version_id" UUID,
    "conversation_id" UUID,
    "prompt_version_id" UUID,
    "model_id" UUID,
    "provider" VARCHAR(50) NOT NULL,
    "workload" VARCHAR(50) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "time_to_first_token_ms" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "error_code" VARCHAR(50),
    "context_hash" VARCHAR(64),
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_model_pricing" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "input_price_per_million" DOUBLE PRECISION NOT NULL,
    "output_price_per_million" DOUBLE PRECISION NOT NULL,
    "cached_input_price_per_million" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_model_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_models" (
    "id" UUID NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "input_cost_per_1k" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "output_cost_per_1k" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "capabilities" JSONB NOT NULL,
    "context_window" INTEGER NOT NULL DEFAULT 8192,
    "display_name" VARCHAR(100) NOT NULL,
    "fallback_model_id" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "latency_class" VARCHAR(20) NOT NULL DEFAULT 'balanced',
    "provider" VARCHAR(50) NOT NULL,
    "quality_class" VARCHAR(20) NOT NULL DEFAULT 'standard',

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_prompt_experiments" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "prompt_id" UUID NOT NULL,
    "control_version_id" UUID NOT NULL,
    "test_version_id" UUID NOT NULL,
    "traffic_split_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metrics" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_prompt_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_prompt_versions" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "template_content" TEXT NOT NULL,
    "input_variables" TEXT[],
    "token_estimate" INTEGER NOT NULL DEFAULT 0,
    "hash" VARCHAR(64) NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_prompts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "active_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_provider_health" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'HEALTHY',
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "average_latency_ms" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "last_failure_at" TIMESTAMPTZ(6),
    "circuit_open" BOOLEAN NOT NULL DEFAULT false,
    "circuit_open_until" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_provider_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_routing_policies" (
    "id" UUID NOT NULL,
    "workload" VARCHAR(50) NOT NULL,
    "preferred_model_id" UUID NOT NULL,
    "fallback_model_ids" TEXT[],
    "latency_sensitivity" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "max_cost_per_request" DOUBLE PRECISION,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_routing_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_usage_events" (
    "id" UUID NOT NULL,
    "request_id" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "task" VARCHAR(50) NOT NULL,
    "user_id" UUID,
    "character_id" UUID,
    "conversation_id" UUID,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    "breakdown" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_alerts" (
    "id" UUID NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "metrics" JSONB,
    "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    "acknowledged_by_admin_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_events" (
    "id" UUID NOT NULL,
    "event_name" VARCHAR(100) NOT NULL,
    "event_version" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID,
    "anonymous_id" VARCHAR(100),
    "session_id" VARCHAR(100),
    "device_id" VARCHAR(100),
    "character_id" UUID,
    "creator_id" UUID,
    "conversation_id" UUID,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "properties" JSONB,
    "app_version" VARCHAR(50),
    "platform" VARCHAR(50),
    "locale" VARCHAR(20),
    "timezone" VARCHAR(50),
    "experiment_id" VARCHAR(100),
    "experiment_variant" VARCHAR(50),
    "request_id" VARCHAR(100),
    "source" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" VARCHAR(20) NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" VARCHAR(100),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "provider_email" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_audit_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "actor_type" VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" VARCHAR(100),
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" VARCHAR(500),
    "request_id" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_invoices" (
    "id" UUID NOT NULL,
    "subscription_id" UUID,
    "transaction_id" UUID,
    "invoice_number" VARCHAR(50) NOT NULL,
    "currency" "public"."PriceCurrency" NOT NULL DEFAULT 'USD',
    "subtotal_minor" INTEGER NOT NULL,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "invoice_pdf_url" TEXT,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_plans" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tagline" VARCHAR(255) NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_prices" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "plan_id" UUID,
    "currency" "public"."PriceCurrency" NOT NULL DEFAULT 'USD',
    "amount_minor_units" INTEGER NOT NULL,
    "billing_interval" "public"."PlanInterval",
    "billing_interval_count" INTEGER NOT NULL DEFAULT 1,
    "provider" "public"."BillingProvider" NOT NULL DEFAULT 'MOCK',
    "provider_price_id" VARCHAR(100) NOT NULL,
    "country" VARCHAR(10),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6),
    "effective_until" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "type" "public"."ProductType" NOT NULL DEFAULT 'SUBSCRIPTION',
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_promotions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "discount_type" "public"."PromoDiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discount_value" DOUBLE PRECISION NOT NULL,
    "plan_id" UUID,
    "max_redemptions" INTEGER,
    "current_redemptions" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "target_audience" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_reconciliations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "provider" "public"."BillingProvider" NOT NULL DEFAULT 'MOCK',
    "provider_state" JSONB NOT NULL,
    "internal_state" JSONB NOT NULL,
    "status" "public"."ReconciliationStatus" NOT NULL DEFAULT 'MATCH',
    "mismatch_reason" VARCHAR(255),
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "price_id" UUID,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" "public"."BillingProvider" NOT NULL DEFAULT 'MOCK',
    "provider_subscription_id" VARCHAR(255),
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "trial_start" TIMESTAMPTZ(6),
    "trial_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "grace_period_end" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."billing_webhook_events" (
    "id" UUID NOT NULL,
    "provider" "public"."BillingProvider" NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "status" "public"."WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "icon_url" TEXT,
    "cover_image_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "character_id" UUID NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "starts" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "returning_users" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "voice_sessions" INTEGER NOT NULL DEFAULT 0,
    "media_interactions" INTEGER NOT NULL DEFAULT 0,
    "reports" INTEGER NOT NULL DEFAULT 0,
    "ai_cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gross_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_discovery_configs" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "category_id" UUID,
    "is_discoverable" BOOLEAN NOT NULL DEFAULT true,
    "is_searchable" BOOLEAN NOT NULL DEFAULT true,
    "is_trending_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_recommendation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "editorial_priority" INTEGER NOT NULL DEFAULT 0,
    "editorial_boost" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "new_until" TIMESTAMPTZ(6),
    "conversation_starters" JSONB NOT NULL DEFAULT '[]',
    "highlight_badges" JSONB NOT NULL DEFAULT '[]',
    "age_gate" INTEGER NOT NULL DEFAULT 0,
    "localized_profiles" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_discovery_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_follows" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_knowledge" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_reports" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "reason_code" "public"."ReportReasonCode" NOT NULL,
    "details" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "moderation_case_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_similarities" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "similar_character_id" UUID NOT NULL,
    "similarity_score" DOUBLE PRECISION NOT NULL,
    "match_reason" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_similarities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_social_capabilities" (
    "character_id" UUID NOT NULL,
    "can_publish" BOOLEAN NOT NULL DEFAULT false,
    "can_reply" BOOLEAN NOT NULL DEFAULT false,
    "can_comment" BOOLEAN NOT NULL DEFAULT false,
    "can_react" BOOLEAN NOT NULL DEFAULT false,
    "can_send_notifications" BOOLEAN NOT NULL DEFAULT false,
    "can_mention_users" BOOLEAN NOT NULL DEFAULT false,
    "can_message_users" BOOLEAN NOT NULL DEFAULT false,
    "requires_creator_approval" BOOLEAN NOT NULL DEFAULT true,
    "max_posts_per_day" INTEGER NOT NULL DEFAULT 2,
    "max_replies_per_hour" INTEGER NOT NULL DEFAULT 5,
    "max_interactions_per_user_per_day" INTEGER NOT NULL DEFAULT 3,
    "max_daily_cost_cents" INTEGER NOT NULL DEFAULT 50,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 600,
    "platform_approved" BOOLEAN NOT NULL DEFAULT false,
    "platform_approved_by_admin_id" UUID,
    "platform_approved_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_social_capabilities_pkey" PRIMARY KEY ("character_id")
);

-- CreateTable
CREATE TABLE "public"."character_tag_links" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_tags" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "category_id" UUID,
    "is_curated" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "character_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_traits" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "trait_key" VARCHAR(50) NOT NULL,
    "trait_value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."character_versions" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "change_summary" VARCHAR(255) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ai_config_data" JSONB NOT NULL,
    "behavior_rules_data" JSONB NOT NULL,
    "communication_data" JSONB NOT NULL,
    "compiled_prompt_snapshot" TEXT,
    "identity_data" JSONB NOT NULL,
    "knowledge_data" JSONB NOT NULL,
    "language_data" JSONB NOT NULL,
    "memory_config_data" JSONB NOT NULL,
    "personality_data" JSONB NOT NULL,
    "proactivity_config_data" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "relationship_config_data" JSONB NOT NULL,
    "safety_config_data" JSONB NOT NULL,
    "status" "public"."CharacterVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "voice_config_data" JSONB,

    CONSTRAINT "character_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."characters" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tagline" VARCHAR(255) NOT NULL,
    "avatar_url" TEXT NOT NULL,
    "cover_image_url" TEXT NOT NULL,
    "archetype" VARCHAR(50) NOT NULL,
    "backstory" TEXT NOT NULL,
    "age" SMALLINT NOT NULL,
    "gender" VARCHAR(50) NOT NULL,
    "occupation" VARCHAR(100) NOT NULL,
    "status" "public"."CharacterStatus" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "current_published_version_id" UUID,
    "current_version_number" INTEGER NOT NULL DEFAULT 1,
    "internal_key" VARCHAR(50) NOT NULL,
    "long_description" TEXT NOT NULL DEFAULT '',
    "short_description" VARCHAR(300) NOT NULL DEFAULT '',
    "updated_by_id" UUID,
    "visibility" "public"."CharacterVisibility" NOT NULL DEFAULT 'PUBLIC',
    "access_type" VARCHAR(30) NOT NULL DEFAULT 'free',
    "category_id" UUID,
    "change_request_details" TEXT,
    "creator_profile_id" UUID,
    "moderation_status" "public"."CharacterModerationStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "required_entitlement" VARCHAR(100),
    "source_type" "public"."CharacterSourceType" NOT NULL DEFAULT 'OFFICIAL',

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collection_items" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "custom_badge" VARCHAR(50),
    "highlight_note" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."communities" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "privacy" "public"."CommunityPrivacy" NOT NULL DEFAULT 'PUBLIC',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "owner_user_id" UUID,
    "character_id" UUID,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."community_members" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "public"."CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "status" "public"."CommunityMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "restricted_until" TIMESTAMPTZ(6),
    "invited_by_user_id" UUID,
    "rules_accepted_at" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_summaries" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "key_facts" JSONB NOT NULL DEFAULT '[]',
    "open_topics" JSONB NOT NULL DEFAULT '[]',
    "start_sequence_number" INTEGER NOT NULL,
    "end_sequence_number" INTEGER NOT NULL,
    "message_count" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(6),
    "last_message_snippet" VARCHAR(255),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "character_version_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "generation_locked_until" TIMESTAMPTZ(6),
    "title" VARCHAR(100) NOT NULL DEFAULT 'New Conversation',

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."creator_daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "creator_profile_id" UUID NOT NULL,
    "published_characters" INTEGER NOT NULL DEFAULT 0,
    "total_starts" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "returning_users" INTEGER NOT NULL DEFAULT 0,
    "gross_earnings" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "creator_net" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "reports" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "creator_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."creator_earnings_ledger" (
    "id" UUID NOT NULL,
    "creator_profile_id" UUID NOT NULL,
    "character_id" UUID,
    "creator_product_id" UUID,
    "event_type" VARCHAR(50) NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "platform_fee" INTEGER NOT NULL,
    "creator_net_amount" INTEGER NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "reference_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_earnings_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."creator_follows" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "creator_profile_id" UUID NOT NULL,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."creator_products" (
    "id" UUID NOT NULL,
    "creator_profile_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "product_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price_amount" INTEGER NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "creator_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."creator_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "bio" VARCHAR(500) NOT NULL DEFAULT '',
    "avatar_url" TEXT,
    "banner_url" TEXT,
    "website" VARCHAR(255),
    "social_links" JSONB,
    "status" "public"."CreatorStatus" NOT NULL DEFAULT 'PENDING',
    "verification_status" "public"."CreatorVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "accepted_guidelines_version" INTEGER NOT NULL DEFAULT 1,
    "guidelines_accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_characters_count" INTEGER NOT NULL DEFAULT 0,
    "published_characters_count" INTEGER NOT NULL DEFAULT 0,
    "total_followers_count" INTEGER NOT NULL DEFAULT 0,
    "total_conversations_count" INTEGER NOT NULL DEFAULT 0,
    "total_messages_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "public"."CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" VARCHAR(100),
    "description" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credit_wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "available_balance" INTEGER NOT NULL DEFAULT 0,
    "purchased_credits" INTEGER NOT NULL DEFAULT 0,
    "promotional_credits" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."curated_collections" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "subtitle" VARCHAR(255) NOT NULL DEFAULT '',
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "hero_image_url" TEXT,
    "badge_text" VARCHAR(50),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "publish_start_at" TIMESTAMPTZ(6),
    "publish_end_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "curated_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_export_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "public"."DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "data_types" JSONB NOT NULL,
    "download_url" TEXT,
    "download_expires_at" TIMESTAMPTZ(6),
    "file_size_bytes" BIGINT,
    "error_message" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "app_version" VARCHAR(30),
    "os_version" VARCHAR(30),
    "device_name" VARCHAR(100),
    "push_token" VARCHAR(255),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discovery_event_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" "public"."DiscoveryEventType" NOT NULL,
    "character_id" UUID,
    "surface" VARCHAR(50) NOT NULL DEFAULT 'HOME',
    "position" INTEGER,
    "recommendation_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."emergency_kill_switches" (
    "id" UUID NOT NULL,
    "switch_type" "public"."KillSwitchType" NOT NULL,
    "target_id" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "activated_by_admin_id" UUID,
    "activated_at" TIMESTAMPTZ(6),
    "deactivated_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "emergency_kill_switches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."experiment_assignments" (
    "id" UUID NOT NULL,
    "experiment_id" VARCHAR(100) NOT NULL,
    "subject_id" VARCHAR(100) NOT NULL,
    "variant_key" VARCHAR(50) NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."experiment_exposures" (
    "id" UUID NOT NULL,
    "experiment_id" VARCHAR(100) NOT NULL,
    "subject_id" VARCHAR(100) NOT NULL,
    "variant_key" VARCHAR(50) NOT NULL,
    "context" JSONB,
    "exposed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_exposures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."experiment_variants" (
    "id" UUID NOT NULL,
    "experiment_id" VARCHAR(100) NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100),
    "configuration" JSONB,
    "allocation_percentage" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."experiments" (
    "id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "targeting" JSONB,
    "primary_metric" VARCHAR(100) NOT NULL,
    "secondary_metrics" JSONB,
    "guardrail_metrics" JSONB,
    "allocation" INTEGER NOT NULL DEFAULT 100,
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_pct" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."home_section_configs" (
    "id" UUID NOT NULL,
    "section_key" VARCHAR(50) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "subtitle" VARCHAR(255) NOT NULL DEFAULT '',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "layout_style" "public"."HomeSectionLayout" NOT NULL DEFAULT 'CAROUSEL',
    "max_items" INTEGER NOT NULL DEFAULT 10,
    "filter_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "home_section_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."in_app_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "deep_link" VARCHAR(255),
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "source_type" VARCHAR(50),
    "source_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID,
    "conversation_id" UUID,
    "memory_type" "public"."MemoryType" NOT NULL DEFAULT 'SEMANTIC_FACT',
    "content" TEXT NOT NULL,
    "importance_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "last_recalled_at" TIMESTAMPTZ(6),
    "recall_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "category" "public"."MemoryCategory" NOT NULL DEFAULT 'PERSONAL_FACT',
    "expires_at" TIMESTAMPTZ(6),
    "last_reinforced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "normalized_content" TEXT,
    "reinforcement_count" INTEGER NOT NULL DEFAULT 1,
    "scope" "public"."MemoryScope" NOT NULL DEFAULT 'CHARACTER_SPECIFIC',
    "sensitivity" "public"."MemorySensitivity" NOT NULL DEFAULT 'NORMAL',
    "signal_type" "public"."MemorySignalType" NOT NULL DEFAULT 'IMPLICIT',
    "source_conversation_id" UUID,
    "source_message_id" UUID,
    "status" "public"."MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "superseded_by_id" UUID,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memory_access_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID,
    "query_context" TEXT NOT NULL,
    "retrieved_memory_ids" JSONB NOT NULL,
    "total_candidates" INTEGER NOT NULL,
    "selected_count" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memory_embeddings" (
    "id" UUID NOT NULL,
    "memory_id" UUID NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "embedding" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dimension" INTEGER NOT NULL DEFAULT 1536,
    "embedding_version" VARCHAR(50) NOT NULL DEFAULT 'v1',

    CONSTRAINT "memory_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_feedback" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" VARCHAR(20) NOT NULL,
    "feedback_text" VARCHAR(1000),
    "reason_category" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_generation_metadata" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "character_version_id" UUID NOT NULL,
    "model_class" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "temperature" DOUBLE PRECISION,
    "prompt_snapshot" TEXT,
    "system_fingerprint" VARCHAR(100),
    "finish_reason" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_generation_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_parts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "part_type" VARCHAR(30) NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "media_url" TEXT,
    "metadata" JSONB,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_type" "public"."MessageSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'SENT',
    "idempotency_key" VARCHAR(100),
    "media_type" VARCHAR(20) NOT NULL DEFAULT 'NONE',
    "media_url" TEXT,
    "audio_duration_seconds" INTEGER,
    "total_tokens" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "character_version_id" UUID,
    "client_request_id" VARCHAR(100),
    "completion_tokens" INTEGER,
    "estimated_cost_usd" DOUBLE PRECISION,
    "latency_ms" INTEGER,
    "model_used" VARCHAR(100),
    "prompt_tokens" INTEGER,
    "provider_used" VARCHAR(50),
    "reply_to_message_id" UUID,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "role" VARCHAR(20) NOT NULL DEFAULT 'user',
    "sender_id" UUID,
    "sequence_number" INTEGER NOT NULL DEFAULT 1,
    "ttft_ms" INTEGER,
    "is_proactive" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(30) NOT NULL DEFAULT 'user',

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."moderation_appeals" (
    "id" UUID NOT NULL,
    "moderation_case_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "creator_profile_id" UUID NOT NULL,
    "appeal_reason" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."moderation_cases" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "character_version_id" UUID,
    "creator_profile_id" UUID,
    "source" VARCHAR(30) NOT NULL DEFAULT 'SUBMISSION',
    "status" "public"."CharacterModerationStatus" NOT NULL DEFAULT 'PENDING',
    "risk_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "automated_flags" JSONB,
    "decision" "public"."ModerationDecisionType",
    "rejection_reason" "public"."RejectionReasonCode",
    "change_request_details" TEXT,
    "moderator_notes" TEXT,
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_campaigns" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL DEFAULT 'product_update',
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "target_audience" VARCHAR(50) NOT NULL DEFAULT 'ALL',
    "target_criteria" JSONB,
    "message_title" VARCHAR(150) NOT NULL,
    "message_body" TEXT NOT NULL,
    "deep_link" VARCHAR(255),
    "scheduled_for" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "estimated_audience" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_delivery_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(150),
    "category" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(30) NOT NULL DEFAULT 'MOCK',
    "provider_message_id" VARCHAR(100),
    "idempotency_key" VARCHAR(150) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'SENT',
    "failure_reason" VARCHAR(255),
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."onboarding_step_configs" (
    "id" UUID NOT NULL,
    "step_key" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "subtitle" VARCHAR(255) NOT NULL DEFAULT '',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config_data" JSONB NOT NULL DEFAULT '{}',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "onboarding_step_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_entitlements" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "entitlement_key" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_usage_limits" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "meter_unit" VARCHAR(50) NOT NULL,
    "limit_amount" INTEGER NOT NULL,
    "period" VARCHAR(20) NOT NULL DEFAULT 'month',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_usage_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proactive_actions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "character_version_id" UUID NOT NULL,
    "conversation_id" UUID,
    "intent_type" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'CANDIDATE',
    "skip_reason" VARCHAR(50),
    "scheduled_for" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "generated_message_id" UUID,
    "notification_id" VARCHAR(100),
    "decision_metadata" JSONB,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "replied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proactive_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proactive_decision_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "decision" VARCHAR(20) NOT NULL,
    "reason_code" VARCHAR(50) NOT NULL,
    "intent_type" VARCHAR(50),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proactive_decision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "dau" INTEGER NOT NULL DEFAULT 0,
    "wau" INTEGER NOT NULL DEFAULT 0,
    "mau" INTEGER NOT NULL DEFAULT 0,
    "new_users" INTEGER NOT NULL DEFAULT 0,
    "activated_users" INTEGER NOT NULL DEFAULT 0,
    "d1_retained" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "d7_retained" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "d30_retained" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ai_cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gross_margin" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "voice_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "image_generations" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."promo_redemptions" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "redeemed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "provider" "public"."BillingProvider" NOT NULL DEFAULT 'MOCK',
    "provider_transaction_id" VARCHAR(255) NOT NULL,
    "idempotency_key" VARCHAR(100),
    "product_id" VARCHAR(100) NOT NULL,
    "currency" "public"."PriceCurrency" NOT NULL DEFAULT 'USD',
    "amount_minor_units" INTEGER NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "raw_receipt_data" TEXT,
    "refund_reason" VARCHAR(255),
    "refunded_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ranking_configs" (
    "id" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "weights" JSONB NOT NULL,
    "diversity_rules" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_shadow" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ranking_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."relationship_events" (
    "id" UUID NOT NULL,
    "relationship_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "delta_trust" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "delta_affection" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "delta_comfort" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "delta_engagement" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "delta_familiarity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB,
    "source_conversation_id" UUID,
    "source_message_id" UUID,

    CONSTRAINT "relationship_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."relationship_milestones" (
    "id" UUID NOT NULL,
    "relationship_id" UUID NOT NULL,
    "milestone_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "source_conversation_id" UUID,
    "achieved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."relationship_state_history" (
    "id" UUID NOT NULL,
    "relationship_id" UUID NOT NULL,
    "previous_stage" "public"."RelationshipStage" NOT NULL,
    "new_stage" "public"."RelationshipStage" NOT NULL,
    "previous_familiarity" DOUBLE PRECISION NOT NULL,
    "new_familiarity" DOUBLE PRECISION NOT NULL,
    "previous_trust" DOUBLE PRECISION NOT NULL,
    "new_trust" DOUBLE PRECISION NOT NULL,
    "previous_comfort" DOUBLE PRECISION NOT NULL,
    "new_comfort" DOUBLE PRECISION NOT NULL,
    "previous_affection" DOUBLE PRECISION NOT NULL,
    "new_affection" DOUBLE PRECISION NOT NULL,
    "previous_engagement" DOUBLE PRECISION NOT NULL,
    "new_engagement" DOUBLE PRECISION NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "event_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."relationships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "stage" "public"."RelationshipStage" NOT NULL DEFAULT 'STRANGER',
    "familiarity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "trust" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "affection" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "comfort" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "total_interactions" INTEGER NOT NULL DEFAULT 0,
    "last_interaction_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "consecutive_days_active" INTEGER NOT NULL DEFAULT 0,
    "engagement" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."safety_evaluation_logs" (
    "id" UUID NOT NULL,
    "request_id" VARCHAR(100),
    "user_id" UUID,
    "character_id" UUID,
    "surface" "public"."SafetySurface" NOT NULL,
    "decision" "public"."SafetyDecision" NOT NULL,
    "risk_level" "public"."SafetyRiskLevel" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "categories" JSONB,
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "classifier_version" VARCHAR(50),
    "reason" TEXT,
    "sanitized_content" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_evaluation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."safety_incidents" (
    "id" UUID NOT NULL,
    "severity" "public"."IncidentSeverity" NOT NULL,
    "category" "public"."IncidentCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "impact_summary" TEXT,
    "affected_components" JSONB,
    "actions_taken" TEXT,
    "lead_admin_id" UUID,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mitigated_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."safety_policy_versions" (
    "id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "safety_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scheduled_social_actions" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "character_id" UUID,
    "action_type" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "interval_hours" INTEGER NOT NULL,
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "last_run_at" TIMESTAMPTZ(6),
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "approval_policy" VARCHAR(30) NOT NULL DEFAULT 'CREATOR_APPROVAL',
    "budget_cents" INTEGER NOT NULL DEFAULT 100,
    "spent_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ScheduledSocialActionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scheduled_social_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."search_documents" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "tagline" VARCHAR(255) NOT NULL,
    "short_description" VARCHAR(300) NOT NULL,
    "long_description" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "language" VARCHAR(20) NOT NULL DEFAULT 'en',
    "supported_languages" JSONB NOT NULL DEFAULT '[]',
    "personality_descriptors" JSONB NOT NULL DEFAULT '[]',
    "communication_styles" JSONB NOT NULL DEFAULT '[]',
    "creator_id" UUID,
    "creator_username" VARCHAR(50),
    "search_text" TEXT NOT NULL,
    "embedding" JSONB,
    "embedding_model" VARCHAR(50),
    "embedding_version" VARCHAR(20),
    "index_version" INTEGER NOT NULL DEFAULT 1,
    "popularity_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "quality_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "trending_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "published_at" TIMESTAMPTZ(6),
    "indexed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."search_query_logs" (
    "id" UUID NOT NULL,
    "query" VARCHAR(255) NOT NULL,
    "normalized_query" VARCHAR(255) NOT NULL,
    "user_id" UUID,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_character_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."search_synonyms" (
    "id" UUID NOT NULL,
    "term" VARCHAR(100) NOT NULL,
    "synonyms" JSONB NOT NULL DEFAULT '[]',
    "language" VARCHAR(20) NOT NULL DEFAULT 'en',
    "category" VARCHAR(50),
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "token_family_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_action_logs" (
    "id" UUID NOT NULL,
    "actor_type" VARCHAR(20) NOT NULL,
    "actor_id" VARCHAR(100),
    "on_behalf_of_user_id" UUID,
    "character_id" UUID,
    "character_version_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(30),
    "target_id" VARCHAR(100),
    "decision" VARCHAR(30) NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "authorization" JSONB,
    "consent_ref" VARCHAR(100),
    "generation_id" VARCHAR(100),
    "tool_version" VARCHAR(30),
    "moderation_result" JSONB,
    "cost_cents" INTEGER,
    "request_id" VARCHAR(100),
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "status" VARCHAR(20),

    CONSTRAINT "social_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_appeals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "status" "public"."SocialAppealStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decision_notes" TEXT,
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_comments" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "author_type" "public"."SocialAuthorType" NOT NULL DEFAULT 'USER',
    "author_user_id" UUID,
    "character_id" UUID,
    "parent_id" UUID,
    "body" VARCHAR(2000) NOT NULL,
    "status" "public"."SocialCommentStatus" NOT NULL DEFAULT 'PENDING_MODERATION',
    "moderation_reasons" JSONB,
    "mentioned_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "edited_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "consent_type" VARCHAR(50) NOT NULL,
    "policy_version" VARCHAR(20) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" VARCHAR(30) NOT NULL DEFAULT 'SETTINGS',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_content_revisions" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(150),
    "body" TEXT,
    "snapshot" JSONB NOT NULL,
    "edited_by_user_id" UUID,
    "moderation_status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_contents" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "kind" "public"."SocialContentKind" NOT NULL,
    "author_type" "public"."SocialAuthorType" NOT NULL,
    "author_user_id" UUID,
    "character_id" UUID,
    "community_id" UUID,
    "source_type" VARCHAR(40),
    "source_ref" VARCHAR(100),
    "title" VARCHAR(150),
    "body" TEXT,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "visibility" "public"."SocialContentVisibility" NOT NULL DEFAULT 'UNLISTED',
    "status" "public"."SocialContentStatus" NOT NULL DEFAULT 'DRAFT',
    "moderation_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "moderation_reasons" JSONB,
    "redaction_report" JSONB,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "ai_provenance" JSONB,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "reaction_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_direct_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "client_message_id" VARCHAR(64) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "attachments" JSONB,
    "status" "public"."SocialDirectMessageStatus" NOT NULL DEFAULT 'SENT',
    "moderation_status" VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    "delivered_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_direct_participants" (
    "thread_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_read_at" TIMESTAMPTZ(6),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_direct_participants_pkey" PRIMARY KEY ("thread_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."social_direct_threads" (
    "id" UUID NOT NULL,
    "pair_key" VARCHAR(80) NOT NULL,
    "status" "public"."SocialDirectThreadStatus" NOT NULL DEFAULT 'REQUESTED',
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_direct_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_feed_feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "signal" VARCHAR(20) NOT NULL,
    "target_type" VARCHAR(20) NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_feed_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_message_requests" (
    "id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "pending_key" VARCHAR(80),
    "status" "public"."SocialMessageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_message_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_moderation_actions" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "community_id" UUID,
    "case_id" UUID,
    "actor_type" VARCHAR(20) NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_moderation_cases" (
    "id" UUID NOT NULL,
    "target_type" "public"."SocialReportTargetType" NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "open_key" VARCHAR(150),
    "subject_user_id" UUID,
    "queue" "public"."SocialModerationQueue" NOT NULL,
    "status" "public"."SocialCaseStatus" NOT NULL DEFAULT 'OPEN',
    "severity" VARCHAR(10) NOT NULL DEFAULT 'LOW',
    "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "unique_reporter_count" INTEGER NOT NULL DEFAULT 0,
    "reason_counts" JSONB NOT NULL DEFAULT '{}',
    "automated_signals" JSONB,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "decision" VARCHAR(40),
    "decision_notes" TEXT,
    "moderator_notes" TEXT,
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "first_reported_at" TIMESTAMPTZ(6),
    "last_reported_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_policy_versions" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "diff" JSONB,
    "change_reason" TEXT NOT NULL,
    "author_admin_id" UUID,
    "rolled_back_from" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_privacy_settings" (
    "user_id" UUID NOT NULL,
    "profile_visibility" "public"."SocialProfileVisibility" NOT NULL DEFAULT 'LIMITED',
    "follow_policy" "public"."SocialFollowPolicy" NOT NULL DEFAULT 'EVERYONE',
    "follow_list_audience" "public"."SocialAudience" NOT NULL DEFAULT 'NOBODY',
    "creations_audience" "public"."SocialAudience" NOT NULL DEFAULT 'EVERYONE',
    "shared_content_audience" "public"."SocialAudience" NOT NULL DEFAULT 'EVERYONE',
    "activity_audience" "public"."SocialAudience" NOT NULL DEFAULT 'NOBODY',
    "communities_audience" "public"."SocialAudience" NOT NULL DEFAULT 'NOBODY',
    "show_online_status" BOOLEAN NOT NULL DEFAULT false,
    "who_can_message" "public"."SocialAudience" NOT NULL DEFAULT 'MUTUALS',
    "who_can_mention" "public"."SocialAudience" NOT NULL DEFAULT 'FOLLOWERS',
    "who_can_comment" "public"."SocialAudience" NOT NULL DEFAULT 'EVERYONE',
    "who_can_invite_to_communities" "public"."SocialAudience" NOT NULL DEFAULT 'MUTUALS',
    "discoverable" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "social_recommendations" BOOLEAN NOT NULL DEFAULT true,
    "character_social_interactions" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_privacy_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."social_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "username" VARCHAR(30),
    "username_canonical" VARCHAR(30),
    "display_name" VARCHAR(60) NOT NULL,
    "bio" VARCHAR(300),
    "avatar_url" TEXT,
    "pronouns" VARCHAR(30),
    "profile_theme" VARCHAR(30),
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "username_changed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_reactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "reaction_type" "public"."SocialReactionType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_reports" (
    "id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "target_type" "public"."SocialReportTargetType" NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "reason_code" VARCHAR(40) NOT NULL,
    "details" VARCHAR(1000),
    "case_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_reserved_usernames" (
    "canonical" VARCHAR(30) NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_reserved_usernames_pkey" PRIMARY KEY ("canonical")
);

-- CreateTable
CREATE TABLE "public"."social_username_history" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(20) NOT NULL,
    "old_username" VARCHAR(30),
    "new_username" VARCHAR(30),
    "held_canonical" VARCHAR(30),
    "hold_until" TIMESTAMPTZ(6),
    "actor_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_username_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_meters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meter_unit" VARCHAR(50) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "limit_amount" INTEGER NOT NULL DEFAULT 0,
    "consumed_amount" INTEGER NOT NULL DEFAULT 0,
    "reserved_amount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_reservations" (
    "id" UUID NOT NULL,
    "usage_meter_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meter_unit" VARCHAR(50) NOT NULL,
    "reserved_amount" INTEGER NOT NULL,
    "consumed_amount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."UsageReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "idempotency_key" VARCHAR(100),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "settled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usage_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_blocks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "blocked_user_id" UUID,
    "blocked_character_id" UUID,
    "blocked_creator_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_character_signals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "starts_count" INTEGER NOT NULL DEFAULT 0,
    "messages_count" INTEGER NOT NULL DEFAULT 0,
    "favorites_count" INTEGER NOT NULL DEFAULT 0,
    "dismissals_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMPTZ(6),
    "last_started_at" TIMESTAMPTZ(6),
    "last_interacted_at" TIMESTAMPTZ(6),
    "last_dismissed_at" TIMESTAMPTZ(6),
    "engagement_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_character_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "user_id" UUID NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "characters_used" INTEGER NOT NULL DEFAULT 0,
    "voice_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "media_usage" INTEGER NOT NULL DEFAULT 0,
    "purchases_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ai_cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(150) NOT NULL,
    "push_token" VARCHAR(500),
    "platform" VARCHAR(20) NOT NULL,
    "app_version" VARCHAR(50),
    "push_permission_status" VARCHAR(30) NOT NULL DEFAULT 'NOT_DETERMINED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_discovery_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preferred_languages" JSONB NOT NULL DEFAULT '["en"]',
    "preferred_category_ids" JSONB NOT NULL DEFAULT '[]',
    "preferred_tag_ids" JSONB NOT NULL DEFAULT '[]',
    "preferred_styles" JSONB NOT NULL DEFAULT '[]',
    "personalization_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allow_nsfw" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_discovery_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entitlement_key" VARCHAR(100) NOT NULL,
    "source" "public"."EntitlementSource" NOT NULL DEFAULT 'SUBSCRIPTION',
    "source_id" VARCHAR(100),
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_first_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "selected_character_id" UUID,
    "first_conversation_id" UUID,
    "first_message_sent_at" TIMESTAMPTZ(6),
    "first_response_received_at" TIMESTAMPTZ(6),
    "is_activated" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMPTZ(6),
    "first_return_at" TIMESTAMPTZ(6),
    "return_count" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_first_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_follows" (
    "id" UUID NOT NULL,
    "follower_user_id" UUID NOT NULL,
    "followed_user_id" UUID NOT NULL,
    "status" "public"."SocialFollowStatus" NOT NULL DEFAULT 'ACTIVE',
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_memory_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "personalization_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allow_sensitive_memory" BOOLEAN NOT NULL DEFAULT false,
    "allow_global_memory" BOOLEAN NOT NULL DEFAULT true,
    "retention_days" INTEGER NOT NULL DEFAULT 365,
    "excluded_character_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_memory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_mutes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_type" "public"."SocialMuteTargetType" NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "scope" "public"."SocialMuteScope" NOT NULL DEFAULT 'ALL',
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_negative_signals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "signal_type" VARCHAR(30) NOT NULL,
    "character_id" UUID,
    "creator_profile_id" UUID,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_negative_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_notification_preferences" (
    "user_id" UUID NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "proactivity_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" VARCHAR(10) NOT NULL DEFAULT '22:30',
    "quiet_hours_end" VARCHAR(10) NOT NULL DEFAULT '08:00',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "max_daily_notifications" INTEGER NOT NULL DEFAULT 3,
    "max_weekly_notifications" INTEGER NOT NULL DEFAULT 14,
    "show_preview" BOOLEAN NOT NULL DEFAULT true,
    "character_message_category_enabled" BOOLEAN NOT NULL DEFAULT true,
    "user_reminder_category_enabled" BOOLEAN NOT NULL DEFAULT true,
    "marketing_category_enabled" BOOLEAN NOT NULL DEFAULT false,
    "character_overrides" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "billing_category_enabled" BOOLEAN NOT NULL DEFAULT true,
    "lock_screen_privacy" VARCHAR(30) NOT NULL DEFAULT 'FULL_PREVIEW',
    "muted_character_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "product_updates_category_enabled" BOOLEAN NOT NULL DEFAULT true,
    "recommendations_category_enabled" BOOLEAN NOT NULL DEFAULT true,
    "security_category_enabled" BOOLEAN NOT NULL DEFAULT true,
    "system_category_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."user_privacy_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "memory_storage_enabled" BOOLEAN NOT NULL DEFAULT true,
    "personalization_enabled" BOOLEAN NOT NULL DEFAULT true,
    "analytics_consent" BOOLEAN NOT NULL DEFAULT true,
    "ai_training_consent" BOOLEAN NOT NULL DEFAULT false,
    "data_retention_days" INTEGER NOT NULL DEFAULT 365,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50),
    "avatar_url" TEXT,
    "bio" VARCHAR(500),
    "date_of_birth" DATE,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "preferred_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "is_nsfw_allowed" BOOLEAN NOT NULL DEFAULT false,
    "audio_auto_play" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "conversation_style" VARCHAR(30) NOT NULL DEFAULT 'CASUAL',
    "onboarding_completed_at" TIMESTAMPTZ(6),
    "onboarding_completed_steps" JSONB NOT NULL DEFAULT '[]',
    "onboarding_current_step" VARCHAR(50) NOT NULL DEFAULT 'WELCOME',
    "onboarding_started_at" TIMESTAMPTZ(6),
    "onboarding_status" VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    "onboarding_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_relationship_settings" (
    "user_id" UUID NOT NULL,
    "personalization_enabled" BOOLEAN NOT NULL DEFAULT true,
    "relationship_progression_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_relationship_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."user_reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL,
    "target_time" TIMESTAMPTZ(6) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "proactive_action_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_restrictions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "restriction_type" "public"."AccountRestrictionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "issued_by_admin_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_search_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query" VARCHAR(255) NOT NULL,
    "normalized_query" VARCHAR(255) NOT NULL,
    "category_filter" VARCHAR(50),
    "last_searched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_search_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_voice_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "voice_enabled" BOOLEAN NOT NULL DEFAULT true,
    "preferred_mode" VARCHAR(30) NOT NULL DEFAULT 'hands_free',
    "speech_speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "preferred_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "subtitles_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_play_audio" BOOLEAN NOT NULL DEFAULT true,
    "noise_suppression" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_voice_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "normalized_email" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(50),
    "normalized_phone_number" VARCHAR(50),
    "password_hash" VARCHAR(255),
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "last_active_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voice_session_turns" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "turn_index" INTEGER NOT NULL,
    "user_transcript" TEXT NOT NULL,
    "user_speech_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "stt_latency_ms" INTEGER NOT NULL DEFAULT 0,
    "stt_confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ai_response_text" TEXT NOT NULL DEFAULT '',
    "llm_first_token_ms" INTEGER NOT NULL DEFAULT 0,
    "llm_total_ms" INTEGER NOT NULL DEFAULT 0,
    "tts_first_audio_ms" INTEGER NOT NULL DEFAULT 0,
    "tts_total_ms" INTEGER NOT NULL DEFAULT 0,
    "total_turn_latency_ms" INTEGER NOT NULL DEFAULT 0,
    "interrupted" BOOLEAN NOT NULL DEFAULT false,
    "interrupted_at_ms" INTEGER,
    "stt_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "llm_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "tts_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_session_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voice_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "character_version_id" UUID,
    "conversation_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'created',
    "voice_mode" VARCHAR(30) NOT NULL DEFAULT 'hands_free',
    "transport" VARCHAR(30) NOT NULL DEFAULT 'websocket',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "voice_id" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "total_duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "user_speaking_seconds" INTEGER NOT NULL DEFAULT 0,
    "ai_speaking_seconds" INTEGER NOT NULL DEFAULT 0,
    "turns_count" INTEGER NOT NULL DEFAULT 0,
    "interruption_count" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "metadata" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_deletion_requests_status_scheduled_for_idx" ON "public"."account_deletion_requests"("status" ASC, "scheduled_for" ASC);

-- CreateIndex
CREATE INDEX "account_deletion_requests_user_id_status_idx" ON "public"."account_deletion_requests"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "activation_funnel_logs_character_id_event_type_idx" ON "public"."activation_funnel_logs"("character_id" ASC, "event_type" ASC);

-- CreateIndex
CREATE INDEX "activation_funnel_logs_event_type_created_at_idx" ON "public"."activation_funnel_logs"("event_type" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "activation_funnel_logs_user_id_event_type_idx" ON "public"."activation_funnel_logs"("user_id" ASC, "event_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_name_key" ON "public"."admin_permissions"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_role_assignments_admin_id_role_id_key" ON "public"."admin_role_assignments"("admin_id" ASC, "role_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_role_permissions_role_id_permission_id_key" ON "public"."admin_role_permissions"("role_id" ASC, "permission_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_name_key" ON "public"."admin_roles"("name" ASC);

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_revoked_at_idx" ON "public"."admin_sessions"("admin_id" ASC, "revoked_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_session_token_hash_key" ON "public"."admin_sessions"("session_token_hash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "public"."admin_users"("email" ASC);

-- CreateIndex
CREATE INDEX "admin_users_is_active_idx" ON "public"."admin_users"("is_active" ASC);

-- CreateIndex
CREATE INDEX "admin_users_normalized_email_idx" ON "public"."admin_users"("normalized_email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_normalized_email_key" ON "public"."admin_users"("normalized_email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_evaluation_datasets_slug_key" ON "public"."ai_evaluation_datasets"("slug" ASC);

-- CreateIndex
CREATE INDEX "ai_evaluation_results_run_id_passed_idx" ON "public"."ai_evaluation_results"("run_id" ASC, "passed" ASC);

-- CreateIndex
CREATE INDEX "ai_evaluation_runs_dataset_id_status_idx" ON "public"."ai_evaluation_runs"("dataset_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ai_evaluation_runs_model_id_status_idx" ON "public"."ai_evaluation_runs"("model_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ai_evaluation_runs_started_at_idx" ON "public"."ai_evaluation_runs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "ai_evaluation_test_cases_dataset_id_category_idx" ON "public"."ai_evaluation_test_cases"("dataset_id" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "ai_generation_traces_character_id_created_at_idx" ON "public"."ai_generation_traces"("character_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_generation_traces_request_id_idx" ON "public"."ai_generation_traces"("request_id" ASC);

-- CreateIndex
CREATE INDEX "ai_generation_traces_status_error_code_idx" ON "public"."ai_generation_traces"("status" ASC, "error_code" ASC);

-- CreateIndex
CREATE INDEX "ai_generation_traces_user_id_created_at_idx" ON "public"."ai_generation_traces"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_generation_traces_workload_created_at_idx" ON "public"."ai_generation_traces"("workload" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_pricing_provider_model_effective_from_key" ON "public"."ai_model_pricing"("provider" ASC, "model" ASC, "effective_from" ASC);

-- CreateIndex
CREATE INDEX "ai_model_pricing_provider_model_idx" ON "public"."ai_model_pricing"("provider" ASC, "model" ASC);

-- CreateIndex
CREATE INDEX "ai_models_is_enabled_is_default_idx" ON "public"."ai_models"("is_enabled" ASC, "is_default" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_provider_model_name_key" ON "public"."ai_models"("provider" ASC, "model_name" ASC);

-- CreateIndex
CREATE INDEX "ai_prompt_experiments_prompt_id_is_active_idx" ON "public"."ai_prompt_experiments"("prompt_id" ASC, "is_active" ASC);

-- CreateIndex
CREATE INDEX "ai_prompt_versions_prompt_id_status_idx" ON "public"."ai_prompt_versions"("prompt_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_prompt_id_version_number_key" ON "public"."ai_prompt_versions"("prompt_id" ASC, "version_number" ASC);

-- CreateIndex
CREATE INDEX "ai_prompts_category_idx" ON "public"."ai_prompts"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompts_slug_key" ON "public"."ai_prompts"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_health_provider_key" ON "public"."ai_provider_health"("provider" ASC);

-- CreateIndex
CREATE INDEX "ai_routing_policies_workload_is_enabled_idx" ON "public"."ai_routing_policies"("workload" ASC, "is_enabled" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_routing_policies_workload_key" ON "public"."ai_routing_policies"("workload" ASC);

-- CreateIndex
CREATE INDEX "ai_usage_events_character_id_created_at_idx" ON "public"."ai_usage_events"("character_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_events_created_at_idx" ON "public"."ai_usage_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_events_model_created_at_idx" ON "public"."ai_usage_events"("model" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_events_task_created_at_idx" ON "public"."ai_usage_events"("task" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_events_user_id_created_at_idx" ON "public"."ai_usage_events"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_alerts_category_idx" ON "public"."analytics_alerts"("category" ASC);

-- CreateIndex
CREATE INDEX "analytics_alerts_status_severity_idx" ON "public"."analytics_alerts"("status" ASC, "severity" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_character_id_timestamp_idx" ON "public"."analytics_events"("character_id" ASC, "timestamp" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_event_name_timestamp_idx" ON "public"."analytics_events"("event_name" ASC, "timestamp" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_experiment_id_experiment_variant_idx" ON "public"."analytics_events"("experiment_id" ASC, "experiment_variant" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "public"."analytics_events"("session_id" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_user_id_timestamp_idx" ON "public"."analytics_events"("user_id" ASC, "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "public"."audit_logs"("action" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_type_actor_id_idx" ON "public"."audit_logs"("actor_type" ASC, "actor_id" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "public"."audit_logs"("resource_type" ASC, "resource_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_subject_key" ON "public"."auth_identities"("provider" ASC, "provider_subject" ASC);

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "public"."auth_identities"("user_id" ASC);

-- CreateIndex
CREATE INDEX "billing_audit_logs_action_created_at_idx" ON "public"."billing_audit_logs"("action" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "billing_audit_logs_target_type_target_id_idx" ON "public"."billing_audit_logs"("target_type" ASC, "target_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_invoice_number_key" ON "public"."billing_invoices"("invoice_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_plans_code_key" ON "public"."billing_plans"("code" ASC);

-- CreateIndex
CREATE INDEX "billing_plans_is_active_idx" ON "public"."billing_plans"("is_active" ASC);

-- CreateIndex
CREATE INDEX "billing_prices_product_id_plan_id_idx" ON "public"."billing_prices"("product_id" ASC, "plan_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_prices_provider_provider_price_id_key" ON "public"."billing_prices"("provider" ASC, "provider_price_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_products_slug_key" ON "public"."billing_products"("slug" ASC);

-- CreateIndex
CREATE INDEX "billing_promotions_code_is_active_idx" ON "public"."billing_promotions"("code" ASC, "is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_promotions_code_key" ON "public"."billing_promotions"("code" ASC);

-- CreateIndex
CREATE INDEX "billing_reconciliations_status_created_at_idx" ON "public"."billing_reconciliations"("status" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "billing_reconciliations_user_id_idx" ON "public"."billing_reconciliations"("user_id" ASC);

-- CreateIndex
CREATE INDEX "billing_subscriptions_provider_status_idx" ON "public"."billing_subscriptions"("provider" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_provider_subscription_id_key" ON "public"."billing_subscriptions"("provider_subscription_id" ASC);

-- CreateIndex
CREATE INDEX "billing_subscriptions_user_id_status_idx" ON "public"."billing_subscriptions"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_events_provider_provider_event_id_key" ON "public"."billing_webhook_events"("provider" ASC, "provider_event_id" ASC);

-- CreateIndex
CREATE INDEX "billing_webhook_events_status_retry_count_idx" ON "public"."billing_webhook_events"("status" ASC, "retry_count" ASC);

-- CreateIndex
CREATE INDEX "character_categories_is_active_display_order_idx" ON "public"."character_categories"("is_active" ASC, "display_order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_categories_slug_key" ON "public"."character_categories"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_daily_metrics_character_id_date_key" ON "public"."character_daily_metrics"("character_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "character_daily_metrics_date_idx" ON "public"."character_daily_metrics"("date" DESC);

-- CreateIndex
CREATE INDEX "character_discovery_configs_category_id_idx" ON "public"."character_discovery_configs"("category_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_discovery_configs_character_id_key" ON "public"."character_discovery_configs"("character_id" ASC);

-- CreateIndex
CREATE INDEX "character_discovery_configs_is_discoverable_editorial_prior_idx" ON "public"."character_discovery_configs"("is_discoverable" ASC, "editorial_priority" DESC);

-- CreateIndex
CREATE INDEX "character_follows_character_id_created_at_idx" ON "public"."character_follows"("character_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "character_follows_user_id_character_id_key" ON "public"."character_follows"("user_id" ASC, "character_id" ASC);

-- CreateIndex
CREATE INDEX "character_follows_user_id_created_at_idx" ON "public"."character_follows"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "character_knowledge_character_id_topic_idx" ON "public"."character_knowledge"("character_id" ASC, "topic" ASC);

-- CreateIndex
CREATE INDEX "character_reports_character_id_status_idx" ON "public"."character_reports"("character_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "character_reports_reporter_user_id_idx" ON "public"."character_reports"("reporter_user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_similarities_character_id_similar_character_id_key" ON "public"."character_similarities"("character_id" ASC, "similar_character_id" ASC);

-- CreateIndex
CREATE INDEX "character_similarities_character_id_similarity_score_idx" ON "public"."character_similarities"("character_id" ASC, "similarity_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "character_tag_links_character_id_tag_id_key" ON "public"."character_tag_links"("character_id" ASC, "tag_id" ASC);

-- CreateIndex
CREATE INDEX "character_tag_links_tag_id_idx" ON "public"."character_tag_links"("tag_id" ASC);

-- CreateIndex
CREATE INDEX "character_tags_category_id_idx" ON "public"."character_tags"("category_id" ASC);

-- CreateIndex
CREATE INDEX "character_tags_is_curated_display_order_idx" ON "public"."character_tags"("is_curated" ASC, "display_order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_tags_slug_key" ON "public"."character_tags"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_traits_character_id_trait_key_key" ON "public"."character_traits"("character_id" ASC, "trait_key" ASC);

-- CreateIndex
CREATE INDEX "character_versions_character_id_status_idx" ON "public"."character_versions"("character_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_versions_character_id_version_number_key" ON "public"."character_versions"("character_id" ASC, "version_number" ASC);

-- CreateIndex
CREATE INDEX "characters_category_id_idx" ON "public"."characters"("category_id" ASC);

-- CreateIndex
CREATE INDEX "characters_category_idx" ON "public"."characters"("category" ASC);

-- CreateIndex
CREATE INDEX "characters_created_by_id_idx" ON "public"."characters"("created_by_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "characters_internal_key_key" ON "public"."characters"("internal_key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "characters_slug_key" ON "public"."characters"("slug" ASC);

-- CreateIndex
CREATE INDEX "characters_status_visibility_idx" ON "public"."characters"("status" ASC, "visibility" ASC);

-- CreateIndex
CREATE INDEX "collection_items_character_id_idx" ON "public"."collection_items"("character_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collection_id_character_id_key" ON "public"."collection_items"("collection_id" ASC, "character_id" ASC);

-- CreateIndex
CREATE INDEX "collection_items_collection_id_display_order_idx" ON "public"."collection_items"("collection_id" ASC, "display_order" ASC);

-- CreateIndex
CREATE INDEX "communities_owner_user_id_idx" ON "public"."communities"("owner_user_id" ASC);

-- CreateIndex
CREATE INDEX "communities_privacy_status_member_count_idx" ON "public"."communities"("privacy" ASC, "status" ASC, "member_count" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "public"."communities"("slug" ASC);

-- CreateIndex
CREATE INDEX "community_members_community_id_status_role_idx" ON "public"."community_members"("community_id" ASC, "status" ASC, "role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "community_members_community_id_user_id_key" ON "public"."community_members"("community_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "community_members_user_id_status_idx" ON "public"."community_members"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "conversation_summaries_conversation_id_end_sequence_number_idx" ON "public"."conversation_summaries"("conversation_id" ASC, "end_sequence_number" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_user_id_character_id_key" ON "public"."conversations"("user_id" ASC, "character_id" ASC);

-- CreateIndex
CREATE INDEX "conversations_user_id_status_last_message_at_idx" ON "public"."conversations"("user_id" ASC, "status" ASC, "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "creator_daily_metrics_creator_profile_id_date_key" ON "public"."creator_daily_metrics"("creator_profile_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "creator_daily_metrics_date_idx" ON "public"."creator_daily_metrics"("date" DESC);

-- CreateIndex
CREATE INDEX "creator_earnings_ledger_character_id_idx" ON "public"."creator_earnings_ledger"("character_id" ASC);

-- CreateIndex
CREATE INDEX "creator_earnings_ledger_creator_profile_id_created_at_idx" ON "public"."creator_earnings_ledger"("creator_profile_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "creator_follows_creator_profile_id_idx" ON "public"."creator_follows"("creator_profile_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "creator_follows_user_id_creator_profile_id_key" ON "public"."creator_follows"("user_id" ASC, "creator_profile_id" ASC);

-- CreateIndex
CREATE INDEX "creator_products_creator_profile_id_character_id_idx" ON "public"."creator_products"("creator_profile_id" ASC, "character_id" ASC);

-- CreateIndex
CREATE INDEX "creator_profiles_status_verification_status_idx" ON "public"."creator_profiles"("status" ASC, "verification_status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_user_id_key" ON "public"."creator_profiles"("user_id" ASC);

-- CreateIndex
CREATE INDEX "creator_profiles_username_idx" ON "public"."creator_profiles"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_username_key" ON "public"."creator_profiles"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_idempotency_key_key" ON "public"."credit_transactions"("idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_type_idx" ON "public"."credit_transactions"("user_id" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "credit_transactions_wallet_id_created_at_idx" ON "public"."credit_transactions"("wallet_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_user_id_key" ON "public"."credit_wallets"("user_id" ASC);

-- CreateIndex
CREATE INDEX "curated_collections_is_published_display_order_idx" ON "public"."curated_collections"("is_published" ASC, "display_order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "curated_collections_slug_key" ON "public"."curated_collections"("slug" ASC);

-- CreateIndex
CREATE INDEX "data_export_requests_user_id_status_idx" ON "public"."data_export_requests"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "public"."devices"("user_id" ASC);

-- CreateIndex
CREATE INDEX "discovery_event_logs_character_id_event_type_idx" ON "public"."discovery_event_logs"("character_id" ASC, "event_type" ASC);

-- CreateIndex
CREATE INDEX "discovery_event_logs_event_type_created_at_idx" ON "public"."discovery_event_logs"("event_type" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "discovery_event_logs_user_id_idx" ON "public"."discovery_event_logs"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "public"."email_verification_tokens"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "public"."email_verification_tokens"("user_id" ASC);

-- CreateIndex
CREATE INDEX "emergency_kill_switches_switch_type_is_active_idx" ON "public"."emergency_kill_switches"("switch_type" ASC, "is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "experiment_assignments_experiment_id_subject_id_key" ON "public"."experiment_assignments"("experiment_id" ASC, "subject_id" ASC);

-- CreateIndex
CREATE INDEX "experiment_assignments_subject_id_idx" ON "public"."experiment_assignments"("subject_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "experiment_exposures_experiment_id_subject_id_key" ON "public"."experiment_exposures"("experiment_id" ASC, "subject_id" ASC);

-- CreateIndex
CREATE INDEX "experiment_exposures_subject_id_idx" ON "public"."experiment_exposures"("subject_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "experiment_variants_experiment_id_key_key" ON "public"."experiment_variants"("experiment_id" ASC, "key" ASC);

-- CreateIndex
CREATE INDEX "experiments_status_idx" ON "public"."experiments"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "public"."feature_flags"("key" ASC);

-- CreateIndex
CREATE INDEX "home_section_configs_is_enabled_display_order_idx" ON "public"."home_section_configs"("is_enabled" ASC, "display_order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "home_section_configs_section_key_key" ON "public"."home_section_configs"("section_key" ASC);

-- CreateIndex
CREATE INDEX "in_app_notifications_user_id_category_idx" ON "public"."in_app_notifications"("user_id" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "in_app_notifications_user_id_is_read_created_at_idx" ON "public"."in_app_notifications"("user_id" ASC, "is_read" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "memories_user_id_category_idx" ON "public"."memories"("user_id" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "memories_user_id_character_id_scope_status_idx" ON "public"."memories"("user_id" ASC, "character_id" ASC, "scope" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "memories_user_id_status_deleted_at_idx" ON "public"."memories"("user_id" ASC, "status" ASC, "deleted_at" ASC);

-- CreateIndex
CREATE INDEX "memory_access_logs_user_id_created_at_idx" ON "public"."memory_access_logs"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "memory_embeddings_memory_id_idx" ON "public"."memory_embeddings"("memory_id" ASC);

-- CreateIndex
CREATE INDEX "message_feedback_message_id_idx" ON "public"."message_feedback"("message_id" ASC);

-- CreateIndex
CREATE INDEX "message_feedback_user_id_idx" ON "public"."message_feedback"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "message_generation_metadata_message_id_key" ON "public"."message_generation_metadata"("message_id" ASC);

-- CreateIndex
CREATE INDEX "message_parts_message_id_order_index_idx" ON "public"."message_parts"("message_id" ASC, "order_index" ASC);

-- CreateIndex
CREATE INDEX "messages_client_request_id_idx" ON "public"."messages"("client_request_id" ASC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "public"."messages"("conversation_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_sequence_number_idx" ON "public"."messages"("conversation_id" ASC, "sequence_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "messages_idempotency_key_key" ON "public"."messages"("idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "moderation_appeals_character_id_idx" ON "public"."moderation_appeals"("character_id" ASC);

-- CreateIndex
CREATE INDEX "moderation_appeals_moderation_case_id_idx" ON "public"."moderation_appeals"("moderation_case_id" ASC);

-- CreateIndex
CREATE INDEX "moderation_appeals_status_idx" ON "public"."moderation_appeals"("status" ASC);

-- CreateIndex
CREATE INDEX "moderation_cases_character_id_idx" ON "public"."moderation_cases"("character_id" ASC);

-- CreateIndex
CREATE INDEX "moderation_cases_creator_profile_id_idx" ON "public"."moderation_cases"("creator_profile_id" ASC);

-- CreateIndex
CREATE INDEX "moderation_cases_status_risk_score_idx" ON "public"."moderation_cases"("status" ASC, "risk_score" DESC);

-- CreateIndex
CREATE INDEX "notification_campaigns_status_scheduled_for_idx" ON "public"."notification_campaigns"("status" ASC, "scheduled_for" ASC);

-- CreateIndex
CREATE INDEX "notification_delivery_logs_category_status_idx" ON "public"."notification_delivery_logs"("category" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_logs_idempotency_key_key" ON "public"."notification_delivery_logs"("idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "notification_delivery_logs_user_id_status_created_at_idx" ON "public"."notification_delivery_logs"("user_id" ASC, "status" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "onboarding_step_configs_is_enabled_display_order_idx" ON "public"."onboarding_step_configs"("is_enabled" ASC, "display_order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_step_configs_step_key_key" ON "public"."onboarding_step_configs"("step_key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "public"."password_reset_tokens"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "public"."password_reset_tokens"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "plan_entitlements_plan_id_entitlement_key_key" ON "public"."plan_entitlements"("plan_id" ASC, "entitlement_key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "plan_usage_limits_plan_id_meter_unit_key" ON "public"."plan_usage_limits"("plan_id" ASC, "meter_unit" ASC);

-- CreateIndex
CREATE INDEX "proactive_actions_character_id_status_idx" ON "public"."proactive_actions"("character_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "proactive_actions_status_expires_at_idx" ON "public"."proactive_actions"("status" ASC, "expires_at" ASC);

-- CreateIndex
CREATE INDEX "proactive_actions_status_scheduled_for_idx" ON "public"."proactive_actions"("status" ASC, "scheduled_for" ASC);

-- CreateIndex
CREATE INDEX "proactive_actions_user_id_status_created_at_idx" ON "public"."proactive_actions"("user_id" ASC, "status" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "proactive_decision_logs_character_id_created_at_idx" ON "public"."proactive_decision_logs"("character_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "proactive_decision_logs_decision_reason_code_idx" ON "public"."proactive_decision_logs"("decision" ASC, "reason_code" ASC);

-- CreateIndex
CREATE INDEX "proactive_decision_logs_user_id_created_at_idx" ON "public"."proactive_decision_logs"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "product_daily_metrics_date_key" ON "public"."product_daily_metrics"("date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "promo_redemptions_promotion_id_user_id_id_key" ON "public"."promo_redemptions"("promotion_id" ASC, "user_id" ASC, "id" ASC);

-- CreateIndex
CREATE INDEX "promo_redemptions_user_id_promotion_id_idx" ON "public"."promo_redemptions"("user_id" ASC, "promotion_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_transactions_idempotency_key_key" ON "public"."purchase_transactions"("idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "purchase_transactions_provider_status_idx" ON "public"."purchase_transactions"("provider" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_transactions_provider_transaction_id_key" ON "public"."purchase_transactions"("provider_transaction_id" ASC);

-- CreateIndex
CREATE INDEX "purchase_transactions_user_id_status_idx" ON "public"."purchase_transactions"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ranking_configs_status_is_default_idx" ON "public"."ranking_configs"("status" ASC, "is_default" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ranking_configs_version_key" ON "public"."ranking_configs"("version" ASC);

-- CreateIndex
CREATE INDEX "relationship_events_event_type_idx" ON "public"."relationship_events"("event_type" ASC);

-- CreateIndex
CREATE INDEX "relationship_events_relationship_id_created_at_idx" ON "public"."relationship_events"("relationship_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "relationship_milestones_relationship_id_achieved_at_idx" ON "public"."relationship_milestones"("relationship_id" ASC, "achieved_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "relationship_milestones_relationship_id_milestone_type_key" ON "public"."relationship_milestones"("relationship_id" ASC, "milestone_type" ASC);

-- CreateIndex
CREATE INDEX "relationship_state_history_relationship_id_created_at_idx" ON "public"."relationship_state_history"("relationship_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "relationships_character_id_stage_idx" ON "public"."relationships"("character_id" ASC, "stage" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "relationships_user_id_character_id_key" ON "public"."relationships"("user_id" ASC, "character_id" ASC);

-- CreateIndex
CREATE INDEX "relationships_user_id_stage_idx" ON "public"."relationships"("user_id" ASC, "stage" ASC);

-- CreateIndex
CREATE INDEX "safety_evaluation_logs_character_id_idx" ON "public"."safety_evaluation_logs"("character_id" ASC);

-- CreateIndex
CREATE INDEX "safety_evaluation_logs_surface_decision_risk_level_idx" ON "public"."safety_evaluation_logs"("surface" ASC, "decision" ASC, "risk_level" ASC);

-- CreateIndex
CREATE INDEX "safety_evaluation_logs_user_id_created_at_idx" ON "public"."safety_evaluation_logs"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "safety_incidents_category_idx" ON "public"."safety_incidents"("category" ASC);

-- CreateIndex
CREATE INDEX "safety_incidents_severity_status_idx" ON "public"."safety_incidents"("severity" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "safety_policy_versions_is_active_version_number_idx" ON "public"."safety_policy_versions"("is_active" ASC, "version_number" DESC);

-- CreateIndex
CREATE INDEX "scheduled_social_actions_owner_user_id_idx" ON "public"."scheduled_social_actions"("owner_user_id" ASC);

-- CreateIndex
CREATE INDEX "scheduled_social_actions_status_next_run_at_idx" ON "public"."scheduled_social_actions"("status" ASC, "next_run_at" ASC);

-- CreateIndex
CREATE INDEX "search_documents_category_popularity_score_idx" ON "public"."search_documents"("category" ASC, "popularity_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_character_id_key" ON "public"."search_documents"("character_id" ASC);

-- CreateIndex
CREATE INDEX "search_documents_language_idx" ON "public"."search_documents"("language" ASC);

-- CreateIndex
CREATE INDEX "search_documents_name_idx" ON "public"."search_documents"("name" ASC);

-- CreateIndex
CREATE INDEX "search_documents_trending_score_idx" ON "public"."search_documents"("trending_score" DESC);

-- CreateIndex
CREATE INDEX "search_query_logs_normalized_query_created_at_idx" ON "public"."search_query_logs"("normalized_query" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "search_query_logs_user_id_idx" ON "public"."search_query_logs"("user_id" ASC);

-- CreateIndex
CREATE INDEX "search_synonyms_term_language_is_active_idx" ON "public"."search_synonyms"("term" ASC, "language" ASC, "is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "search_synonyms_term_language_key" ON "public"."search_synonyms"("term" ASC, "language" ASC);

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "public"."sessions"("refresh_token_hash" ASC);

-- CreateIndex
CREATE INDEX "sessions_token_family_id_idx" ON "public"."sessions"("token_family_id" ASC);

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "public"."sessions"("user_id" ASC, "revoked_at" ASC);

-- CreateIndex
CREATE INDEX "social_action_logs_action_created_at_idx" ON "public"."social_action_logs"("action" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_action_logs_actor_type_actor_id_created_at_idx" ON "public"."social_action_logs"("actor_type" ASC, "actor_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_action_logs_character_id_action_created_at_idx" ON "public"."social_action_logs"("character_id" ASC, "action" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_action_logs_character_id_status_idx" ON "public"."social_action_logs"("character_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_action_logs_idempotency_key_key" ON "public"."social_action_logs"("idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "social_appeals_status_created_at_idx" ON "public"."social_appeals"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_appeals_user_id_case_id_key" ON "public"."social_appeals"("user_id" ASC, "case_id" ASC);

-- CreateIndex
CREATE INDEX "social_comments_author_user_id_created_at_idx" ON "public"."social_comments"("author_user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_comments_content_id_parent_id_created_at_idx" ON "public"."social_comments"("content_id" ASC, "parent_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "social_consents_user_id_consent_type_created_at_idx" ON "public"."social_consents"("user_id" ASC, "consent_type" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "social_content_revisions_content_id_version_key" ON "public"."social_content_revisions"("content_id" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "social_contents_author_user_id_created_at_idx" ON "public"."social_contents"("author_user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_contents_character_id_status_published_at_idx" ON "public"."social_contents"("character_id" ASC, "status" ASC, "published_at" DESC);

-- CreateIndex
CREATE INDEX "social_contents_community_id_status_published_at_idx" ON "public"."social_contents"("community_id" ASC, "status" ASC, "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "social_contents_public_id_key" ON "public"."social_contents"("public_id" ASC);

-- CreateIndex
CREATE INDEX "social_contents_source_type_source_ref_idx" ON "public"."social_contents"("source_type" ASC, "source_ref" ASC);

-- CreateIndex
CREATE INDEX "social_contents_status_published_at_idx" ON "public"."social_contents"("status" ASC, "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "social_direct_messages_sender_user_id_client_message_id_key" ON "public"."social_direct_messages"("sender_user_id" ASC, "client_message_id" ASC);

-- CreateIndex
CREATE INDEX "social_direct_messages_thread_id_created_at_idx" ON "public"."social_direct_messages"("thread_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_direct_participants_user_id_idx" ON "public"."social_direct_participants"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_direct_threads_pair_key_key" ON "public"."social_direct_threads"("pair_key" ASC);

-- CreateIndex
CREATE INDEX "social_feed_feedback_user_id_created_at_idx" ON "public"."social_feed_feedback"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "social_feed_feedback_user_id_target_type_target_id_signal_key" ON "public"."social_feed_feedback"("user_id" ASC, "target_type" ASC, "target_id" ASC, "signal" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_message_requests_pending_key_key" ON "public"."social_message_requests"("pending_key" ASC);

-- CreateIndex
CREATE INDEX "social_message_requests_recipient_user_id_status_created_at_idx" ON "public"."social_message_requests"("recipient_user_id" ASC, "status" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_message_requests_sender_user_id_created_at_idx" ON "public"."social_message_requests"("sender_user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_moderation_actions_case_id_idx" ON "public"."social_moderation_actions"("case_id" ASC);

-- CreateIndex
CREATE INDEX "social_moderation_actions_community_id_created_at_idx" ON "public"."social_moderation_actions"("community_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "social_moderation_actions_target_type_target_id_idx" ON "public"."social_moderation_actions"("target_type" ASC, "target_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_moderation_cases_open_key_key" ON "public"."social_moderation_cases"("open_key" ASC);

-- CreateIndex
CREATE INDEX "social_moderation_cases_queue_status_priority_score_idx" ON "public"."social_moderation_cases"("queue" ASC, "status" ASC, "priority_score" DESC);

-- CreateIndex
CREATE INDEX "social_moderation_cases_subject_user_id_idx" ON "public"."social_moderation_cases"("subject_user_id" ASC);

-- CreateIndex
CREATE INDEX "social_moderation_cases_target_type_target_id_idx" ON "public"."social_moderation_cases"("target_type" ASC, "target_id" ASC);

-- CreateIndex
CREATE INDEX "social_policy_versions_is_active_idx" ON "public"."social_policy_versions"("is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_policy_versions_version_key" ON "public"."social_policy_versions"("version" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_public_id_key" ON "public"."social_profiles"("public_id" ASC);

-- CreateIndex
CREATE INDEX "social_profiles_status_idx" ON "public"."social_profiles"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_user_id_key" ON "public"."social_profiles"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_username_canonical_key" ON "public"."social_profiles"("username_canonical" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_username_key" ON "public"."social_profiles"("username" ASC);

-- CreateIndex
CREATE INDEX "social_reactions_content_id_reaction_type_idx" ON "public"."social_reactions"("content_id" ASC, "reaction_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_reactions_user_id_content_id_reaction_type_key" ON "public"."social_reactions"("user_id" ASC, "content_id" ASC, "reaction_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "social_reports_reporter_user_id_target_type_target_id_key" ON "public"."social_reports"("reporter_user_id" ASC, "target_type" ASC, "target_id" ASC);

-- CreateIndex
CREATE INDEX "social_reports_target_type_target_id_idx" ON "public"."social_reports"("target_type" ASC, "target_id" ASC);

-- CreateIndex
CREATE INDEX "social_username_history_held_canonical_hold_until_idx" ON "public"."social_username_history"("held_canonical" ASC, "hold_until" ASC);

-- CreateIndex
CREATE INDEX "social_username_history_user_id_created_at_idx" ON "public"."social_username_history"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "usage_meters_user_id_meter_unit_idx" ON "public"."usage_meters"("user_id" ASC, "meter_unit" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "usage_meters_user_id_meter_unit_period_start_period_end_key" ON "public"."usage_meters"("user_id" ASC, "meter_unit" ASC, "period_start" ASC, "period_end" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "usage_reservations_idempotency_key_key" ON "public"."usage_reservations"("idempotency_key" ASC);

-- CreateIndex
CREATE INDEX "usage_reservations_usage_meter_id_status_idx" ON "public"."usage_reservations"("usage_meter_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "usage_reservations_user_id_status_expires_at_idx" ON "public"."usage_reservations"("user_id" ASC, "status" ASC, "expires_at" ASC);

-- CreateIndex
CREATE INDEX "user_blocks_blocked_character_id_idx" ON "public"."user_blocks"("blocked_character_id" ASC);

-- CreateIndex
CREATE INDEX "user_blocks_blocked_creator_id_idx" ON "public"."user_blocks"("blocked_creator_id" ASC);

-- CreateIndex
CREATE INDEX "user_blocks_blocked_user_id_user_id_idx" ON "public"."user_blocks"("blocked_user_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_user_id_blocked_user_id_key" ON "public"."user_blocks"("user_id" ASC, "blocked_user_id" ASC);

-- CreateIndex
CREATE INDEX "user_blocks_user_id_idx" ON "public"."user_blocks"("user_id" ASC);

-- CreateIndex
CREATE INDEX "user_character_signals_character_id_idx" ON "public"."user_character_signals"("character_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_character_signals_user_id_character_id_key" ON "public"."user_character_signals"("user_id" ASC, "character_id" ASC);

-- CreateIndex
CREATE INDEX "user_character_signals_user_id_engagement_score_idx" ON "public"."user_character_signals"("user_id" ASC, "engagement_score" DESC);

-- CreateIndex
CREATE INDEX "user_daily_metrics_date_idx" ON "public"."user_daily_metrics"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_daily_metrics_user_id_date_key" ON "public"."user_daily_metrics"("user_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "user_devices_push_token_idx" ON "public"."user_devices"("push_token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_device_id_key" ON "public"."user_devices"("user_id" ASC, "device_id" ASC);

-- CreateIndex
CREATE INDEX "user_devices_user_id_is_active_idx" ON "public"."user_devices"("user_id" ASC, "is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_discovery_preferences_user_id_key" ON "public"."user_discovery_preferences"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_entitlements_user_id_entitlement_key_source_source_id_key" ON "public"."user_entitlements"("user_id" ASC, "entitlement_key" ASC, "source" ASC, "source_id" ASC);

-- CreateIndex
CREATE INDEX "user_entitlements_user_id_is_active_expires_at_idx" ON "public"."user_entitlements"("user_id" ASC, "is_active" ASC, "expires_at" ASC);

-- CreateIndex
CREATE INDEX "user_favorites_character_id_idx" ON "public"."user_favorites"("character_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_favorites_user_id_character_id_key" ON "public"."user_favorites"("user_id" ASC, "character_id" ASC);

-- CreateIndex
CREATE INDEX "user_favorites_user_id_created_at_idx" ON "public"."user_favorites"("user_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_first_sessions_is_activated_activated_at_idx" ON "public"."user_first_sessions"("is_activated" ASC, "activated_at" DESC);

-- CreateIndex
CREATE INDEX "user_first_sessions_selected_character_id_idx" ON "public"."user_first_sessions"("selected_character_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_first_sessions_user_id_key" ON "public"."user_first_sessions"("user_id" ASC);

-- CreateIndex
CREATE INDEX "user_follows_followed_user_id_status_created_at_idx" ON "public"."user_follows"("followed_user_id" ASC, "status" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_follows_follower_user_id_followed_user_id_key" ON "public"."user_follows"("follower_user_id" ASC, "followed_user_id" ASC);

-- CreateIndex
CREATE INDEX "user_follows_follower_user_id_status_created_at_idx" ON "public"."user_follows"("follower_user_id" ASC, "status" ASC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_memory_settings_user_id_key" ON "public"."user_memory_settings"("user_id" ASC);

-- CreateIndex
CREATE INDEX "user_mutes_user_id_target_type_idx" ON "public"."user_mutes"("user_id" ASC, "target_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_mutes_user_id_target_type_target_id_scope_key" ON "public"."user_mutes"("user_id" ASC, "target_type" ASC, "target_id" ASC, "scope" ASC);

-- CreateIndex
CREATE INDEX "user_negative_signals_character_id_idx" ON "public"."user_negative_signals"("character_id" ASC);

-- CreateIndex
CREATE INDEX "user_negative_signals_creator_profile_id_idx" ON "public"."user_negative_signals"("creator_profile_id" ASC);

-- CreateIndex
CREATE INDEX "user_negative_signals_user_id_signal_type_idx" ON "public"."user_negative_signals"("user_id" ASC, "signal_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_privacy_settings_user_id_key" ON "public"."user_privacy_settings"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "public"."user_profiles"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_username_key" ON "public"."user_profiles"("username" ASC);

-- CreateIndex
CREATE INDEX "user_reminders_status_target_time_idx" ON "public"."user_reminders"("status" ASC, "target_time" ASC);

-- CreateIndex
CREATE INDEX "user_reminders_user_id_status_idx" ON "public"."user_reminders"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "user_restrictions_user_id_is_active_expires_at_idx" ON "public"."user_restrictions"("user_id" ASC, "is_active" ASC, "expires_at" ASC);

-- CreateIndex
CREATE INDEX "user_search_histories_user_id_last_searched_at_idx" ON "public"."user_search_histories"("user_id" ASC, "last_searched_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_search_histories_user_id_normalized_query_key" ON "public"."user_search_histories"("user_id" ASC, "normalized_query" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_voice_preferences_user_id_key" ON "public"."user_voice_preferences"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "users_normalized_email_idx" ON "public"."users"("normalized_email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "public"."users"("normalized_email" ASC);

-- CreateIndex
CREATE INDEX "users_normalized_phone_number_idx" ON "public"."users"("normalized_phone_number" ASC);

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status" ASC);

-- CreateIndex
CREATE INDEX "voice_session_turns_session_id_turn_index_idx" ON "public"."voice_session_turns"("session_id" ASC, "turn_index" ASC);

-- CreateIndex
CREATE INDEX "voice_sessions_character_id_status_idx" ON "public"."voice_sessions"("character_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "voice_sessions_created_at_idx" ON "public"."voice_sessions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "voice_sessions_user_id_status_idx" ON "public"."voice_sessions"("user_id" ASC, "status" ASC);

-- AddForeignKey
ALTER TABLE "public"."account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activation_funnel_logs" ADD CONSTRAINT "activation_funnel_logs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activation_funnel_logs" ADD CONSTRAINT "activation_funnel_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."admin_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_results" ADD CONSTRAINT "ai_evaluation_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."ai_evaluation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_results" ADD CONSTRAINT "ai_evaluation_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "public"."ai_evaluation_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_runs" ADD CONSTRAINT "ai_evaluation_runs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_runs" ADD CONSTRAINT "ai_evaluation_runs_character_version_id_fkey" FOREIGN KEY ("character_version_id") REFERENCES "public"."character_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_runs" ADD CONSTRAINT "ai_evaluation_runs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "public"."ai_evaluation_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_runs" ADD CONSTRAINT "ai_evaluation_runs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_runs" ADD CONSTRAINT "ai_evaluation_runs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."ai_prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_test_cases" ADD CONSTRAINT "ai_evaluation_test_cases_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_evaluation_test_cases" ADD CONSTRAINT "ai_evaluation_test_cases_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "public"."ai_evaluation_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_generation_traces" ADD CONSTRAINT "ai_generation_traces_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_generation_traces" ADD CONSTRAINT "ai_generation_traces_character_version_id_fkey" FOREIGN KEY ("character_version_id") REFERENCES "public"."character_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_generation_traces" ADD CONSTRAINT "ai_generation_traces_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_generation_traces" ADD CONSTRAINT "ai_generation_traces_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."ai_prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_generation_traces" ADD CONSTRAINT "ai_generation_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_models" ADD CONSTRAINT "ai_models_fallback_model_id_fkey" FOREIGN KEY ("fallback_model_id") REFERENCES "public"."ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt_experiments" ADD CONSTRAINT "ai_prompt_experiments_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_routing_policies" ADD CONSTRAINT "ai_routing_policies_preferred_model_id_fkey" FOREIGN KEY ("preferred_model_id") REFERENCES "public"."ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_invoices" ADD CONSTRAINT "billing_invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."purchase_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_plans" ADD CONSTRAINT "billing_plans_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."billing_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_prices" ADD CONSTRAINT "billing_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_prices" ADD CONSTRAINT "billing_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."billing_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_promotions" ADD CONSTRAINT "billing_promotions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_reconciliations" ADD CONSTRAINT "billing_reconciliations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_reconciliations" ADD CONSTRAINT "billing_reconciliations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "public"."billing_prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_discovery_configs" ADD CONSTRAINT "character_discovery_configs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."character_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_discovery_configs" ADD CONSTRAINT "character_discovery_configs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_follows" ADD CONSTRAINT "character_follows_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_follows" ADD CONSTRAINT "character_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_knowledge" ADD CONSTRAINT "character_knowledge_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_reports" ADD CONSTRAINT "character_reports_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_reports" ADD CONSTRAINT "character_reports_moderation_case_id_fkey" FOREIGN KEY ("moderation_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_reports" ADD CONSTRAINT "character_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_similarities" ADD CONSTRAINT "character_similarities_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_similarities" ADD CONSTRAINT "character_similarities_similar_character_id_fkey" FOREIGN KEY ("similar_character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_social_capabilities" ADD CONSTRAINT "character_social_capabilities_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_tag_links" ADD CONSTRAINT "character_tag_links_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_tag_links" ADD CONSTRAINT "character_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."character_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_tags" ADD CONSTRAINT "character_tags_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."character_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_traits" ADD CONSTRAINT "character_traits_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_versions" ADD CONSTRAINT "character_versions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."character_versions" ADD CONSTRAINT "character_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."characters" ADD CONSTRAINT "characters_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."character_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."characters" ADD CONSTRAINT "characters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."characters" ADD CONSTRAINT "characters_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."characters" ADD CONSTRAINT "characters_current_published_version_id_fkey" FOREIGN KEY ("current_published_version_id") REFERENCES "public"."character_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_items" ADD CONSTRAINT "collection_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."curated_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."communities" ADD CONSTRAINT "communities_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."communities" ADD CONSTRAINT "communities_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_members" ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_members" ADD CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_summaries" ADD CONSTRAINT "conversation_summaries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_character_version_id_fkey" FOREIGN KEY ("character_version_id") REFERENCES "public"."character_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_earnings_ledger" ADD CONSTRAINT "creator_earnings_ledger_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_earnings_ledger" ADD CONSTRAINT "creator_earnings_ledger_creator_product_id_fkey" FOREIGN KEY ("creator_product_id") REFERENCES "public"."creator_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_earnings_ledger" ADD CONSTRAINT "creator_earnings_ledger_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_follows" ADD CONSTRAINT "creator_follows_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_follows" ADD CONSTRAINT "creator_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_products" ADD CONSTRAINT "creator_products_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_products" ADD CONSTRAINT "creator_products_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_transactions" ADD CONSTRAINT "credit_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."credit_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."credit_wallets" ADD CONSTRAINT "credit_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_export_requests" ADD CONSTRAINT "data_export_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discovery_event_logs" ADD CONSTRAINT "discovery_event_logs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discovery_event_logs" ADD CONSTRAINT "discovery_event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."emergency_kill_switches" ADD CONSTRAINT "emergency_kill_switches_activated_by_admin_id_fkey" FOREIGN KEY ("activated_by_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_variant_key_fkey" FOREIGN KEY ("experiment_id", "variant_key") REFERENCES "public"."experiment_variants"("experiment_id", "key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."experiment_exposures" ADD CONSTRAINT "experiment_exposures_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."experiment_exposures" ADD CONSTRAINT "experiment_exposures_experiment_id_variant_key_fkey" FOREIGN KEY ("experiment_id", "variant_key") REFERENCES "public"."experiment_variants"("experiment_id", "key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."experiment_variants" ADD CONSTRAINT "experiment_variants_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memories" ADD CONSTRAINT "memories_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memories" ADD CONSTRAINT "memories_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memories" ADD CONSTRAINT "memories_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memory_embeddings" ADD CONSTRAINT "memory_embeddings_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_feedback" ADD CONSTRAINT "message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_feedback" ADD CONSTRAINT "message_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_generation_metadata" ADD CONSTRAINT "message_generation_metadata_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_parts" ADD CONSTRAINT "message_parts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_appeals" ADD CONSTRAINT "moderation_appeals_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_appeals" ADD CONSTRAINT "moderation_appeals_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_appeals" ADD CONSTRAINT "moderation_appeals_moderation_case_id_fkey" FOREIGN KEY ("moderation_case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_appeals" ADD CONSTRAINT "moderation_appeals_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_cases" ADD CONSTRAINT "moderation_cases_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_cases" ADD CONSTRAINT "moderation_cases_character_version_id_fkey" FOREIGN KEY ("character_version_id") REFERENCES "public"."character_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_cases" ADD CONSTRAINT "moderation_cases_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderation_cases" ADD CONSTRAINT "moderation_cases_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_usage_limits" ADD CONSTRAINT "plan_usage_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proactive_actions" ADD CONSTRAINT "proactive_actions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proactive_actions" ADD CONSTRAINT "proactive_actions_character_version_id_fkey" FOREIGN KEY ("character_version_id") REFERENCES "public"."character_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proactive_actions" ADD CONSTRAINT "proactive_actions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proactive_actions" ADD CONSTRAINT "proactive_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proactive_decision_logs" ADD CONSTRAINT "proactive_decision_logs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proactive_decision_logs" ADD CONSTRAINT "proactive_decision_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."promo_redemptions" ADD CONSTRAINT "promo_redemptions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."billing_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."promo_redemptions" ADD CONSTRAINT "promo_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_transactions" ADD CONSTRAINT "purchase_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_transactions" ADD CONSTRAINT "purchase_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."relationship_events" ADD CONSTRAINT "relationship_events_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."relationship_milestones" ADD CONSTRAINT "relationship_milestones_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."relationship_state_history" ADD CONSTRAINT "relationship_state_history_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."relationships" ADD CONSTRAINT "relationships_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."relationships" ADD CONSTRAINT "relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."safety_evaluation_logs" ADD CONSTRAINT "safety_evaluation_logs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."safety_evaluation_logs" ADD CONSTRAINT "safety_evaluation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."safety_incidents" ADD CONSTRAINT "safety_incidents_lead_admin_id_fkey" FOREIGN KEY ("lead_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheduled_social_actions" ADD CONSTRAINT "scheduled_social_actions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."search_documents" ADD CONSTRAINT "search_documents_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."search_query_logs" ADD CONSTRAINT "search_query_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_appeals" ADD CONSTRAINT "social_appeals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."social_moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_appeals" ADD CONSTRAINT "social_appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_comments" ADD CONSTRAINT "social_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_comments" ADD CONSTRAINT "social_comments_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_comments" ADD CONSTRAINT "social_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."social_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_consents" ADD CONSTRAINT "social_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_content_revisions" ADD CONSTRAINT "social_content_revisions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_contents" ADD CONSTRAINT "social_contents_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_contents" ADD CONSTRAINT "social_contents_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_contents" ADD CONSTRAINT "social_contents_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_direct_messages" ADD CONSTRAINT "social_direct_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_direct_messages" ADD CONSTRAINT "social_direct_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."social_direct_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_direct_participants" ADD CONSTRAINT "social_direct_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."social_direct_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_direct_participants" ADD CONSTRAINT "social_direct_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_feed_feedback" ADD CONSTRAINT "social_feed_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_message_requests" ADD CONSTRAINT "social_message_requests_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_message_requests" ADD CONSTRAINT "social_message_requests_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_message_requests" ADD CONSTRAINT "social_message_requests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."social_direct_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_privacy_settings" ADD CONSTRAINT "social_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_profiles" ADD CONSTRAINT "social_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_reactions" ADD CONSTRAINT "social_reactions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_reactions" ADD CONSTRAINT "social_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_reports" ADD CONSTRAINT "social_reports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."social_moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_reports" ADD CONSTRAINT "social_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_username_history" ADD CONSTRAINT "social_username_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_meters" ADD CONSTRAINT "usage_meters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_reservations" ADD CONSTRAINT "usage_reservations_usage_meter_id_fkey" FOREIGN KEY ("usage_meter_id") REFERENCES "public"."usage_meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_reservations" ADD CONSTRAINT "usage_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_blocked_character_id_fkey" FOREIGN KEY ("blocked_character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_blocked_creator_id_fkey" FOREIGN KEY ("blocked_creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_blocks" ADD CONSTRAINT "user_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_character_signals" ADD CONSTRAINT "user_character_signals_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_character_signals" ADD CONSTRAINT "user_character_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_discovery_preferences" ADD CONSTRAINT "user_discovery_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_favorites" ADD CONSTRAINT "user_favorites_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_favorites" ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_first_sessions" ADD CONSTRAINT "user_first_sessions_selected_character_id_fkey" FOREIGN KEY ("selected_character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_first_sessions" ADD CONSTRAINT "user_first_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_follows" ADD CONSTRAINT "user_follows_followed_user_id_fkey" FOREIGN KEY ("followed_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_follows" ADD CONSTRAINT "user_follows_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_memory_settings" ADD CONSTRAINT "user_memory_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_mutes" ADD CONSTRAINT "user_mutes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_negative_signals" ADD CONSTRAINT "user_negative_signals_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_negative_signals" ADD CONSTRAINT "user_negative_signals_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_negative_signals" ADD CONSTRAINT "user_negative_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_relationship_settings" ADD CONSTRAINT "user_relationship_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_reminders" ADD CONSTRAINT "user_reminders_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_reminders" ADD CONSTRAINT "user_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_search_histories" ADD CONSTRAINT "user_search_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_voice_preferences" ADD CONSTRAINT "user_voice_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_session_turns" ADD CONSTRAINT "voice_session_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."voice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_sessions" ADD CONSTRAINT "voice_sessions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_sessions" ADD CONSTRAINT "voice_sessions_character_version_id_fkey" FOREIGN KEY ("character_version_id") REFERENCES "public"."character_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_sessions" ADD CONSTRAINT "voice_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

