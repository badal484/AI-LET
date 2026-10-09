'use client';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, percent, rupees, shortDay } from '@/lib/format';

interface Money {
  revenue: { today: number; week: number; month: number; allTime: number };
  series: Array<{ day: string; revenue: number; subscriptions: number; packs: number }>;
  subscribers: { paying: number; trialing: number; cancelling: number; freeByAdmin: number };
  trials: { started30d: number; converted: number; cancelled30d: number };
  packsSold30d: number;
  recent: Array<{ id: string; userId: string; email: string; product: string; amount: number; status: string; at: string }>;
  limits: { enforced: boolean; freeDaily: number; premiumDaily: number };
}

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 };

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card className="p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className="mt-1 text-xl font-semibold">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
  </Card>
);

export default function MoneyPage() {
  const { data: m, dataUpdatedAt, isFetching, error } = useQuery({ queryKey: ['money'], queryFn: () => api<Money>('/console/money'), refetchInterval: LIVE_MS });
  if (error) return <Card className="p-6 text-sm text-bad">{(error as Error).message}</Card>;
  if (!m) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  const chart = m.series.map((s) => ({ ...s, date: shortDay(s.day) }));
  const conv = m.trials.started30d ? m.trials.converted / m.trials.started30d : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/api/v1/admin/console/money/transactions.csv" className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface-2 px-3 text-sm hover:bg-border">
          <Download size={16} /> Download all transactions (CSV)
        </a>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue today" value={rupees(m.revenue.today)} />
        <Stat label="Last 7 days" value={rupees(m.revenue.week)} />
        <Stat label="Last 30 days" value={rupees(m.revenue.month)} />
        <Stat label="All time" value={rupees(m.revenue.allTime)} sub="Before Google's fee and GST" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Paying subscribers" value={count(m.subscribers.paying)} sub={m.subscribers.freeByAdmin ? `+${m.subscribers.freeByAdmin} given free by admin` : undefined} />
        <Stat label="In ₹1 trial" value={count(m.subscribers.trialing)} sub={`${count(m.trials.started30d)} trials started in 30 days`} />
        <Stat label="Trial → paid" value={percent(conv)} sub={`${count(m.trials.converted)} converted`} />
        <Stat label="Message packs sold" value={count(m.packsSold30d)} sub="Last 30 days" />
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue per day</CardTitle><span className="text-xs text-muted">Last 30 days</span></CardHeader>
        <CardBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: -8, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" type="category" interval="preserveStartEnd" minTickGap={16} {...axis} />
              <YAxis {...axis} tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupees(v)} />
              <Bar isAnimationActive={false} dataKey="revenue" name="Revenue" fill="var(--good)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Latest payments</CardTitle></CardHeader>
          <CardBody className="px-0">
            <Table>
              <thead><tr><Th>User</Th><Th>Product</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>When</Th></tr></thead>
              <tbody>
                {m.recent.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-muted">No payments yet. They'll appear here the moment someone buys.</Td></tr>}
                {m.recent.map((t) => (
                  <tr key={t.id}>
                    <Td><Link href={`/users/${t.userId}`} className="hover:text-accent">{t.email}</Link></Td>
                    <Td className="text-muted">{t.product}</Td>
                    <Td className="text-right tabular-nums">{rupees(t.amount)}</Td>
                    <Td><Badge tone={t.status === 'SUCCEEDED' ? 'good' : t.status === 'REFUNDED' ? 'warn' : 'bad'}>{t.status.toLowerCase()}</Badge></Td>
                    <Td className="text-muted">{ago(t.at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Message limits</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted">Limits</span>{m.limits.enforced ? <Badge tone="good">On</Badge> : <Badge tone="warn">Off (everyone unlimited)</Badge>}</div>
            <div className="flex items-center justify-between"><span className="text-muted">Free users / day</span><span className="font-medium">{m.limits.freeDaily}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted">Premium / day (fair use)</span><span className="font-medium">{m.limits.premiumDaily}</span></div>
            <p className="pt-2 text-xs text-muted">Crisis and emergency messages are never limited. You'll be able to change these from Settings.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
