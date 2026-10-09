'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Req { id: string; topic: string; message: string; status: string; reply: string | null; at: string; repliedAt: string | null; userId: string; email: string; name: string | null }

const TOPIC: Record<string, string> = { payment: 'Payment', account: 'Account', bug: 'Something broken', delete_data: 'Delete my data', feedback: 'Feedback', other: 'Other' };

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
        <Badge tone={r.topic === 'delete_data' || r.topic === 'payment' ? 'accent' : 'neutral'}>{TOPIC[r.topic] ?? r.topic}</Badge>
        <Link href={`/users/${r.userId}`} className="text-sm font-medium hover:text-accent">{r.name ?? r.email}</Link>
        <span className="text-xs text-muted">{ago(r.at)}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{r.message}</p>
      {r.reply && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm"><span className="text-xs text-muted">Your reply · {ago(r.repliedAt)}</span><br />{r.reply}</p>}
      {r.status !== 'closed' && (
        <div className="mt-3 space-y-2">
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
  const { data, dataUpdatedAt, isFetching } = useQuery({ queryKey: ['support', status], queryFn: () => api<Req[]>(`/console/support?status=${status}`), refetchInterval: LIVE_MS });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {['open', 'answered', 'closed', 'all'].map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn('rounded-md px-3 py-1.5 text-sm capitalize', status === s ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}>{s}</button>
          ))}
        </div>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>
      {data?.length === 0 && <Card className="py-14 text-center text-sm text-muted">No {status === 'all' ? '' : status} requests. Messages users send from the app's Help → Contact us appear here.</Card>}
      <div className="space-y-3">{data?.map((r) => <Item key={r.id} r={r} />)}</div>
    </div>
  );
}
