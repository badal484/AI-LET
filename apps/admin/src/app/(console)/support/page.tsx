'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Req { id: string; topic: string; message: string; status: string; reply: string | null; at: string; repliedAt: string | null; userId: string; email: string; name: string | null }

const TOPIC: Record<string, string> = { payment: 'Payment', account: 'Account', bug: 'Something broken', data_copy: 'Copy of my data', delete_data: 'Delete my data', feedback: 'Feedback', other: 'Other' };

/** Ready-made replies: a starting point the admin edits, never sent as-is. */
const TEMPLATES: Array<{ label: string; topics: string[]; text: (name: string) => string }> = [
  {
    label: 'Payment not showing',
    topics: ['payment'],
    text: (n) => `Hi ${n}, sorry about that! Please open the Premium screen in the app and tap “Restore” at the top. If Premium still doesn't show in 10 minutes, reply here with the Google Play order ID (it starts with GPA.) from your payment email and we'll fix it right away.`,
  },
  {
    label: 'Refund',
    topics: ['payment'],
    text: (n) => `Hi ${n}, we're sorry it didn't work out. Payments go through Google Play, so the fastest refund is from play.google.com → Order history → Request a refund. If Google says no, reply here and we'll help.`,
  },
  {
    label: 'Cancel subscription',
    topics: ['payment', 'account'],
    text: (n) => `Hi ${n}, you can cancel any time: Play Store → your profile photo → Payments & subscriptions → Subscriptions → Lovira → Cancel. Premium stays on until the end of the period you paid for.`,
  },
  {
    label: 'Copy of my data',
    topics: ['data_copy'],
    text: (n) => `Hi ${n}, sure! Here is what we keep: your account (email, name), your chats with each character, what the characters remember about you, and your payments. We'll email you a copy within 7 days. You can make characters forget you any time in Profile → Privacy & account.`,
  },
  {
    label: 'Delete my data',
    topics: ['delete_data', 'account'],
    text: (n) => `Hi ${n}, done — we've started deleting your account. Your chats, memories and login are erased within 24 hours. Payment records are kept without your name, as the law requires. Take care 💜`,
  },
  {
    label: 'Bug — thanks',
    topics: ['bug'],
    text: (n) => `Hi ${n}, thank you for telling us! We've found the problem and the fix will be in the next app update. Please keep the app updated from the Play Store.`,
  },
  {
    label: 'Thanks for feedback',
    topics: ['feedback', 'other'],
    text: (n) => `Hi ${n}, thank you so much for writing to us — we read every message and this really helps us make Lovira better 💜`,
  },
];

function Item({ r }: { r: Req }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const send = useMutation({
    mutationFn: (close: boolean) => api(`/console/support/${r.id}/reply`, { method: 'POST', body: JSON.stringify({ reply, close }) }),
    onSuccess: () => { setReply(''); void qc.invalidateQueries({ queryKey: ['support'] }); },
  });
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={r.status === 'open' ? 'warn' : r.status === 'answered' ? 'good' : 'neutral'}>{r.status}</Badge>
        <Badge tone={r.topic === 'delete_data' || r.topic === 'data_copy' || r.topic === 'payment' ? 'accent' : 'neutral'}>{TOPIC[r.topic] ?? r.topic}</Badge>
        <Link href={`/users/${r.userId}`} className="text-sm font-medium hover:text-accent">{r.name ?? r.email}</Link>
        <span className="text-xs text-muted">{ago(r.at)}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{r.message}</p>
      {r.reply && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm"><span className="text-xs text-muted">Your reply · {ago(r.repliedAt)}</span><br />{r.reply}</p>}
      {r.status !== 'closed' && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {[...TEMPLATES].sort((a, b) => Number(b.topics.includes(r.topic)) - Number(a.topics.includes(r.topic))).map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setReply(t.text(r.name?.split(' ')[0] ?? 'there'))}
                className={cn('rounded-full border px-2.5 py-1 text-xs hover:border-accent/60', t.topics.includes(r.topic) ? 'border-accent/40 text-accent' : 'border-border text-muted')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Write a reply — the user sees it in the app under Help." className="w-full rounded-lg border border-border bg-surface p-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
          {send.error && <p className="text-sm text-bad">{(send.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={send.isPending} onClick={() => send.mutate(true)}>{reply ? 'Reply and close' : 'Close'}</Button>
            <Button size="sm" disabled={send.isPending || !reply.trim()} onClick={() => send.mutate(false)}>Send reply</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function SupportPage() {
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['support', status, search],
    queryFn: () => api<Req[]>(`/console/support?status=${status}&search=${encodeURIComponent(search)}`),
    refetchInterval: LIVE_MS,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {['open', 'answered', 'closed', 'all'].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn('rounded-md px-3 py-1.5 text-sm capitalize', status === s ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}>{s}</button>
          ))}
        </div>
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search messages, replies, names or emails" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>
      {data?.length === 0 && <Card className="py-14 text-center text-sm text-muted">No {status === 'all' ? '' : status} requests{search && ` matching “${search}”`}. Messages users send from the app's Help → Contact us appear here.</Card>}
      <div className="space-y-3">{data?.map((r) => <Item key={r.id} r={r} />)}</div>
    </div>
  );
}
