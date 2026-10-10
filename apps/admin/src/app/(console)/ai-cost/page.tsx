'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, percent, rupees, shortDay } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Row { key: string; calls: number; cost: number }
interface AiCost {
  total: number; messages: number; perMessage: number | null; cachedShare: number;
  byTask: Row[]; byModel: Row[]; byCharacter: Row[];
  series: Array<{ day: string; cost: number; messages: number; perMessage: number | null }>;
  projection: { monthToDate: number; perDay: number; monthEnd: number };
  today: { cost: number; budget: number | null };
  topUsers: Array<{ userId: string; user: string; calls: number; messages: number; cost: number; perMessage: number | null }>;
  failures: { failed: number; calls: number; recent: Array<{ at: string; model: string; task: string; cause: string | null }> };
}

const TASK: Record<string, string> = { chat: 'Chat replies', CHAT_STREAM: 'Chat replies (older records)', profile: 'Memory: profile updates', memory: 'Memory: facts & summaries', embedding: 'Memory: search index', other: 'Other' };
const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 };

function Breakdown({ title, rows, label }: { title: string; rows: Row[]; label?: (k: string) => string }) {
  const max = Math.max(...rows.map((r) => r.cost), 0.0001);
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardBody className="px-0">
        <Table>
          <thead><tr><Th>Name</Th><Th className="text-right">Calls</Th><Th className="text-right">Cost</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><Td colSpan={3} className="text-muted">No AI use yet.</Td></tr>}
            {rows.map((r) => (
              <tr key={r.key}>
                <Td>
                  <span className="block">{label ? label(r.key) : r.key}</span>
                  <span className="mt-1 block h-1 rounded bg-accent/70" style={{ width: `${Math.max(2, (r.cost / max) * 100)}%` }} />
                </Td>
                <Td className="text-right tabular-nums text-muted">{count(r.calls)}</Td>
                <Td className="text-right tabular-nums">{rupees(r.cost, 2)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}

export default function AiCostPage() {
  const [days, setDays] = useState(30);
  const { data: a, dataUpdatedAt, isFetching } = useQuery({ queryKey: ['ai-cost', days], queryFn: () => api<AiCost>(`/console/ai-cost?days=${days}`), refetchInterval: LIVE_MS });
  if (!a) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  const chart = a.series.map((s) => ({ ...s, date: shortDay(s.day) }));
  const over = a.today.budget != null && a.today.cost > a.today.budget;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={cn('rounded-md px-3 py-1.5 text-sm', days === d ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}>
              {d} days
            </button>
          ))}
        </div>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Today</p>
          <p className={`mt-1 text-xl font-semibold ${over ? 'text-bad' : ''}`}>{rupees(a.today.cost, 2)}</p>
          {a.today.budget ? (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${over ? 'bg-bad' : 'bg-good'}`} style={{ width: `${Math.min(100, (a.today.cost / a.today.budget) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">of {rupees(a.today.budget)} daily budget</p>
            </>
          ) : (
            <Link href="/settings" className="text-xs text-accent hover:underline">Set a daily budget</Link>
          )}
        </Card>
        <Card className="p-4"><p className="text-xs text-muted">This month so far</p><p className="mt-1 text-xl font-semibold">{rupees(a.projection.monthToDate)}</p><p className="text-xs text-muted">≈ {rupees(a.projection.perDay)} a day lately</p></Card>
        <Card className="col-span-2 p-4 lg:col-span-1">
          <p className="text-xs text-muted">Month-end estimate</p>
          <p className="mt-1 text-xl font-semibold">{rupees(a.projection.monthEnd)}</p>
          <p className="text-xs text-muted">Your Gemini bill, tests included</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">AI cost (real users)</p><p className="mt-1 text-xl font-semibold">{rupees(a.total)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Per message</p><p className={`mt-1 text-xl font-semibold ${a.perMessage && a.perMessage > 0.3 ? 'text-warn' : ''}`}>{rupees(a.perMessage, 2)}</p><p className="text-xs text-muted">Target ₹0.15 or less</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Messages</p><p className="mt-1 text-xl font-semibold">{count(a.messages)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Cached (cheaper) input</p><p className="mt-1 text-xl font-semibold">{percent(a.cachedShare)}</p><p className="text-xs text-muted">Rises on Gemini's paid tier</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardHeader><CardTitle>Cost per day</CardTitle></CardHeader>
        <CardBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: -4, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" type="category" interval="preserveStartEnd" minTickGap={16} {...axis} />
              <YAxis {...axis} tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupees(v, 2)} />
              {a.today.budget ? <ReferenceLine y={a.today.budget} stroke="var(--bad)" strokeDasharray="4 4" /> : null}
              <Bar isAnimationActive={false} dataKey="cost" name="AI cost" fill="var(--warn)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Cost per message, per day</CardTitle></CardHeader>
        <CardBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ left: -4, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" type="category" interval="preserveStartEnd" minTickGap={16} {...axis} />
              <YAxis {...axis} tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupees(v, 3)} />
              <Line isAnimationActive={false} type="monotone" dataKey="perMessage" name="₹ per message" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By purpose" rows={a.byTask} label={(k) => TASK[k] ?? k} />
        <Breakdown title="By model" rows={a.byModel} />
        <Breakdown title="By character" rows={a.byCharacter} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle>Costliest users</CardTitle><span className="text-xs text-muted">A very high ₹/message can mean abuse or very long chats</span></CardHeader>
          <CardBody className="px-0">
            {a.topUsers.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No AI use yet.</p>
            ) : (
              <Table>
                <thead><tr><Th>User</Th><Th className="text-right">Messages</Th><Th className="text-right">Cost</Th><Th className="text-right">₹/msg</Th></tr></thead>
                <tbody>
                  {a.topUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-surface-2">
                      <Td><Link href={`/users/${u.userId}`} className="hover:text-accent">{u.user}</Link></Td>
                      <Td className="text-right tabular-nums">{count(u.messages)}</Td>
                      <Td className="text-right tabular-nums">{rupees(u.cost, 2)}</Td>
                      <Td className={`text-right tabular-nums ${u.perMessage && u.perMessage > 0.3 ? 'text-warn' : 'text-muted'}`}>{rupees(u.perMessage, 2)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failed AI calls</CardTitle>
            <span className={`text-xs ${a.failures.failed ? 'text-warn' : 'text-muted'}`}>{count(a.failures.failed)} of {count(a.failures.calls)} · {percent(a.failures.calls ? a.failures.failed / a.failures.calls : 0)}</span>
          </CardHeader>
          <CardBody className="px-0">
            {a.failures.recent.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No failures. 👍</p>
            ) : (
              <Table>
                <tbody>
                  {a.failures.recent.map((f, i) => (
                    <tr key={i}>
                      <Td className="whitespace-normal">{TASK[f.task] ?? f.task}<span className="block text-xs text-muted">{f.model}{f.cause && ` · ${f.cause}`}</span></Td>
                      <Td className="text-muted">{ago(f.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
