'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { count, percent, shortDay } from '@/lib/format';

/** Do notifications bring people back? Real users, last 30 days (server: console/notificationStats.service.ts). */

interface Kind { sent: number; failed: number; opened: number; cameBack: number; openRate: number | null; cameBackRate: number | null }
interface Stats {
  permission: { withApp: number; allowed: number; denied: number; uninstalled: number; allowedRate: number | null };
  kinds: Record<'reply' | 'textFirst' | 'campaign' | 'other', Kind>;
  daily: Array<{ day: string; reply: number; textFirst: number; campaign: number; other: number }>;
  textFirst: {
    enabled: boolean;
    dailyBudget: number;
    today: number;
    peopleToday: number;
    characters: Array<{ id: string; name: string; avatarUrl: string | null; sent: number; replied: number; replyRate: number | null }>;
  };
}

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 };

const KINDS: Array<{ key: keyof Stats['kinds']; label: string; hint: string; color: string }> = [
  { key: 'reply', label: 'Replies after they left', hint: 'A character answered after they closed the chat', color: 'var(--accent)' },
  { key: 'textFirst', label: 'Characters texting first', hint: 'A character started the conversation', color: 'var(--accent-2)' },
  { key: 'campaign', label: 'Your campaigns', hint: 'Sent from this screen (tests not counted)', color: 'var(--warn)' },
];

function KindCard({ k, label, hint }: { k: Kind; label: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{count(k.sent)} <span className="text-sm font-normal text-muted">sent</span></p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <span><b className="text-sm">{percent(k.openRate)}</b><span className="block text-muted">opened</span></span>
        <span><b className="text-sm">{percent(k.cameBackRate)}</b><span className="block text-muted">came back to chat</span></span>
      </div>
      <p className="mt-2 text-xs text-muted">{hint}{k.failed ? ` · ${count(k.failed)} failed` : ''}</p>
    </Card>
  );
}

export function NotificationStats() {
  const { data: s, error } = useQuery({ queryKey: ['notification-stats'], queryFn: () => api<Stats>('/console/notifications/stats'), refetchInterval: LIVE_MS });
  if (error) return <Card className="p-4 text-sm text-bad">{(error as Error).message}</Card>;
  if (!s) return <div className="h-32 animate-pulse rounded-xl bg-surface" />;
  const p = s.permission;
  const chart = s.daily.map((d) => ({ ...d, date: shortDay(d.day) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Allow notifications</p>
          <p className="mt-1 text-xl font-semibold">{percent(p.allowedRate)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {count(p.allowed)} of {count(p.withApp)} people with the app{p.denied ? ` · ${count(p.denied)} said no` : ''}{p.uninstalled ? ` · ${count(p.uninstalled)} uninstalled` : ''}
          </p>
        </Card>
        {KINDS.map((k) => (
          <KindCard key={k.key} k={s.kinds[k.key]} label={k.label} hint={k.hint} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle>Notifications sent per day</CardTitle><span className="text-xs text-muted">Last 14 days</span></CardHeader>
          <CardBody className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" minTickGap={16} {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {KINDS.map((k) => (
                  <Bar key={k.key} isAnimationActive={false} dataKey={k.key} name={k.label} stackId="n" fill={k.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Texting first</CardTitle>
            {s.textFirst.enabled ? <Badge tone="good">On</Badge> : <Link href="/settings"><Badge tone="warn">Off — turn on in Settings</Badge></Link>}
          </CardHeader>
          <CardBody className="px-0">
            <p className="px-5 pb-3 text-sm">
              <b>{count(s.textFirst.today)}</b> today to <b>{count(s.textFirst.peopleToday)}</b> {s.textFirst.peopleToday === 1 ? 'person' : 'people'}
              <span className="text-muted"> · up to {s.textFirst.dailyBudget} per person a day</span>
            </p>
            {s.textFirst.characters.length === 0 ? (
              <p className="px-5 pb-2 text-sm text-muted">No character has texted first in the last 30 days.</p>
            ) : (
              <Table>
                <thead><tr><Th>Character</Th><Th className="text-right">Sent</Th><Th className="text-right">Answered</Th></tr></thead>
                <tbody>
                  {s.textFirst.characters.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        <Link href={`/characters/${c.id}`} className="flex items-center gap-2 hover:text-accent">
                          {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full bg-surface-2" />}
                          {c.name}
                        </Link>
                      </Td>
                      <Td className="text-right tabular-nums">{count(c.sent)}</Td>
                      <Td className={`text-right tabular-nums ${c.replyRate != null && c.replyRate < 0.2 && c.sent >= 10 ? 'text-warn' : ''}`}>{percent(c.replyRate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="px-5 pt-2 text-xs text-muted">Answered = they replied within a day. Low numbers mean that character’s first messages need work.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
