'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CharacterEditor, type EditableCharacter } from '@/components/CharacterEditor';
import { ImageOff, Pencil } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { count, rupees } from '@/lib/format';

interface CharacterRow {
  id: string; slug: string; name: string; tagline: string; avatarUrl: string; coverImageUrl: string; gallery: string[]; category: string; status: string; featured: boolean;
  users7d: number; messages7d: number; usersTotal: number; payingUsers: number; aiCost7d: number; aiCostPerMessage: number | null;
  likes: number; dislikes: number; samePhoto: number;
}

const SORTS: Record<string, { label: string; fn: (a: CharacterRow, b: CharacterRow) => number }> = {
  used: { label: 'Most used', fn: (a, b) => b.messages7d - a.messages7d || b.users7d - a.users7d },
  users: { label: 'Most users', fn: (a, b) => b.usersTotal - a.usersTotal },
  liked: { label: 'Most liked', fn: (a, b) => likeRate(b) - likeRate(a) || b.likes - a.likes },
  cost: { label: 'Costliest per message', fn: (a, b) => (b.aiCostPerMessage ?? -1) - (a.aiCostPerMessage ?? -1) },
  name: { label: 'Name', fn: (a, b) => a.name.localeCompare(b.name) },
};
/** 👍 share of all ratings in the last 30 days; -1 when nobody rated yet (sorts last). */
const likeRate = (c: CharacterRow) => (c.likes + c.dislikes ? c.likes / (c.likes + c.dislikes) : -1);
const photoProblem = (c: CharacterRow) => c.samePhoto > 0 || c.gallery.length === 0;

export default function CharactersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<EditableCharacter | null>(null);
  const [sort, setSort] = useState('used');
  const [category, setCategory] = useState('');
  const { data, dataUpdatedAt, isFetching } = useQuery({ queryKey: ['characters'], queryFn: () => api<CharacterRow[]>('/console/characters'), refetchInterval: LIVE_MS });
  const update = useMutation({
    mutationFn: (v: { id: string; live?: boolean; featured?: boolean }) =>
      api(`/console/characters/${v.id}`, { method: 'PATCH', body: JSON.stringify({ live: v.live, featured: v.featured }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characters'] }),
  });

  const categories = [...new Set((data ?? []).map((c) => c.category))].sort();
  const needPhotos = (data ?? []).filter(photoProblem).length;
  const list = (data ?? [])
    .filter((c) => !q || `${c.name} ${c.category} ${c.tagline}`.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => !category || (category === 'photos' ? photoProblem(c) : c.category === category))
    .sort(SORTS[sort]!.fn);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search characters" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-muted">{data ? `${data.filter((c) => c.status === 'PUBLISHED').length} live of ${data.length}` : ''}</span>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {[{ key: '', label: 'All' }, ...categories.map((c) => ({ key: c, label: c.replace(/[-_]/g, ' ') })), ...(needPhotos ? [{ key: 'photos', label: `Needs photos (${needPhotos})` }] : [])].map((f) => (
          <button
            key={f.key}
            onClick={() => setCategory(f.key)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${category === f.key ? 'bg-accent-soft text-accent' : f.key === 'photos' ? 'text-warn hover:text-text' : 'text-muted hover:text-text'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {update.error && <p className="text-sm text-bad">{(update.error as Error).message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const live = c.status === 'PUBLISHED';
          return (
            <Card key={c.id} className={`p-4 ${live ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => setEditing(c)} className="group relative shrink-0" aria-label={`Edit ${c.name}`}>
                  <img src={c.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/50 group-hover:flex"><Pencil size={14} className="text-white" /></span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/characters/${c.id}`} className="truncate font-semibold hover:underline">{c.name}</Link>
                    {c.featured && <Badge tone="accent">Featured</Badge>}
                    <span className="flex-1" />
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(c)}><Pencil size={14} /> Edit</Button>
                  </div>
                  <p className="truncate text-xs text-muted">{c.tagline}</p>
                  <p className="mt-0.5 text-xs capitalize text-muted">{c.category.replace(/[-_]/g, ' ')}</p>
                </div>
              </div>
              {photoProblem(c) && (
                <button onClick={() => setEditing(c)} className="mt-3 flex w-full items-center gap-2 rounded-lg bg-warn/10 px-3 py-2 text-left text-xs text-warn hover:opacity-80">
                  <ImageOff size={14} className="shrink-0" />
                  {c.samePhoto > 0 ? `Same profile photo as ${c.samePhoto} other character${c.samePhoto > 1 ? 's' : ''} — upload their own` : 'No gallery photos yet — add some'}
                </button>
              )}
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <div><p className="text-base font-semibold">{count(c.users7d)}</p><p className="text-[11px] text-muted">users 7d</p></div>
                <div><p className="text-base font-semibold">{count(c.messages7d)}</p><p className="text-[11px] text-muted">msgs 7d</p></div>
                <div>
                  <p className="text-base font-semibold">{c.likes + c.dislikes ? `${Math.round((c.likes / (c.likes + c.dislikes)) * 100)}%` : '—'}</p>
                  <p className="text-[11px] text-muted">👍 {c.likes} · 👎 {c.dislikes}</p>
                </div>
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
      <CharacterEditor character={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
