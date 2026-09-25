# Environment Variables & Configuration Dictionary

## 1. Principles of Environment Configuration

1. **Validation at Boot**: All backend environment variables are validated via Zod in `apps/api/src/config/env.ts`. Missing required variables in production immediately abort process bootstrap with a clear error payload.
2. **Never Bundle Secrets in Clients**: `apps/mobile` and `apps/admin` never receive database passwords, JWT signing secrets, or private AI provider keys.
3. **Template Parity**: Any new environment variable must be added with documented defaults to `.env.example`.

---

## 2. Configuration Dictionary

| Variable Name                 | Required / Default                    | Purpose                                     | Sensitive? |
| :---------------------------- | :------------------------------------ | :------------------------------------------ | :--------- |
| `NODE_ENV`                    | `development` / `test` / `production` | Active runtime environment mode             | No         |
| `PORT`                        | `4000`                                | HTTP port for the Express backend API       | No         |
| `API_PREFIX`                  | `/api/v1`                             | URL version prefix for all REST endpoints   | No         |
| `CORS_ORIGIN`                 | `*` (Dev) / Specific Domains (Prod)   | Permitted origins for web & mobile clients  | No         |
| `LOG_LEVEL`                   | `info` (Prod) / `debug` (Dev)         | Winston structured log verbosity            | No         |
| `DATABASE_URL`                | `postgresql://...`                    | Connection URI for PostgreSQL with pgvector | **YES**    |
| `REDIS_HOST`                  | `localhost`                           | Redis server hostname                       | No         |
| `REDIS_PORT`                  | `6379`                                | Redis server port                           | No         |
| `REDIS_PASSWORD`              | Optional                              | Redis authentication password               | **YES**    |
| `JWT_ACCESS_SECRET`           | Min 32 chars                          | Signing secret for 15-minute access tokens  | **YES**    |
| `JWT_REFRESH_SECRET`          | Min 32 chars                          | Signing secret for 30-day refresh tokens    | **YES**    |
| `OPENAI_API_KEY`              | Optional / `sk-...`                   | OpenAI LLM & Embedding provider API key     | **YES**    |
| `ANTHROPIC_API_KEY`           | Optional / `sk-ant-...`               | Anthropic Claude LLM provider API key       | **YES**    |
| `GOOGLE_AI_API_KEY`           | Optional                              | Google Gemini LLM provider API key          | **YES**    |
| `DEFAULT_CHAT_MODEL`          | `gpt-4o-mini`                         | Default primary chat generation model       | No         |
| `DEFAULT_FALLBACK_CHAT_MODEL` | `gemini-1.5-flash`                    | Fallback chat model on primary outage       | No         |
| `RATE_LIMIT_WINDOW_MS`        | `60000` (1 min)                       | Window duration for global rate limiting    | No         |
| `RATE_LIMIT_MAX_REQUESTS`     | `100`                                 | Max requests per IP per rate limit window   | No         |
