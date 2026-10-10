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
import { ago, count, date, percent, rupees, shortDay } from '@/lib/format';

interface Money {
  revenue: { today: number; week: number; month: number; allTime: number };
  series: Array<{ day: string; revenue: number; subscriptions: number; packs: number }>;
  subscribers: { paying: number; trialing: number; cancelling: number; freeByAdmin: number };
  trials: { started30d: number; converted: number; cancelled30d: number };
  packsSold30d: number;
  recent: Array<{ id: string; userId: string; email: string; product: string; amount: number; status: string; at: string }>;
  limits: { enforced: boolean; freeDaily: number; premiumDaily: number };
  mrr: { monthly: number; subscriptions: number };
  keep30d: number;
  byProduct: Array<{ product: string; sales: number; revenue: number }>;
  renewals: Person[];
  trouble: Person[];
  cancellations: Person[];
  refunds: Array<{ userId: string; user: string; product: string; amount: number; reason: string | null; at: string }>;
}
type Person = { userId: string; user: string; plan: string; interval: string | null; amount: number | null; at: string };

const PRODUCT: Record<string, string> = {
  'companion_premium:weekly': 'Premium · weekly',
  'companion_premium:monthly': 'Premium · monthly',
  'companion_premium:yearly': 'Premium · yearly',
  companion_premium: 'Premium',
};
const productName = (p: string) => PRODUCT[p] ?? (p.startsWith('messages') ? `Message pack (${p.replace(/^messages[_-]?/, '') || 'extra'})` : p);
const INTERVAL: Record<string, string> = { WEEK: 'weekly', MONTH: 'monthly', YEAR: 'yearly' };
const STATUS: Record<string, string> = { GRACE_PERIOD: 'Card failed — Google retrying', PAST_DUE: 'Payment overdue', PAYMENT_FAILED: 'Payment failed', PAUSED: 'Paused' };

/** One small list of people (renewing, payment trouble, cancelling). */
function People({ title, hint, rows, empty, when }: { title: string; hint: string; rows: Person[]; empty: string; when: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><span className="text-xs text-muted">{hint}</span></CardHeader>
      <CardBody className="px-0">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted">{empty}</p>
        ) : (
          <Table>
            <thead><tr><Th>User</Th><Th>Plan</Th><Th className="text-right">Amount</Th><Th>{when}</Th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.userId}-${i}`} className="hover:bg-surface-2">
                  <Td><Link href={`/users/${r.userId}`} className="hover:text-accent">{r.user}</Link></Td>
                  <Td className="text-muted">{r.plan}{r.interval && ` · ${INTERVAL[r.interval] ?? STATUS[r.interval] ?? r.interval.toLowerCase()}`}</Td>
                  <Td className="text-right tabular-nums">{rupees(r.amount)}</Td>
                  <Td className="text-muted">{date(r.at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Monthly recurring" value={rupees(m.mrr.monthly)} sub={`${count(m.mrr.subscriptions)} subscription${m.mrr.subscriptions === 1 ? '' : 's'} renewing`} />
        <Stat label="Revenue today" value={rupees(m.revenue.today)} />
        <Stat label="Last 7 days" value={rupees(m.revenue.week)} />
        <Stat label="Last 30 days" value={rupees(m.revenue.month)} sub={`≈ ${rupees(m.keep30d)} yours`} />
        <Stat label="All time" value={rupees(m.revenue.allTime)} sub="Before Google's fee and GST" />
        <Stat label="You keep" value="≈ 72%" sub="After 18% GST and Google's 15%" />
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

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle>Revenue by plan</CardTitle><span className="text-xs text-muted">Last 30 days</span></CardHeader>
          <CardBody className="px-0">
            {m.byProduct.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No sales in the last 30 days.</p>
            ) : (
              <Table>
                <thead><tr><Th>Plan</Th><Th className="text-right">Sales</Th><Th className="text-right">Revenue</Th><Th className="text-right">Share</Th></tr></thead>
                <tbody>
                  {m.byProduct.map((p) => (
                    <tr key={p.product}>
                      <Td>{productName(p.product)}</Td>
                      <Td className="text-right tabular-nums">{count(p.sales)}</Td>
                      <Td className="text-right tabular-nums">{rupees(p.revenue)}</Td>
                      <Td className="text-right tabular-nums text-muted">{percent(m.revenue.month ? p.revenue / m.revenue.month : null)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
        <People title="Renewing this week" hint="Next 7 days" rows={m.renewals} empty="No renewals in the next 7 days." when="Renews" />
        <People title="Payment trouble" hint="Google is retrying their card" rows={m.trouble} empty="Nobody has a failed payment. 👍" when="Access until" />
        <People title="Cancelled" hint="Last 30 days, or ending soon" rows={m.cancellations} empty="No cancellations." when="When" />
        <Card>
          <CardHeader><CardTitle>Refunds</CardTitle><span className="text-xs text-muted">Last 90 days</span></CardHeader>
          <CardBody className="px-0">
            {m.refunds.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No refunds.</p>
            ) : (
              <Table>
                <tbody>
                  {m.refunds.map((r, i) => (
                    <tr key={`${r.userId}-${i}`}>
                      <Td><Link href={`/users/${r.userId}`} className="hover:text-accent">{r.user}</Link><span className="block text-xs text-muted">{productName(r.product)}{r.reason && ` · ${r.reason}`}</span></Td>
                      <Td className="text-right tabular-nums">{rupees(r.amount)}</Td>
                      <Td className="text-muted">{date(r.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
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
                    <Td className="text-muted">{productName(t.product)}</Td>
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
            <p className="pt-2 text-xs text-muted">Crisis and emergency messages are never limited. Change them in Settings.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
