/**
 * Restore drill check (read-only): compares row counts of the important tables between the live database and a
 * restored copy (e.g. a Neon branch made from a point in time), so a restore is proven, not assumed.
 *   SOURCE_URL=<live, direct URL> RESTORED_URL=<restored branch URL> npx tsx scripts/maintenance/compareDatabases.ts
 * Only SELECT count(*) — it never writes. Counts can differ slightly if the live database got new rows after the
 * restore point; the report shows the difference per table.
 */
import { PrismaClient } from '@prisma/client';

const TABLES = [
  'users', 'user_profiles', 'conversations', 'messages', 'memories', 'characters', 'character_versions',
  'billing_subscriptions', 'purchase_transactions', 'credit_wallets', 'credit_transactions', 'account_deletion_requests', 'audit_logs',
];

async function counts(url: string): Promise<Record<string, number | string>> {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const out: Record<string, number | string> = {};
  try {
    for (const t of TABLES) {
      try {
        const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*)::bigint AS n FROM "${t}"`);
        out[t] = Number(rows[0]!.n);
      } catch (err) {
        out[t] = `error: ${err instanceof Error ? err.message.split('\n').pop() : 'unknown'}`;
      }
    }
  } finally {
    await db.$disconnect();
  }
  return out;
}

const source = process.env['SOURCE_URL'];
const restored = process.env['RESTORED_URL'];
if (!source || !restored) throw new Error('Set SOURCE_URL and RESTORED_URL.');

const [a, b] = await Promise.all([counts(source), counts(restored)]);
let problems = 0;
console.log('table'.padEnd(28), 'live'.padStart(10), 'restored'.padStart(10), 'diff'.padStart(8));
for (const t of TABLES) {
  const x = a[t]!;
  const y = b[t]!;
  const diff = typeof x === 'number' && typeof y === 'number' ? x - y : NaN;
  if (Number.isNaN(diff) || (typeof x === 'number' && x > 0 && y === 0)) problems++;
  console.log(t.padEnd(28), String(x).padStart(10), String(y).padStart(10), (Number.isNaN(diff) ? '?' : String(diff)).padStart(8));
}
console.log(problems ? `\n✗ ${problems} table(s) missing or empty in the restored copy — the restore is NOT good.` : '\n✓ Every table is present and has data in the restored copy.');
process.exit(problems ? 1 : 0);
