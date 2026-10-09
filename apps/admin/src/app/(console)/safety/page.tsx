'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Modal } from '@/components/ui/modal';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, date } from '@/lib/format';

interface Safety {
  counts: Array<{ kind: string; last24h: number; week: number; open: number }>;
  moments: Array<{ id: string; kind: string; helplineShown: boolean; resolvedAt: string | null; note: string | null; at: string; userId: string; email: string; name: string | null; character: string | null }>;
  reports: Array<{ id: string; reason: string; details: string; status: string; at: string; userId: string; email: string; character: string }>;
  disliked: Array<{ id: string; messageId: string; text: string | null; reason: string | null; at: string; userId: string; email: string; character: string }>;
}

const KIND: Record<string, { label: string; tone: 'bad' | 'warn' | 'neutral' }> = {
  crisis: { label: 'Crisis (self-harm)', tone: 'bad' },
  emergency: { label: 'Medical emergency', tone: 'bad' },
  eating: { label: 'Eating problems', tone: 'warn' },
  boundary: { label: 'Sexual boundary', tone: 'warn' },
  minor: { label: 'Said under 18', tone: 'warn' },
};

export default function SafetyPage() {
  const qc = useQueryClient();
  const { data: s, dataUpdatedAt, isFetching } = useQuery({ queryKey: ['safety'], queryFn: () => api<Safety>('/console/safety'), refetchInterval: LIVE_MS });
  const [review, setReview] = useState<{ momentId?: string; messageId?: string; title: string } | null>(null);
  const [reason, setReason] = useState('');
  const [chat, setChat] = useState<Array<{ id: string; role: string; content: string; createdAt: string }> | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['safety'] });

  const resolve = useMutation({ mutationFn: (id: string) => api(`/console/safety/moments/${id}/resolve`, { method: 'POST', body: JSON.stringify({ note: 'Reviewed' }) }), onSuccess: refresh });
  const report = useMutation({ mutationFn: (v: { id: string; status: string }) => api(`/console/safety/reports/${v.id}/status`, { method: 'POST', body: JSON.stringify({ status: v.status }) }), onSuccess: refresh });
  const open = useMutation({
    mutationFn: () => api<{ messages: Array<{ id: string; role: string; content: string; createdAt: string }> }>('/console/safety/review', { method: 'POST', body: JSON.stringify({ momentId: review?.momentId, messageId: review?.messageId, reason }) }),
    onSuccess: (d) => setChat(d.messages),
  });

  if (!s) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  const byKind = (k: string) => s.counts.find((c) => c.kind === k);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">Chats are private. A chat opens here only for a safety review, shows just the messages around the moment, and every opening is saved in the audit log.</p>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Object.entries(KIND).map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs text-muted">{v.label}</p>
            <p className={`mt-1 text-xl font-semibold ${(byKind(k)?.open ?? 0) > 0 && v.tone === 'bad' ? 'text-bad' : ''}`}>{count(byKind(k)?.last24h ?? 0)} <span className="text-sm font-normal text-muted">today</span></p>
            <p className="text-xs text-muted">{count(byKind(k)?.week ?? 0)} this week · {count(byKind(k)?.open ?? 0)} to review</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Safety moments</CardTitle><span className="text-xs text-muted">Newest first, unreviewed on top</span></CardHeader>
        <CardBody className="px-0">
          <Table>
            <thead><tr><Th>What</Th><Th>User</Th><Th>Character</Th><Th>Helpline shown</Th><Th>When</Th><Th /></tr></thead>
            <tbody>
              {s.moments.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">Nothing yet. Crisis, emergency, eating, boundary and under-18 moments will show here as they happen.</Td></tr>}
              {s.moments.map((m) => (
                <tr key={m.id} className={m.resolvedAt ? 'opacity-60' : ''}>
                  <Td><Badge tone={KIND[m.kind]?.tone ?? 'neutral'}>{KIND[m.kind]?.label ?? m.kind}</Badge></Td>
                  <Td><Link href={`/users/${m.userId}`} className="hover:text-accent">{m.name ?? m.email}</Link></Td>
                  <Td className="text-muted">{m.character ?? '—'}</Td>
                  <Td>{m.helplineShown ? <Badge tone="good">Yes</Badge> : <span className="text-muted">—</span>}</Td>
                  <Td className="text-muted">{ago(m.at)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setChat(null); setReason(''); setReview({ momentId: m.id, title: KIND[m.kind]?.label ?? m.kind }); }}>Review chat</Button>
                      {!m.resolvedAt && <Button size="sm" variant="secondary" onClick={() => resolve.mutate(m.id)}>Mark reviewed</Button>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Reports from users</CardTitle></CardHeader>
          <CardBody className="px-0">
            <Table>
              <tbody>
                {s.reports.length === 0 && <tr><Td className="py-6 text-center text-muted">No reports.</Td></tr>}
                {s.reports.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-normal">
                      <div className="flex items-center gap-2"><Badge tone={r.status === 'open' ? 'warn' : 'neutral'}>{r.status}</Badge><span className="font-medium">{r.character}</span><span className="text-xs text-muted">{r.reason.toLowerCase().replace(/_/g, ' ')}</span></div>
                      {r.details && <p className="mt-1 text-sm text-muted">{r.details}</p>}
                      <p className="mt-1 text-xs text-muted">{r.email} · {ago(r.at)}</p>
                    </Td>
                    <Td className="text-right">
                      {r.status === 'open' && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => report.mutate({ id: r.id, status: 'actioned' })}>Actioned</Button>
                          <Button size="sm" variant="ghost" onClick={() => report.mutate({ id: r.id, status: 'dismissed' })}>Dismiss</Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Replies users disliked 👎</CardTitle></CardHeader>
          <CardBody className="px-0">
            <Table>
              <tbody>
                {s.disliked.length === 0 && <tr><Td className="py-6 text-center text-muted">No disliked replies.</Td></tr>}
                {s.disliked.map((f) => (
                  <tr key={f.id}>
                    <Td className="whitespace-normal">
                      <span className="font-medium">{f.character}</span>
                      {f.text && <p className="mt-1 text-sm text-muted">“{f.text}”</p>}
                      <p className="mt-1 text-xs text-muted">{f.email} · {ago(f.at)}</p>
                    </Td>
                    <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => { setChat(null); setReason(''); setReview({ messageId: f.messageId, title: `Disliked reply — ${f.character}` }); }}>Review</Button></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Modal open={review !== null} onClose={() => setReview(null)} title={review?.title ?? ''}>
        {!chat ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); open.mutate(); }}>
            <p className="text-sm text-muted">This opens a private chat. Say why — it's saved in the audit log with your name.</p>
            <Input required placeholder="Reason, e.g. checking the crisis reply was right" value={reason} onChange={(e) => setReason(e.target.value)} />
            {open.error && <p className="text-sm text-bad">{(open.error as Error).message}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setReview(null)}>Cancel</Button><Button type="submit" disabled={open.isPending}>Open chat</Button></div>
          </form>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {chat.map((m) => (
              <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-8 bg-accent-soft' : 'mr-8 bg-surface-2'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className="mt-1 text-[11px] text-muted">{m.role === 'user' ? 'User' : 'Character'} · {date(m.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
