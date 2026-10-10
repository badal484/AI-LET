'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChatReview, type ReviewTarget } from '@/components/ChatReview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, percent, rupees, shortDay } from '@/lib/format';
import { STAGE } from '@/lib/labels';

interface CharacterDetail {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  category: string;
  status: string;
  isFeatured: boolean;
  createdAt: string;
  totals: { users: number; users7d: number; messages: number; perUser: number | null };
  returning: { talked: number; returned: number };
  stages: Array<{ stage: string; n: number }>;
  ratings: { likes: number; dislikes: number };
  disliked: Array<{ messageId: string; reason: string | null; text: string | null; at: string }>;
  topUsers: Array<{ userId: string; name: string | null; email: string; messages: number; lastAt: string }>;
  cost: { last30d: number; perMessage: number | null };
  series: Array<{ day: string; messages: number; users: number }>;
}

const STAGE_ORDER = ['STRANGER', 'ACQUAINTANCE', 'FRIEND', 'CLOSE_FRIEND', 'CONFIDANT', 'ROMANTIC_PARTNER'];
const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 };

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export default function CharacterPage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<ReviewTarget | null>(null);
  const { data: c, error, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['character', id],
    queryFn: () => api<CharacterDetail>(`/console/characters/${id}`),
    refetchInterval: LIVE_MS,
  });

  if (error) return <Card className="p-6 text-sm text-bad">{(error as Error).message}</Card>;
  if (!c) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;

  const rated = c.ratings.likes + c.ratings.dislikes;
  const chart = c.series.map((d) => ({ ...d, date: shortDay(d.day) }));
  const stageTotal = c.stages.reduce((t, s) => t + s.n, 0);
  const stages = [...c.stages].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/characters" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft size={16} /> Characters
        </Link>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <img src={c.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{c.name}</h2>
          <p className="text-sm text-muted">{c.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={c.status === 'PUBLISHED' ? 'good' : 'neutral'}>{c.status === 'PUBLISHED' ? 'Live' : 'Off'}</Badge>
            {c.isFeatured && <Badge tone="accent">Featured</Badge>}
            <Badge className="capitalize">{c.category.replace(/[-_]/g, ' ')}</Badge>
          </div>
        </div>
        <Link href="/characters">
          <Button variant="secondary" size="sm">Edit photos and name</Button>
        </Link>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Users" value={count(c.totals.users)} sub={`${count(c.totals.users7d)} in the last 7 days`} />
        <Stat label="Their messages" value={count(c.totals.messages)} sub={c.totals.perUser != null ? `${c.totals.perUser.toFixed(1)} per user` : undefined} />
        <Stat
          label="Came back another day"
          value={c.returning.talked ? percent(c.returning.returned / c.returning.talked) : '—'}
          sub={`${count(c.returning.returned)} of ${count(c.returning.talked)}`}
        />
        <Stat label="Replies liked" value={rated ? percent(c.ratings.likes / rated) : '—'} sub={`👍 ${c.ratings.likes} · 👎 ${c.ratings.dislikes}`} />
        <Stat label="AI cost, 30 days" value={rupees(c.cost.last30d)} />
        <Stat label="Cost per message" value={rupees(c.cost.perMessage, 2)} sub="Target ₹0.15 or less" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages and users per day</CardTitle>
          <span className="text-xs text-muted">Last 30 days</span>
        </CardHeader>
        <CardBody className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ left: -16, right: -16, top: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" type="category" interval="preserveStartEnd" minTickGap={16} {...axis} />
              <YAxis yAxisId="m" allowDecimals={false} {...axis} />
              <YAxis yAxisId="u" orientation="right" allowDecimals={false} {...axis} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
              <Area isAnimationActive={false} yAxisId="m" type="monotone" dataKey="messages" name="Messages" stroke="var(--accent)" fill="var(--accent-soft)" strokeWidth={2} />
              <Area isAnimationActive={false} yAxisId="u" type="monotone" dataKey="users" name="Users" stroke="var(--accent-2)" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle>How close users are</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {stages.length === 0 && <p className="text-sm text-muted">Nobody yet.</p>}
            {stages.map((s) => (
              <div key={s.stage}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{STAGE[s.stage] ?? s.stage}</span>
                  <span className="tabular-nums text-muted">{count(s.n)} · {percent(stageTotal ? s.n / stageTotal : 0)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${stageTotal ? (s.n / stageTotal) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Who talks to them most</CardTitle></CardHeader>
          <CardBody className="px-0">
            {c.topUsers.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">Nobody yet.</p>
            ) : (
              <Table>
                <thead><tr><Th>User</Th><Th className="text-right">Messages</Th><Th>Last chat</Th></tr></thead>
                <tbody>
                  {c.topUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-surface-2">
                      <Td><Link href={`/users/${u.userId}`} className="hover:text-accent">{u.name ?? u.email}</Link></Td>
                      <Td className="text-right tabular-nums">{count(u.messages)}</Td>
                      <Td className="text-muted">{ago(u.lastAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Replies users disliked 👎</CardTitle>
          <span className="text-xs text-muted">Open one to see what went wrong (saved in the audit log)</span>
        </CardHeader>
        <CardBody className="px-0">
          {c.disliked.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">No disliked replies. 🎉</p>
          ) : (
            <Table>
              <tbody>
                {c.disliked.map((d) => (
                  <tr key={d.messageId}>
                    <Td className="whitespace-normal">
                      {d.text ? `“${d.text}”` : <span className="text-muted">No comment</span>}
                      {d.reason && <span className="ml-2 text-xs text-muted">{d.reason}</span>}
                    </Td>
                    <Td className="text-muted">{ago(d.at)}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setReview({ messageId: d.messageId, title: `Disliked reply — ${c.name}` })}>Review</Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <ChatReview target={review} onClose={() => setReview(null)} />
    </div>
  );
}
