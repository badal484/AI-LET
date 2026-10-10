'use client';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Live, LIVE_MS } from '@/components/ui/live';
import { api } from '@/lib/api';
import { ago, count, percent, rupees, shortDay } from '@/lib/format';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface Kpis { activeUsers: number; newUsers: number; messages: number; revenue: number; aiCost: number; aiCostPerMessage: number | null }
interface Overview {
  today: Kpis;
  week: Kpis;
  subscribers: { trialing: number; paying: number; cancelling: number };
  trialToPaid: { started: number; converted: number; rate: number | null };
  series: Array<{ day: string; messages: number; activeUsers: number; revenue: number; aiCost: number }>;
  funnel: { signedUp: number; onboarded: number; firstMessage: number; cameBack: number };
  returning: Array<{ after: number; eligible: number; returned: number }>;
  topCharacters: Array<{ id: string; name: string; avatarUrl: string; messages: number; users: number }>;
  newest: Array<{ id: string; name: string | null; email: string; joined: string; onboarded: boolean; messages: number }>;
  attention: { support: number; safety: number; failedReplies: number; aiOverBudget: boolean };
}

/** The "needs you" strip: only what's non-zero, each one a link to where it's handled. */
function Attention({ a }: { a: Overview['attention'] }) {
  const items = [
    a.safety > 0 && { href: '/safety', text: `${a.safety} safety moment${a.safety > 1 ? 's' : ''} to review`, tone: 'bad' },
    a.support > 0 && { href: '/support', text: `${a.support} support request${a.support > 1 ? 's' : ''} waiting`, tone: 'warn' },
    a.failedReplies > 0 && { href: '/system', text: `${a.failedReplies} replies failed in 24 h`, tone: 'warn' },
    a.aiOverBudget && { href: '/ai-cost', text: "Today's AI spend is over budget", tone: 'warn' },
  ].filter(Boolean) as Array<{ href: string; text: string; tone: 'bad' | 'warn' }>;
  if (!items.length) return <p className="flex items-center gap-2 text-sm text-good"><CheckCircle2 size={16} /> Nothing needs you right now.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${i.tone === 'bad' ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'} hover:opacity-80`}>
          <AlertTriangle size={16} /> {i.text} →
        </Link>
      ))}
    </div>
  );
}

function Funnel({ f }: { f: Overview['funnel'] }) {
  const steps = [
    { label: 'Signed up', n: f.signedUp },
    { label: 'Finished onboarding', n: f.onboarded },
    { label: 'Sent a first message', n: f.firstMessage },
    { label: 'Came back another day', n: f.cameBack },
  ];
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const share = f.signedUp ? s.n / f.signedUp : 0;
        const prev = i > 0 ? steps[i - 1]!.n : null;
        return (
          <div key={s.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{s.label}</span>
              <span className="tabular-nums text-muted">
                <span className="font-medium text-text">{count(s.n)}</span> · {percent(share)}
                {prev != null && prev > s.n && <span className="ml-2 text-xs text-bad">−{count(prev - s.n)} lost</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(share * 100, s.n ? 2 : 0)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const { data, isLoading, error, dataUpdatedAt, isFetching } = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/console/overview'), refetchInterval: LIVE_MS });

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

  const { today, week, subscribers, trialToPaid, series, funnel, returning, topCharacters, newest, attention } = data;
  const margin = week.revenue - week.aiCost;
  const chart = series.map((s) => ({ ...s, date: shortDay(s.day) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Attention a={attention} />
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>
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

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
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

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Where new users drop off</CardTitle>
            <span className="text-xs text-muted">Sign-ups, last 30 days</span>
          </CardHeader>
          <CardBody><Funnel f={funnel} /></CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Do they come back?</CardTitle>
            <span className="text-xs text-muted">Joined in the last 90 days</span>
          </CardHeader>
          <CardBody className="grid grid-cols-3 gap-3">
            {returning.map((r) => (
              <div key={r.after} className="rounded-lg bg-surface-2 p-4 text-center">
                <p className="text-2xl font-semibold tabular-nums">{r.eligible ? percent(r.returned / r.eligible) : '—'}</p>
                <p className="mt-1 text-xs text-muted">still chatting after {r.after} day{r.after > 1 ? 's' : ''}</p>
                <p className="text-xs text-muted">{count(r.returned)} of {count(r.eligible)}</p>
              </div>
            ))}
            <p className="col-span-3 text-xs text-muted">A healthy chat app keeps 40%+ after 1 day and 20%+ after 7 days.</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle>Top characters today</CardTitle></CardHeader>
          <CardBody className="px-0">
            {topCharacters.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No messages yet today.</p>
            ) : (
              <ul className="divide-y divide-border">
                {topCharacters.map((c, i) => (
                  <li key={c.id}>
                    <Link href={`/characters/${c.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-surface-2">
                      <span className="w-4 text-muted">{i + 1}</span>
                      <img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      <span className="flex-1">{c.name}</span>
                      <span className="tabular-nums text-muted">{count(c.messages)} msgs · {count(c.users)} users</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Newest sign-ups</CardTitle>
            <Link href="/users?filter=new" className="text-xs text-accent hover:underline">All users</Link>
          </CardHeader>
          <CardBody className="px-0">
            {newest.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No sign-ups yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {newest.map((u) => (
                  <li key={u.id}>
                    <Link href={`/users/${u.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-surface-2">
                      <span className="min-w-0">
                        <span className="block truncate">{u.name ?? 'No name'}{!u.onboarded && <span className="ml-2 text-xs text-warn">no onboarding</span>}</span>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted">{count(u.messages)} msgs<span className="block">{ago(u.joined)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
