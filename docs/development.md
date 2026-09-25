# Local Development & Engineering Workflow

## 1. Prerequisites

- **Node.js**: `v24.0.0` or higher (LTS recommended)
- **pnpm**: `v9.0.0` or higher (`corepack enable` or `npm i -g pnpm`)
- **Docker & Docker Compose**: For local PostgreSQL (pgvector) and Redis instances
- **React Native Toolchain** (For mobile development):
  - Xcode & CocoaPods (iOS on macOS)
  - Android Studio & Android SDK (Android)

---

## 2. Getting Started

### 1. Install Monorepo Dependencies

```bash
pnpm install
```

### 2. Start Local Infrastructure Services

```bash
pnpm docker:up
```

This boots up:

- **PostgreSQL 16 + pgvector** on `localhost:5432` (`ai_companion_dev`)
- **Redis 7** on `localhost:6379`

### 3. Generate Prisma Client

```bash
pnpm --filter @ai-companion/api run db:generate
```

---

## 3. Running Applications

| Application      | Command           | URL / Port              | Description                                      |
| :--------------- | :---------------- | :---------------------- | :----------------------------------------------- |
| **All Services** | `pnpm dev`        | Multiple                | Starts API, Admin, and Mobile Metro concurrently |
| **Backend API**  | `pnpm dev:api`    | `http://localhost:4000` | Express API with hot reloading via `tsx`         |
| **Admin Panel**  | `pnpm dev:admin`  | `http://localhost:3000` | Next.js 15 App Router operations dashboard       |
| **Mobile Metro** | `pnpm dev:mobile` | `http://localhost:8081` | React Native Metro bundler                       |

---

## 4. Quality & Verification Commands

Before opening pull requests or committing code, run the verification suite:

```bash
# 1. Lint all packages and applications
pnpm lint

# 2. Typecheck strict TypeScript across all workspaces
pnpm typecheck

# 3. Execute unit and integration tests (Vitest)
pnpm test

# 4. Build all packages and applications
pnpm build

# 5. Format check
pnpm format:check
```

---

## 5. Architectural Boundaries & Conventions

- **Database Direct Access**: Only `apps/api` communicates directly with PostgreSQL and Redis. Mobile and Admin apps must consume `@ai-companion/api-client` or the HTTP API.
- **Shared Packages**: Pure domain types live in `packages/types`, validation schemas in `packages/validation`, constants in `packages/config`, UI tokens in `packages/ui-tokens`, and utilities in `packages/utils`.
- **State Segregation**: Never duplicate server state in client stores. Server data belongs in TanStack Query; ephemeral UI and session tokens belong in Zustand.
