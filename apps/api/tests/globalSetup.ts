import { execFileSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Ensures the isolated test database exists and is at the latest migration before any test runs.
 * Uses `prisma migrate deploy` (never `db push`) so tests exercise the same schema as production.
 */
export default async function setup(): Promise<void> {
  const testUrl = resolveTestDatabaseUrl();
  if (!testUrl) return;

  const target = new URL(testUrl);
  const dbName = target.pathname.replace(/^\//, '');
  const admin = new URL(testUrl);
  admin.pathname = '/postgres';

  const client = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    const rows = await client.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS exists`;
    if (!rows[0]?.exists) {
      if (!/^[a-zA-Z0-9_]+$/.test(dbName)) throw new Error(`Refusing to create test database with unsafe name '${dbName}'`);
      await client.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.$disconnect();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

function resolveTestDatabaseUrl(): string | undefined {
  // vitest.config.ts puts the resolved URL in test.env, which globalSetup does not see directly;
  // recompute it the same way (keep the two in sync).
  if (process.env['TEST_DATABASE_URL']) return process.env['TEST_DATABASE_URL'];
  const base = process.env['DATABASE_URL'];
  if (!base || process.env['CI']) return base; // CI: disposable database, still migrated below
  const url = new URL(base);
  const name = url.pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) url.pathname = `/${name}_test`;
  return url.toString();
}
