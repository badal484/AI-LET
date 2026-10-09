'use client';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { count, percent, rupees, shortDay } from '@/lib/format';

interface Kpis { activeUsers: number; newUsers: number; messages: number; revenue: number; aiCost: number; aiCostPerMessage: number | null }
interface Overview {
  today: Kpis;
  week: Kpis;
  subscribers: { trialing: number; paying: number; cancelling: number };
  trialToPaid: { started: number; converted: number; rate: number | null };
  series: Array<{ day: string; messages: number; activeUsers: number; revenue: number; aiCost: number }>;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 };

export default function OverviewPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/console/overview'), refetchInterval: 60_000 });

  if (error) return <Card className="p-6 text-sm text-bad">Could not load the overview: {(error as Error).message}</Card>;
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const { today, week, subscribers, trialToPaid, series } = data;
  const margin = week.revenue - week.aiCost;
  const chart = series.map((s) => ({ ...s, date: shortDay(s.day) }));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Today</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Active users" value={count(today.activeUsers)} sub={`${count(today.newUsers)} new today`} />
          <Stat label="Messages" value={count(today.messages)} sub={`${count(week.messages)} in 7 days`} />
          <Stat label="Revenue" value={rupees(today.revenue)} sub={`${rupees(week.revenue)} in 7 days`} />
          <Stat
            label="AI cost"
            value={rupees(today.aiCost)}
            sub={`${rupees(today.aiCostPerMessage, 2)} per message`}
            tone={today.aiCostPerMessage != null && today.aiCostPerMessage > 0.3 ? 'warn' : undefined}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">Subscribers</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Paying" value={count(subscribers.paying)} />
          <Stat label="In ₹1 trial" value={count(subscribers.trialing)} />
          <Stat label="Trial → paid" value={percent(trialToPaid.rate)} sub={`${count(trialToPaid.converted)} of ${count(trialToPaid.started)} trials (last 30 days)`} />
          <Stat
            label="Cancelling"
            value={count(subscribers.cancelling)}
            sub="Still active until their period ends"
            tone={subscribers.cancelling > 0 ? 'warn' : undefined}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Messages and active users</CardTitle>
            <span className="text-xs text-muted">Last 14 days</span>
          </CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: -16, right: -16, top: 8 }}>
                <defs>
                  <linearGradient id="msg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" type="category" interval="preserveStartEnd" minTickGap={12} {...axis} />
                <YAxis yAxisId="msgs" {...axis} allowDecimals={false} />
                <YAxis yAxisId="users" orientation="right" {...axis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Area isAnimationActive={false} yAxisId="msgs" type="monotone" dataKey="messages" name="Messages" stroke="var(--accent)" fill="url(#msg)" strokeWidth={2} />
                <Area isAnimationActive={false} yAxisId="users" type="monotone" dataKey="activeUsers" name="Active users" stroke="var(--accent-2)" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue vs AI cost</CardTitle>
            <span className={`text-xs ${margin < 0 ? 'text-bad' : 'text-muted'}`}>7-day margin {rupees(margin)}</span>
          </CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" type="category" interval="preserveStartEnd" minTickGap={12} {...axis} />
                <YAxis {...axis} tickFormatter={(v) => `₹${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => rupees(v, 2)} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                <Bar isAnimationActive={false} dataKey="revenue" name="Revenue" fill="var(--good)" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="aiCost" name="AI cost" fill="var(--warn)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
