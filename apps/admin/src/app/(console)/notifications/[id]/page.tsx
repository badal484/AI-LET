'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Square, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CampaignComposer } from '@/components/CampaignComposer';
import { NotificationPreview } from '@/components/NotificationPreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live, LIVE_MS } from '@/components/ui/live';
import { api } from '@/lib/api';
import { emptyDraft, KIND, PLAN, SKIP_REASON, STATUS, SURFACE, type Campaign, type CampaignDraft, type ComposerOptions } from '@/lib/campaigns';
import { ago, count, percent } from '@/lib/format';

const toDraft = (c: Campaign): CampaignDraft => ({
  ...c,
  expiresInDays: c.expiresAt ? Math.max(1, Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 86_400_000)) : null,
  // Older campaigns may miss fields: fill them from an empty audience.
  audience: { ...emptyDraft().audience, ...(c.audience as Partial<Campaign['audience']>) },
});

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card className="p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className="mt-1 text-xl font-semibold">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
  </Card>
);

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: c, dataUpdatedAt, isFetching, error } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api<Campaign>(`/console/notifications/${id}`),
    refetchInterval: (q) => (q.state.data && ['SENDING', 'SCHEDULED'].includes(q.state.data.status) ? 5_000 : LIVE_MS),
  });
  const { data: options } = useQuery({ queryKey: ['campaign-options'], queryFn: () => api<ComposerOptions>('/console/notifications/options') });
  const act = useMutation({
    mutationFn: (a: 'stop' | 'duplicate' | 'delete') =>
      a === 'delete'
        ? api(`/console/notifications/${id}`, { method: 'DELETE' })
        : api<Campaign>(`/console/notifications/${id}/${a}`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: (r, a) => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      if (a === 'duplicate') router.push(`/notifications/${(r as Campaign).id}`);
      else if (a === 'delete') router.push('/notifications');
      else void qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });

  if (error) return <Card className="p-6 text-sm text-bad">{(error as Error).message}</Card>;
  if (!c) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;

  const back = (
    <Link href="/notifications" className="inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft size={16} /> Notifications</Link>
  );

  if (c.status === 'DRAFT') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {back}
          <div className="flex gap-2">
            {c.isTemplate && <Button size="sm" onClick={() => act.mutate('duplicate')}><Copy size={14} /> Use this template</Button>}
            <Button size="sm" variant="ghost" onClick={() => window.confirm(`Delete “${c.name}”?`) && act.mutate('delete')}><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
        {c.isTemplate && <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent">This is a template. Edit and save it here, or “Use this template” to make a notification from it.</p>}
        <CampaignComposer key={c.id} initial={toDraft(c)} id={c.id} />
      </div>
    );
  }

  const s = c.stats;
  const a = c.audience;
  const who = [
    a.plans?.length ? a.plans.map((p) => PLAN[p]).join(' / ') : null,
    a.joinedWithinDays && `joined in the last ${a.joinedWithinDays} days`,
    a.activeWithinDays && `active in the last ${a.activeWithinDays} days`,
    a.inactiveForDays && `not active for ${a.inactiveForDays}+ days`,
    a.characterIds?.length && `chats with ${a.characterIds.map((x) => options?.characters.find((ch) => ch.id === x)?.name ?? '…').join(', ')}`,
    a.categoryIds?.length && `${a.categoryIds.length} categor${a.categoryIds.length === 1 ? 'y' : 'ies'}`,
    a.appVersionBelow && `app older than ${a.appVersionBelow}`,
    a.emails?.length && `${a.emails.length} chosen account${a.emails.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ') || 'Everyone';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <div className="flex items-center gap-2">
          <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
          {['SENDING', 'SCHEDULED'].includes(c.status) && (
            <Button size="sm" variant="danger" disabled={act.isPending} onClick={() => window.confirm('Stop it? People who haven’t got it yet won’t.') && act.mutate('stop')}>
              <Square size={13} /> Stop
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={act.isPending} onClick={() => act.mutate('duplicate')}><Copy size={14} /> Duplicate</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{c.name}</h2>
        <Badge tone={STATUS[c.status]?.tone ?? 'neutral'}>{STATUS[c.status]?.label ?? c.status}</Badge>
        <span className="text-sm text-muted">
          {KIND[c.kind]?.label} · {c.status === 'SCHEDULED' && c.schedule.at ? `goes out ${new Date(c.schedule.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : `started ${ago(c.startedAt)}`}
          {c.schedule.mode === 'local' && ` · ${String(c.schedule.localHour).padStart(2, '0')}:00 their time`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sent" value={count(s.sent)} sub={`of ${count(s.audience)}${s.waiting ? ` · ${count(s.waiting)} waiting` : ''}`} />
        <Stat label="On their phone" value={count(s.phones)} sub={c.surfaces.includes('push') ? 'Phone notification delivered' : 'Phone notification off'} />
        <Stat label="Opened" value={percent(s.openRate)} sub={`${count(s.opened)} ${s.opened === 1 ? 'person' : 'people'}`} />
        <Stat label="Tapped a button / link" value={count(s.clicked)} sub={s.dismissed ? `${count(s.dismissed)} closed it` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Who and how</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              <p><span className="text-muted">Audience:</span> {who}</p>
              <p><span className="text-muted">Shows as:</span> {c.surfaces.map((x) => SURFACE[x].label).join(', ')}</p>
              <p><span className="text-muted">Quiet hours:</span> {c.respectQuietHours ? 'waits until they’re over' : 'ignored'}{c.skipRecentDays ? ` · skips people who got one in the last ${c.skipRecentDays} days` : ''}</p>
              {c.expiresAt && <p><span className="text-muted">Stops showing:</span> {new Date(c.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>}
            </CardBody>
          </Card>
          {(s.skipped > 0 || s.failed > 0) && (
            <Card>
              <CardHeader><CardTitle>Not sent</CardTitle><span className="text-xs text-muted">{count(s.skipped + s.failed)} people</span></CardHeader>
              <CardBody className="space-y-1.5 text-sm">
                {c.skipReasons?.map((r) => (
                  <div key={r.reason} className="flex justify-between"><span>{SKIP_REASON[r.reason] ?? r.reason}</span><span className="tabular-nums text-muted">{count(r.n)}</span></div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader><CardTitle>What they saw</CardTitle></CardHeader>
          <CardBody><NotificationPreview draft={toDraft(c)} options={options} /></CardBody>
        </Card>
      </div>
    </div>
  );
}
