# Production Launch Readiness Checklist

This document defines the formal go/no-go verification criteria across all 14 platform domains prior to public marketplace launch.

---

## Domain Checklists

### 1. Infrastructure & Networking
- [x] Multi-AZ VPC with public, private app, and private data subnets configured
- [x] Infrastructure as Code (Terraform) tested and reproducible
- [x] TLS 1.3 certificates verified and automated renewal active
- [x] Application Load Balancer health checks configured for `/health/live` and `/health/ready`
- [x] ECS Fargate CPU/Memory autoscaling policies defined and tested

### 2. Security & Secret Management
- [x] Zero secrets committed to Git, Docker images, or mobile bundles
- [x] Strict environment variable classification (Secret vs Public Config)
- [x] Winston structured logger recursively redacting passwords, tokens, cards, and private memories
- [x] CORS strict origin whitelisting configured for web admin
- [x] Rate limiting active: Anonymous IP, Authenticated User, and Emergency Burst limiters

### 3. Database & Persistence
- [x] PostgreSQL 16 with pgvector extension configured in RDS Multi-AZ
- [x] Point-In-Time Recovery (PITR) automated snapshots with 30-day retention
- [x] Connection pool configured with bounded limits and connection timeouts
- [x] Slow query logging active for all SQL statements exceeding 500ms
- [x] Database restore drill successfully verified

### 4. Redis & Queues
- [x] ElastiCache Redis replication group with automatic failover enabled
- [x] BullMQ queue pool separated into dedicated queues (chat, memory, notifications, billing, discovery)
- [x] Dead Letter Queue (DLQ) capturing permanent/exhausted failures with categorization
- [x] Job idempotency middleware preventing duplicate processing
- [x] Cache miss fallback to PostgreSQL authoritative source of truth verified

### 5. AI Engine & Resilience
- [x] Multi-provider fallback chain (OpenAI &rarr; Anthropic &rarr; Google Gemini &rarr; Offline Neutral Safe Response)
- [x] Circuit Breakers active for all external AI, Voice, and Media gateways
- [x] Strict request deadlines and timeouts enforced on every LLM generation
- [x] Emergency Kill Switches operational (`DISABLE_EXPENSIVE_MODELS`, `DISABLE_MEDIA_GENERATION`, etc.)

### 6. Billing & Monetization
- [x] Idempotency keys enforced on all mutating billing and purchase endpoints
- [x] Apple App Store & Google Play Store server-to-server webhook idempotency verified
- [x] Credit ledger transactions wrapped in strict ACID boundaries
- [x] Entitlement cache with instant invalidation on subscription cancellation

### 7. Moderation & Safety
- [x] Safety filter enforcing strict moderation rules on all user and character outputs
- [x] Suspended creator content immediately excluded from public discovery
- [x] User block and report workflows active and filtering real-time feeds

### 8. Search & Discovery
- [x] Hybrid lexical (trigram, FTS) and semantic pgvector search active
- [x] Typo tolerance and Hinglish code-switching normalization verified
- [x] Candidate deduplication, category/creator exposure caps, and MMR diversification active
- [x] Zero-result search spell recovery and related category chips working

### 9. Mobile Application
- [x] React Native client forward-compatible with API schema changes
- [x] Offline fallback and network reconnection handling tested
- [x] Pre-signed S3 direct media uploads working without API proxy bottlenecks

### 10. Admin Command Center
- [x] Infrastructure & Resilience Studio live (`/admin/infrastructure`)
- [x] DLQ job inspector with single-click retry capability
- [x] Circuit breaker and kill switch operational controls active

### 11. Observability & Monitoring
- [x] `/health/live`, `/health/ready`, `/health/dependencies`, `/metrics` endpoints live
- [x] SLO targets and error budget burn rate tracking active
- [x] High-priority alerts configured for SEV-1 and SEV-2 conditions

### 12. Disaster Recovery
- [x] Documented RPO (&lt; 5 min for transactions) and RTO (&lt; 15 min for database failover)
- [x] Step-by-step restoration runbook tested and verified (`RUNBOOK.md`)
