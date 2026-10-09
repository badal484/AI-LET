/**
 * What the AI really costs: from ai_usage_events (every Gemini call, see aiCostLedger.ts).
 *
 *   npx tsx scripts/costReport.ts            last 7 days, real users only
 *   npx tsx scripts/costReport.ts 1 --all    last day, including eval/test users
 *
 * INR_PER_USD (default 88) converts. Prices in aiCostLedger.ts are estimates — update them from Google's page.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const days = Number(process.argv[2] ?? 7);
const includeAll = process.argv.includes('--all');
const INR = Number(process.env['INR_PER_USD'] ?? 88);
const since = new Date(Date.now() - days * 86_400_000);
const userFilter = includeAll ? '' : `AND (u.email IS NULL OR (u.email NOT LIKE 'eval_%' AND u.email NOT LIKE '%@test.local'))`;

const rupees = (usd: number) => `₹${(usd * INR).toFixed(usd * INR < 10 ? 3 : 0)}`;

const totals = await p.$queryRawUnsafe<Array<{ task: string; model: string; calls: number; input: number; cached: number; output: number; cost: number }>>(
  `SELECT e.task, e.model, count(*)::int calls, sum(e.input_tokens)::int input, sum(e.cached_tokens)::int cached,
          sum(e.output_tokens)::int output, sum(e.estimated_cost)::float cost
     FROM ai_usage_events e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.provider = 'google' AND e.created_at >= $1 ${userFilter}
    GROUP BY 1, 2 ORDER BY cost DESC`,
  since,
);
const [msgs] = await p.$queryRawUnsafe<Array<{ messages: number; userDays: number }>>(
  `SELECT count(*)::int messages, count(DISTINCT (c.user_id, date(m.created_at)))::int "userDays"
     FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id
    WHERE m.role = 'user' AND m.created_at >= $1 ${userFilter}`,
  since,
);

const total = totals.reduce((a, r) => a + r.cost, 0);
const input = totals.reduce((a, r) => a + r.input, 0);
const cached = totals.reduce((a, r) => a + r.cached, 0);
console.log(`\nAI cost, last ${days} day(s)${includeAll ? ' (all users)' : ' (real users)'} — ₹${INR}/$\n`);
console.log('task        model                          calls    input(k)  cached%  output(k)   cost');
for (const r of totals)
  console.log(
    `${r.task.padEnd(11)} ${r.model.padEnd(30)} ${String(r.calls).padStart(5)} ${String(Math.round(r.input / 1000)).padStart(10)} ${String(r.input ? Math.round((100 * r.cached) / r.input) : 0).padStart(7)}% ${String(Math.round(r.output / 1000)).padStart(9)}   ${rupees(r.cost)}`,
  );
console.log(`\nTotal: ${rupees(total)} ($${total.toFixed(4)})   cached share of input: ${input ? Math.round((100 * cached) / input) : 0}%`);
if (msgs && msgs.messages) {
  console.log(`User messages: ${msgs.messages}  →  cost per message: ${rupees(total / msgs.messages)}`);
  console.log(`Active user-days: ${msgs.userDays}  →  cost per user per day: ${rupees(total / msgs.userDays)}  (≈ ${rupees((30 * total) / msgs.userDays)} a month if they chat daily)`);
}
await p.$disconnect();
