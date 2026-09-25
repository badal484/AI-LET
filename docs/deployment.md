# Deployment, Infrastructure & DevOps Specification

## 1. Environments Strategy

| Environment     | Purpose                                 | Database                                  | Redis                            | AI Models                                | Secrets Management             |
| :-------------- | :-------------------------------------- | :---------------------------------------- | :------------------------------- | :--------------------------------------- | :----------------------------- |
| **Development** | Local coding & rapid iteration          | Local Docker (`pgvector/pgvector:pg16`)   | Local Docker (`redis:7-alpine`)  | Mock / Real API keys (rate-limited)      | `.env.local` (never committed) |
| **Staging**     | Pre-production validation, AI eval runs | Managed Cloud Postgres with pgvector      | Managed Redis                    | Production-grade LLM API accounts        | AWS Secrets Manager / Doppler  |
| **Production**  | Live consumer traffic                   | Multi-AZ Managed Postgres + Read Replicas | Redis Cluster with Auto-Failover | Tier 1 Dedicated Enterprise AI Endpoints | KMS / Vault                    |

---

## 2. Local Containerization (`docker-compose.yml`)

Local development is standardized using Docker Compose for infrastructure dependencies:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: ai_companion_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: ai_companion_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d ai_companion_dev']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: ai_companion_redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

---

## 3. Database Migration Strategy

1. Migrations are managed via Prisma (`prisma/schema.prisma` and `prisma migrate`).
2. **Zero-Downtime Migration Rules**:
   - Column additions must be nullable or have safe defaults.
   - Column removals must be executed in a two-phase rollout (deprecate & stop writing -> drop column in subsequent release).
   - Large indexes created using `CONCURRENTLY` in raw migrations when operating at scale.
3. CI automatically validates migration idempotency against an ephemeral PostgreSQL container.
