'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { KIND, STATUS, SURFACE, type Campaign } from '@/lib/campaigns';
import { ago, count, percent } from '@/lib/format';

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, dataUpdatedAt, isFetching, error } = useQuery({ queryKey: ['campaigns'], queryFn: () => api<Campaign[]>('/console/notifications'), refetchInterval: LIVE_MS });
  const use = useMutation({
    mutationFn: (id: string) => api<Campaign>(`/console/notifications/${id}/duplicate`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      router.push(`/notifications/${c.id}`);
    },
  });
  const templates = data?.filter((c) => c.isTemplate) ?? [];
  const campaigns = data?.filter((c) => !c.isTemplate) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/notifications/new">
          <Button><Plus size={16} /> New notification</Button>
        </Link>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>
      {error && <Card className="p-6 text-sm text-bad">{(error as Error).message}</Card>}

      {templates.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Templates</CardTitle><span className="text-xs text-muted">Start a new notification from one</span></CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-1 rounded-lg border border-border pl-3">
                <Link href={`/notifications/${t.id}`} className="py-1.5 text-sm hover:text-accent">{t.name}</Link>
                <Button variant="ghost" size="sm" disabled={use.isPending} onClick={() => use.mutate(t.id)}><Copy size={13} /> Use</Button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Campaigns</CardTitle></CardHeader>
        <CardBody className="px-0">
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Status</Th><Th>Shows as</Th><Th className="text-right">Sent</Th><Th className="text-right">Opened</Th><Th className="text-right">Tapped</Th><Th>When</Th></tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr><Td colSpan={7} className="py-10 text-center text-muted">No notifications yet. Click “New notification” to write the first one.</Td></tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-surface-2" onClick={() => router.push(`/notifications/${c.id}`)}>
                  <Td>
                    <span className="block font-medium">{c.name}</span>
                    <span className="block max-w-xs truncate text-xs text-muted">{c.title || c.body}</span>
                  </Td>
                  <Td><Badge tone={STATUS[c.status]?.tone ?? 'neutral'}>{STATUS[c.status]?.label ?? c.status}</Badge><span className="mt-1 block text-xs text-muted">{KIND[c.kind]?.label}</span></Td>
                  <Td className="text-xs text-muted">{c.surfaces.map((s) => SURFACE[s]?.label.replace(' in the app', '')).join(', ')}</Td>
                  <Td className="text-right tabular-nums">{count(c.stats.sent)}{c.stats.waiting > 0 && <span className="block text-xs text-muted">{count(c.stats.waiting)} waiting</span>}</Td>
                  <Td className="text-right tabular-nums">{percent(c.stats.openRate)}</Td>
                  <Td className="text-right tabular-nums">{count(c.stats.clicked)}</Td>
                  <Td className="text-muted">{ago(c.startedAt ?? c.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
