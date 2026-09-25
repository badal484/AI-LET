# AI Companion Platform

A production-grade, highly scalable AI companion platform built with clean domain-driven architecture, multi-tier memory synthesis, dynamic model routing, native React Native mobile client, and Next.js operations console.

---

## 🏛️ Architecture & Documentation

Comprehensive system specifications are maintained in the [`docs/`](docs/) directory:

- [System Architecture](docs/architecture.md): Monorepo topology, component breakdown, failover strategies.
- [Development Guide](docs/development.md): Local developer setup, pnpm commands, quality workflows.
- [Environment Configuration](docs/environment.md): Environment variables dictionary and security rules.
- [State Management](docs/state-management.md): Strict state classification (Server State via TanStack Query, Global Client State via Zustand, Local UI State, Persistent Storage).
- [Database & Schema](docs/database.md): PostgreSQL 16 schema, indexing, lifecycle, and `pgvector` memory embeddings.
- [AI System & Routing](docs/ai-system.md): Decoupled AI orchestrator, provider adapters, model fallback cascades, and token metering.
- [Character Engine](docs/character-system.md): Multi-dimensional character configuration, dynamic prompt synthesizer, versioning and rollback.
- [Multi-Tier Memory](docs/memory.md): 5-tier memory model, asynchronous extraction pipeline, and relevance-weighted retrieval.
- [Security & Compliance](docs/security.md): Dual-token auth rotation, RBAC, prompt-injection defenses, GDPR erasure protocols.
- [Testing & Quality Assurance](docs/testing.md): Testing pyramid, automated CI workflows, synthetic AI evaluation harness.
- [Deployment & DevOps](docs/deployment.md): Multi-environment strategy, Docker infrastructure, zero-downtime database migrations.

---

## 📦 Monorepo Structure

```text
ai-companion-platform/
├── apps/
│   ├── api/                  # Express + TypeScript + Prisma + Redis backend API
│   ├── mobile/               # React Native CLI TypeScript mobile application
│   └── admin/                # Next.js 15 App Router administrative operations dashboard
├── packages/
│   ├── types/                # Domain models, entities, and API payload contracts
│   ├── config/               # System limits, constants, error codes, feature flags
│   ├── validation/           # Ingress payload Zod validation schemas
│   ├── ui-tokens/            # Curated design tokens (colors, typography, spacing, shadows, motion)
│   ├── api-client/           # Universal typed API client SDK
│   └── utils/                # Pure formatting, date, and math utilities
├── infrastructure/
│   ├── docker/               # PostgreSQL 16 (pgvector) & Redis 7 container orchestration
│   └── scripts/              # Health check & development scripts
├── docs/                     # Production engineering constitution & system specs
├── pnpm-workspace.yaml       # pnpm workspace definition
└── .github/workflows/ci.yml  # Automated CI verification workflow
```

---

## 🚀 Quickstart & Developer Workflow

### Prerequisites

- Node.js >= 20.0.0 (Node 24 LTS recommended)
- pnpm >= 9.0.0 (`npm i -g pnpm`)
- Docker & Docker Compose

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Local Infrastructure (PostgreSQL with pgvector & Redis)

```bash
pnpm docker:up
```

### 3. Generate Database Client & Types

```bash
pnpm --filter @ai-companion/api run db:generate
```

### 4. Run Quality Verification Suite

```bash
pnpm lint         # ESLint checks across all apps and packages
pnpm typecheck    # Strict TypeScript checks across all workspaces
pnpm test         # Vitest unit & integration test suites
pnpm build        # Build packages and applications
```

### 5. Start Development Servers

```bash
# Start backend API (http://localhost:4000)
pnpm dev:api

# Start admin panel (http://localhost:3000)
pnpm dev:admin

# Start mobile bundler (http://localhost:8081)
pnpm dev:mobile
```
