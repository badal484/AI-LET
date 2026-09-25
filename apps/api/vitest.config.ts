import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadDotenv();

/**
 * Tests create and delete rows freely (including admin users), so they must never run against the
 * developer's database. Resolution order:
 *   1. TEST_DATABASE_URL, if set;
 *   2. in CI, DATABASE_URL as provided (CI databases are disposable);
 *   3. otherwise DATABASE_URL with the database name suffixed `_test`.
 * tests/globalSetup.ts creates that database if needed and applies migrations with `migrate deploy`.
 */
function resolveTestDatabaseUrl(): string | undefined {
  if (process.env['TEST_DATABASE_URL']) return process.env['TEST_DATABASE_URL'];
  const base = process.env['DATABASE_URL'];
  if (!base || process.env['CI']) return base;
  const url = new URL(base);
  const name = url.pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) url.pathname = `/${name}_test`;
  return url.toString();
}

const testDatabaseUrl = resolveTestDatabaseUrl();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    globalSetup: ['tests/globalSetup.ts'],
    env: {
      ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
      // Simulated agent-tool adapters are test/dev-only (production/staging refuse to start with this on).
      AGENT_SIMULATED_TOOLS: 'true',
      BILLING_SIMULATED_PROVIDERS: 'true',
    },
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
});
