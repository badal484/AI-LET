/**
 * Connection pool settings for the app's database URL (audit M-8). Prisma opens up to `connection_limit`
 * connections per process; without it the default depends on the CPU count. Added only when the URL doesn't set
 * them already:
 *  - connection_limit = DB_CONNECTION_LIMIT (default 10) — keep (limit × API processes) under the database's max;
 *  - pool_timeout = 20 s — wait for a free connection instead of failing at once under a burst;
 *  - pgbouncer=true for a Neon "-pooler" host (transaction-mode pooling needs it with Prisma).
 * Migrations use the URL as it is (prisma CLI), so run them with the direct (non-pooler) URL.
 */
export function tunedDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const p = url.searchParams;
  if (!p.has('connection_limit')) p.set('connection_limit', String(Number(process.env['DB_CONNECTION_LIMIT'] ?? 10)));
  if (!p.has('pool_timeout')) p.set('pool_timeout', '20');
  if (url.hostname.includes('-pooler') && !p.has('pgbouncer')) p.set('pgbouncer', 'true');
  return url.toString();
}

/** True when the URL goes through a connection pooler (Neon "-pooler" host or pgbouncer=true). */
export function usesPooler(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.hostname.includes('-pooler') || url.searchParams.get('pgbouncer') === 'true';
  } catch {
    return false;
  }
}
