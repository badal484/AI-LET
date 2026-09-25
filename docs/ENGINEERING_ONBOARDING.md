# Engineering Onboarding & Architecture Guide

Welcome to the **AI Companion Engineering Team**! This guide gets you from zero to shipping production-ready code.

---

## 1. Monorepo Architecture Overview

The codebase is organized as a high-performance **pnpm workspace monorepo**:

```
├── apps/
│   ├── api/          # Node.js + Express + TypeScript Core Backend & AI Gateway
│   ├── admin/        # Next.js 14 + TailwindCSS Production Admin Command Center
│   └── mobile/       # React Native CLI + TypeScript iOS/Android Mobile Client
├── packages/
│   ├── config/       # Shared system constants, error codes, permissions, flags
│   ├── types/        # Comprehensive domain interfaces and types
│   ├── validation/   # Zod validation schemas for all API payloads
│   ├── ui-tokens/    # Design tokens (colors, typography, spacing, motion)
│   ├── api-client/   # Typed API client with auto-refresh and idempotency
│   └── utils/        # Shared pure helpers (crypto, formatting, time, math)
└── docs/             # Complete operational architecture, runbooks, and audits
```

---

## 2. Local Development Setup

### Prerequisites
- Node.js `v20.x` or `v22.x` (LTS)
- pnpm `v9.x` (`npm install -g pnpm`)
- Docker & Docker Compose (for local PostgreSQL, Redis, PgBouncer)
- Xcode & Android Studio (if developing mobile)

### First-Time Setup
```bash
# 1. Clone repository and install dependencies
git clone git@github.com:ai-companion/platform.git
cd platform
pnpm install

# 2. Start local infrastructure containers (PostgreSQL & Redis)
docker-compose up -d

# 3. Copy environment configuration templates
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env

# 4. Run database migrations and seed baseline test characters
pnpm --filter @ai-companion/api db:migrate
pnpm --filter @ai-companion/api db:seed
```

---

## 3. Running Services Locally

```bash
# Run API in watch mode (runs on http://localhost:4000)
pnpm --filter @ai-companion/api dev

# Run Admin Dashboard (runs on http://localhost:3000)
pnpm --filter @ai-companion/admin dev

# Run Mobile Metro Bundler & iOS/Android simulator
pnpm --filter @ai-companion/mobile start
pnpm --filter @ai-companion/mobile run:ios
pnpm --filter @ai-companion/mobile run:android
```

---

## 4. Testing & Quality Verification

Before submitting any Pull Request, you **must** ensure 100% test passage and 0 TypeScript compilation errors:

```bash
# Typecheck all 9 workspace packages
pnpm -r typecheck

# Run backend test suite (72 test files, 358+ tests)
pnpm --filter @ai-companion/api test

# Run linter
pnpm -r lint
```

---

## 5. Deployment & Release Workflow

1. **Branching**: Branch from `main` using standard naming (`feat/`, `fix/`, `ops/`, `perf/`).
2. **CI Gates**: Automated GitHub Actions run typecheck, test suites, and build validation.
3. **Merging**: Requires passing CI and at least 1 peer code review approval.
4. **Staging $\to$ Production**: Merges to `main` auto-deploy to Staging. Production releases are triggered via semantic release tags (`vX.Y.Z`) with canary rollouts.

---

## 6. Observability & On-Call Rotation

- **Logs & Traces**: Structured JSON with correlation IDs (`x-correlation-id`).
- **Dashboards**: Grafana metrics at `https://grafana.internal.ops`.
- **Alerts & On-Call**: PagerDuty schedule rotates weekly. Runbooks are located in `docs/RUNBOOKS/`.
