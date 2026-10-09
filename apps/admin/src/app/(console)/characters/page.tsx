'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { count, rupees } from '@/lib/format';

interface CharacterRow {
  id: string; slug: string; name: string; tagline: string; avatarUrl: string; category: string; status: string; featured: boolean;
  users7d: number; messages7d: number; usersTotal: number; payingUsers: number; aiCost7d: number; aiCostPerMessage: number | null;
}

export default function CharactersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const { data, dataUpdatedAt, isFetching } = useQuery({ queryKey: ['characters'], queryFn: () => api<CharacterRow[]>('/console/characters'), refetchInterval: LIVE_MS });
  const update = useMutation({
    mutationFn: (v: { id: string; live?: boolean; featured?: boolean }) =>
      api(`/console/characters/${v.id}`, { method: 'PATCH', body: JSON.stringify({ live: v.live, featured: v.featured }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characters'] }),
  });

  const list = (data ?? []).filter((c) => !q || `${c.name} ${c.category} ${c.tagline}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search characters" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-muted">{data ? `${data.filter((c) => c.status === 'PUBLISHED').length} live of ${data.length}` : ''}</span>
        <span className="flex-1" />
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>
      {update.error && <p className="text-sm text-bad">{(update.error as Error).message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const live = c.status === 'PUBLISHED';
          return (
            <Card key={c.id} className={`p-4 ${live ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <img src={c.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{c.name}</p>
                    {c.featured && <Badge tone="accent">Featured</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted">{c.tagline}</p>
                  <p className="mt-0.5 text-xs capitalize text-muted">{c.category.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <div><p className="text-base font-semibold">{count(c.users7d)}</p><p className="text-[11px] text-muted">users 7d</p></div>
                <div><p className="text-base font-semibold">{count(c.messages7d)}</p><p className="text-[11px] text-muted">msgs 7d</p></div>
                <div><p className="text-base font-semibold">{count(c.payingUsers)}</p><p className="text-[11px] text-muted">paying</p></div>
                <div><p className="text-base font-semibold">{rupees(c.aiCostPerMessage, 2)}</p><p className="text-[11px] text-muted">₹/msg</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <label className="flex items-center gap-2">
                  <Switch checked={live} label={`${c.name} live`} disabled={update.isPending} onChange={(v) => {
                    if (!v && !window.confirm(`Turn ${c.name} off? Users won't be able to open this chat until you turn it back on.`)) return;
                    update.mutate({ id: c.id, live: v });
                  }} />
                  Live
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={c.featured} label={`${c.name} featured`} disabled={update.isPending} onChange={(v) => update.mutate({ id: c.id, featured: v })} />
                  Featured
                </label>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
