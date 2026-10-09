'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { count, percent, rupees, shortDay } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Row { key: string; calls: number; cost: number }
interface AiCost {
  total: number; messages: number; perMessage: number | null; cachedShare: number;
  byTask: Row[]; byModel: Row[]; byCharacter: Row[];
  series: Array<{ day: string; cost: number; messages: number; perMessage: number | null }>;
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">AI cost</p><p className="mt-1 text-xl font-semibold">{rupees(a.total)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Per message</p><p className={`mt-1 text-xl font-semibold ${a.perMessage && a.perMessage > 0.3 ? 'text-warn' : ''}`}>{rupees(a.perMessage, 2)}</p><p className="text-xs text-muted">Target ₹0.15 or less</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Messages</p><p className="mt-1 text-xl font-semibold">{count(a.messages)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Cached (cheaper) input</p><p className="mt-1 text-xl font-semibold">{percent(a.cachedShare)}</p><p className="text-xs text-muted">Rises on Gemini's paid tier</p></Card>
      </div>

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By purpose" rows={a.byTask} label={(k) => TASK[k] ?? k} />
        <Breakdown title="By model" rows={a.byModel} />
        <Breakdown title="By character" rows={a.byCharacter} />
      </div>
    </div>
  );
}
