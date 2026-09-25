import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),
  /** Canonical origin for public share links and link previews (e.g. https://aicompanion.app). */
  SOCIAL_PUBLIC_BASE_URL: z.string().url().default('https://aicompanion.app'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  IS_WORKER_PROCESS: z.coerce.boolean().default(false),

  DATABASE_URL: z
    .string()
    .default(
      'postgresql://postgres:postgrespassword@localhost:5432/ai_companion_dev?schema=public',
    ),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(25),
  DATABASE_POOL_TIMEOUT_MS: z.coerce.number().default(10000),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters')
    .default('development_jwt_access_secret_min_16_chars'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters')
    .default('development_jwt_refresh_secret_min_16_chars'),
  JWT_REFRESH_EXPIRATION: z.string().default('30d'),

  // Object Storage / S3 / CDN
  S3_BUCKET: z.string().default('ai-companion-media-vault'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  CDN_BASE_URL: z.string().default('https://cdn.aicompanion.app'),

  // External AI Providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  DEFAULT_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  DEFAULT_FALLBACK_CHAT_MODEL: z.string().default('gemini-1.5-flash'),

  // Resiliency & Timeouts
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),
  AI_CIRCUIT_BREAKER_FAILURES: z.coerce.number().default(5),
  AI_CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().default(30000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(15000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Phase 11 Billing & Payment Providers (Optional / Fallback to MOCK)
  APPLE_SHARED_SECRET: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  /**
   * Agent tools without a real provider integration return simulated data. Allowed ONLY outside
   * production/staging for local development and tests; never enabled by default.
   */
  /**
   * Billing providers currently have no real App Store / Play / Stripe verification. Simulated
   * verification is allowed ONLY in development/test; production and staging always fail closed.
   */
  BILLING_SIMULATED_PROVIDERS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  AGENT_SIMULATED_TOOLS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Metadata map classifying environment variable sensitivity
 */
export const ENV_SECRET_CLASSIFICATION: Record<keyof EnvConfig, 'SECRET' | 'PUBLIC_CONFIG'> = {
  NODE_ENV: 'PUBLIC_CONFIG',
  PORT: 'PUBLIC_CONFIG',
  API_PREFIX: 'PUBLIC_CONFIG',
  CORS_ORIGIN: 'PUBLIC_CONFIG',
  SOCIAL_PUBLIC_BASE_URL: 'PUBLIC_CONFIG',
  LOG_LEVEL: 'PUBLIC_CONFIG',
  IS_WORKER_PROCESS: 'PUBLIC_CONFIG',
  DATABASE_URL: 'SECRET',
  DATABASE_POOL_MIN: 'PUBLIC_CONFIG',
  DATABASE_POOL_MAX: 'PUBLIC_CONFIG',
  DATABASE_POOL_TIMEOUT_MS: 'PUBLIC_CONFIG',
  REDIS_HOST: 'PUBLIC_CONFIG',
  REDIS_PORT: 'PUBLIC_CONFIG',
  REDIS_PASSWORD: 'SECRET',
  REDIS_DB: 'PUBLIC_CONFIG',
  JWT_ACCESS_SECRET: 'SECRET',
  JWT_ACCESS_EXPIRATION: 'PUBLIC_CONFIG',
  JWT_REFRESH_SECRET: 'SECRET',
  JWT_REFRESH_EXPIRATION: 'PUBLIC_CONFIG',
  S3_BUCKET: 'PUBLIC_CONFIG',
  S3_REGION: 'PUBLIC_CONFIG',
  S3_ENDPOINT: 'PUBLIC_CONFIG',
  S3_ACCESS_KEY_ID: 'SECRET',
  S3_SECRET_ACCESS_KEY: 'SECRET',
  CDN_BASE_URL: 'PUBLIC_CONFIG',
  OPENAI_API_KEY: 'SECRET',
  ANTHROPIC_API_KEY: 'SECRET',
  GOOGLE_AI_API_KEY: 'SECRET',
  DEFAULT_CHAT_MODEL: 'PUBLIC_CONFIG',
  DEFAULT_FALLBACK_CHAT_MODEL: 'PUBLIC_CONFIG',
  AI_REQUEST_TIMEOUT_MS: 'PUBLIC_CONFIG',
  AI_CIRCUIT_BREAKER_FAILURES: 'PUBLIC_CONFIG',
  AI_CIRCUIT_BREAKER_COOLDOWN_MS: 'PUBLIC_CONFIG',
  SHUTDOWN_TIMEOUT_MS: 'PUBLIC_CONFIG',
  RATE_LIMIT_WINDOW_MS: 'PUBLIC_CONFIG',
  RATE_LIMIT_MAX_REQUESTS: 'PUBLIC_CONFIG',
  APPLE_SHARED_SECRET: 'SECRET',
  GOOGLE_SERVICE_ACCOUNT_JSON: 'SECRET',
  STRIPE_SECRET_KEY: 'SECRET',
  STRIPE_WEBHOOK_SECRET: 'SECRET',
  AGENT_SIMULATED_TOOLS: 'PUBLIC_CONFIG',
  BILLING_SIMULATED_PROVIDERS: 'PUBLIC_CONFIG',
};

const parsedEnv = envSchema.safeParse(process.env);
const runtimeEnv = process.env['NODE_ENV'] ?? 'development';

if (!parsedEnv.success) {
  console.error(
    '❌ Environment validation failed:',
    JSON.stringify(parsedEnv.error.format(), null, 2),
  );
  // Only the test runner may fall back to built-in test secrets. Any other environment
  // (including a production deploy that forgot NODE_ENV) must refuse to start.
  if (runtimeEnv !== 'test') {
    process.exit(1);
  }
}

if (
  parsedEnv.success &&
  ['production', 'staging'].includes(parsedEnv.data.NODE_ENV) &&
  (parsedEnv.data.AGENT_SIMULATED_TOOLS || parsedEnv.data.BILLING_SIMULATED_PROVIDERS)
) {
  console.error('❌ AGENT_SIMULATED_TOOLS / BILLING_SIMULATED_PROVIDERS cannot be enabled in production or staging.');
  process.exit(1);
}

// Credentialed CORS with a wildcard reflects ANY origin: never allowed outside development/test.
if (parsedEnv.success && ['production', 'staging'].includes(parsedEnv.data.NODE_ENV) && parsedEnv.data.CORS_ORIGIN.split(',').some((o) => o.trim() === '*')) {
  console.error('❌ CORS_ORIGIN must list explicit origins in production or staging (wildcard is not allowed with credentials).');
  process.exit(1);
}

export const env: EnvConfig = parsedEnv.success
  ? parsedEnv.data
  : envSchema.parse({
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test_secret_key_32_characters_long_min',
      JWT_REFRESH_SECRET: 'test_secret_key_32_characters_long_min',
    });
