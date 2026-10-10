'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count } from '@/lib/format';
import { ChatReview, type ReviewTarget } from '@/components/ChatReview';

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
  const [review, setReview] = useState<ReviewTarget | null>(null);
  const [kind, setKind] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['safety'] });

  const resolve = useMutation({ mutationFn: (id: string) => api(`/console/safety/moments/${id}/resolve`, { method: 'POST', body: JSON.stringify({ note: 'Reviewed' }) }), onSuccess: refresh });
  const report = useMutation({ mutationFn: (v: { id: string; status: string }) => api(`/console/safety/reports/${v.id}/status`, { method: 'POST', body: JSON.stringify({ status: v.status }) }), onSuccess: refresh });
  const resolveAll = useMutation({
    mutationFn: () => api<{ count: number }>('/console/safety/moments/resolve-all', { method: 'POST', body: JSON.stringify({ kind, note: 'Marked reviewed in bulk' }) }),
    onSuccess: refresh,
  });

  if (!s) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  const byKind = (k: string) => s.counts.find((c) => c.kind === k);
  const moments = s.moments.filter((m) => !kind || m.kind === kind);
  const openCount = moments.filter((m) => !m.resolvedAt).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">Chats are private. A chat opens here only for a safety review, shows just the messages around the moment, and every opening is saved in the audit log.</p>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Object.entries(KIND).map(([k, v]) => (
          <Card key={k} className={`cursor-pointer p-4 transition-colors hover:border-accent/50 ${kind === k ? 'border-accent' : ''}`} onClick={() => setKind(kind === k ? '' : k)}>
            <p className="text-xs text-muted">{v.label}</p>
            <p className={`mt-1 text-xl font-semibold ${(byKind(k)?.open ?? 0) > 0 && v.tone === 'bad' ? 'text-bad' : ''}`}>{count(byKind(k)?.last24h ?? 0)} <span className="text-sm font-normal text-muted">today</span></p>
            <p className="text-xs text-muted">{count(byKind(k)?.week ?? 0)} this week · {count(byKind(k)?.open ?? 0)} to review</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Safety moments{kind && ` · ${KIND[kind]?.label ?? kind}`}</CardTitle>
          <div className="flex items-center gap-3">
            {kind && <button className="text-xs text-muted hover:text-text" onClick={() => setKind('')}>Show all</button>}
            <span className="text-xs text-muted">Unreviewed on top</span>
            {openCount > 1 && (
              <Button
                size="sm"
                variant="secondary"
                disabled={resolveAll.isPending}
                onClick={() => window.confirm(`Mark all ${openCount} ${kind ? (KIND[kind]?.label ?? kind) + ' ' : ''}moments as reviewed? Only do this after reading them.`) && resolveAll.mutate()}
              >
                Mark all reviewed
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="px-0">
          <Table>
            <thead><tr><Th>What</Th><Th>User</Th><Th>Character</Th><Th>Helpline shown</Th><Th>When</Th><Th /></tr></thead>
            <tbody>
              {moments.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">Nothing yet. Crisis, emergency, eating, boundary and under-18 moments will show here as they happen.</Td></tr>}
              {moments.map((m) => (
                <tr key={m.id} className={m.resolvedAt ? 'opacity-60' : ''}>
                  <Td><Badge tone={KIND[m.kind]?.tone ?? 'neutral'}>{KIND[m.kind]?.label ?? m.kind}</Badge></Td>
                  <Td><Link href={`/users/${m.userId}`} className="hover:text-accent">{m.name ?? m.email}</Link></Td>
                  <Td className="text-muted">{m.character ?? '—'}</Td>
                  <Td>{m.helplineShown ? <Badge tone="good">Yes</Badge> : <span className="text-muted">—</span>}</Td>
                  <Td className="text-muted">{ago(m.at)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setReview({ momentId: m.id, title: KIND[m.kind]?.label ?? m.kind }); }}>Review chat</Button>
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
                    <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => { setReview({ messageId: f.messageId, title: `Disliked reply — ${f.character}` }); }}>Review</Button></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <ChatReview target={review} onClose={() => setReview(null)} />
    </div>
  );
}
