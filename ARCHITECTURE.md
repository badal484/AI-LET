# Production Architecture & Topology Map

## 1. High-Level Architecture Topology

```
                         INTERNET
                            │
                  AWS CloudFront / Edge CDN
                            │
               AWS Application Load Balancer
                 (HTTPS / TLS 1.3 / WAF)
                            │
     ┌──────────────────────┼──────────────────────┐
     │                      │                      │
 API Container Cluster    Worker Cluster     Next.js Admin
(ECS Fargate Multi-AZ)   (BullMQ Consumers)   (ECS Fargate)
     │                      │                      │
     └──────────────────────┼──────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
   RDS PostgreSQL 16                  ElastiCache Redis 7
 (pgvector, Multi-AZ)                 (Replication Group)
          │
    S3 Media Vault
 (KMS Encrypted, Private)
```

---

## 2. Layer Responsibilities & Failure Modes

| Component | Responsibility | Single Point of Failure? | Failure Fallback Behavior |
| :--- | :--- | :--- | :--- |
| **API Servers** | Stateless REST & WebSocket handling | No (Multi-AZ Fargate) | Traffic automatically routed to surviving containers |
| **PostgreSQL** | Canonical persistence, relations, vector embeddings | No (Multi-AZ failover) | Automatic standby promotion in &lt; 60s, PITR backup snapshots |
| **Redis** | BullMQ queues, ephemeral sessions, locks, cache | No (Multi-AZ Cluster) | Authoritative DB fallback, in-memory rate limiting, automatic reconnection |
| **AI Gateway** | Multi-provider LLM routing & streaming | No (Cascading fallback) | Circuit breakers route: OpenAI &rarr; Anthropic &rarr; Google Gemini &rarr; Safe Neutral Response |
| **S3 & CDN** | Encrypted media storage & asset delivery | No (AWS 99.999999999% SLA) | Direct pre-signed URLs with MIME & magic-byte verification |
| **Workers** | Memory extraction, notifications, index sync | No (Horizontal Fargate) | Dead Letter Queue (DLQ) captures failed jobs with bounded retries |

---

## 3. Data Flow & Security Boundaries

1. **Client &rarr; Edge:** Mobile client communicates exclusively via TLS 1.3 to AWS CloudFront / ALB.
2. **Authentication:** Stateless JWT Access Tokens (15m expiration) + Refresh Tokens (30d rotation) stored in PostgreSQL.
3. **Admin Access:** Strict RBAC, session cookie verification, private API isolation.
4. **Data Isolation:** Private database and Redis subnets have no direct public internet exposure.
