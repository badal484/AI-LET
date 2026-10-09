'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, date } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'switches' | 'promos' | 'team' | 'audit';

function Switches() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api<Array<{ key: string; label: string; type: string; value: unknown; isDefault: boolean }>>('/console/settings') });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (v: { key: string; value: unknown }) => api(`/console/settings/${v.key}`, { method: 'PUT', body: JSON.stringify({ value: v.value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Limits and switches</CardTitle><span className="text-xs text-muted">Takes effect within 20 seconds, no app update needed</span></CardHeader>
      <CardBody className="divide-y divide-border">
        {data?.map((s) => (
          <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium">{s.label}</p>
              {s.key === 'limits.enforce' && <p className="text-xs text-muted">Off = everyone unlimited. Turn on at launch. Crisis messages are never limited.</p>}
              {s.key === 'maintenance.enabled' && <p className="text-xs text-muted">The app shows your message and chat pauses. The admin panel keeps working.</p>}
            </div>
            {s.type === 'boolean' ? (
              <Switch checked={Boolean(s.value)} label={s.label} disabled={save.isPending} onChange={(v) => {
                if (s.key === 'maintenance.enabled' && v && !window.confirm('Turn on maintenance mode? Users will not be able to chat until you turn it off.')) return;
                save.mutate({ key: s.key, value: v });
              }} />
            ) : (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const raw = draft[s.key] ?? String(s.value); save.mutate({ key: s.key, value: s.type === 'number' ? Number(raw) : raw }); }}>
                <Input className={s.type === 'number' ? 'w-24' : 'w-72'} type={s.type === 'number' ? 'number' : 'text'} value={draft[s.key] ?? String(s.value)} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} />
                <Button size="sm" variant="secondary" type="submit" disabled={save.isPending}>Save</Button>
              </form>
            )}
          </div>
        ))}
        {save.error && <p className="pt-3 text-sm text-bad">{(save.error as Error).message}</p>}
      </CardBody>
    </Card>
  );
}

interface Promo { id: string; code: string; name: string; discountType: string; discountValue: number; maxRedemptions: number | null; currentRedemptions: number; validUntil: string | null; isActive: boolean }
const PROMO_TYPE: Record<string, string> = { PERCENTAGE: '% off', FREE_CREDITS: 'free messages', TRIAL_EXTENSION: 'extra trial days', FIXED_AMOUNT: '₹ off' };

function Promos() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['promos'], queryFn: () => api<Promo[]>('/console/promos') });
  const [f, setF] = useState({ code: '', name: '', type: 'FREE_CREDITS', value: '100', maxRedemptions: '', validUntil: '' });
  const create = useMutation({
    mutationFn: () => api('/console/promos', { method: 'POST', body: JSON.stringify({ ...f, value: Number(f.value), maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : null, validUntil: f.validUntil || null }) }),
    onSuccess: () => { setF({ ...f, code: '', name: '' }); void qc.invalidateQueries({ queryKey: ['promos'] }); },
  });
  const toggle = useMutation({ mutationFn: (v: { id: string; active: boolean }) => api(`/console/promos/${v.id}/active`, { method: 'POST', body: JSON.stringify({ active: v.active }) }), onSuccess: () => qc.invalidateQueries({ queryKey: ['promos'] }) });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>New promo code</CardTitle></CardHeader>
        <CardBody>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Input required placeholder="CODE e.g. FRIEND50" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
            <Input placeholder="Name (for you)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm">
              <option value="FREE_CREDITS">Free messages</option>
              <option value="TRIAL_EXTENSION">Extra trial days</option>
              <option value="PERCENTAGE">% off</option>
            </select>
            <Input required type="number" min={1} placeholder="Amount" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
            <Input type="number" min={1} placeholder="Max uses (blank = unlimited)" value={f.maxRedemptions} onChange={(e) => setF({ ...f, maxRedemptions: e.target.value })} />
            <Input type="date" value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} />
            <div className="sm:col-span-3 flex items-center justify-between">
              <span className="text-sm text-bad">{create.error ? (create.error as Error).message : ''}</span>
              <Button type="submit" disabled={create.isPending}>Create code</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <Table>
          <thead><tr><Th>Code</Th><Th>Gives</Th><Th className="text-right">Used</Th><Th>Valid until</Th><Th>Active</Th></tr></thead>
          <tbody>
            {data?.length === 0 && <tr><Td colSpan={5} className="text-center text-muted">No codes yet.</Td></tr>}
            {data?.map((p) => (
              <tr key={p.id}>
                <Td><span className="font-mono font-medium">{p.code}</span><span className="block text-xs text-muted">{p.name}</span></Td>
                <Td>{p.discountValue} {PROMO_TYPE[p.discountType] ?? p.discountType}</Td>
                <Td className="text-right tabular-nums">{count(p.currentRedemptions)}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}</Td>
                <Td className="text-muted">{p.validUntil ? date(p.validUntil) : 'No end'}</Td>
                <Td><Switch checked={p.isActive} label={`${p.code} active`} onChange={(v) => toggle.mutate({ id: p.id, active: v })} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Team() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['team'], queryFn: () => api<{ admins: Array<{ id: string; email: string; name: string; active: boolean; lastLogin: string | null; roles: string[] }>; roles: Array<{ name: string; description: string }> }>('/console/team') });
  const [inv, setInv] = useState({ email: '', name: '', role: 'support' });
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const invite = useMutation({ mutationFn: () => api<{ email: string; temporaryPassword: string }>('/console/team', { method: 'POST', body: JSON.stringify(inv) }), onSuccess: (d) => { setCreated(d); setInv({ email: '', name: '', role: inv.role }); void qc.invalidateQueries({ queryKey: ['team'] }); } });
  const toggle = useMutation({ mutationFn: (v: { id: string; active: boolean }) => api(`/console/team/${v.id}/active`, { method: 'POST', body: JSON.stringify({ active: v.active }) }), onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }) });
  const change = useMutation({ mutationFn: () => api('/console/me/password', { method: 'POST', body: JSON.stringify(pw) }), onSuccess: () => setPw({ current: '', next: '' }) });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Admins</CardTitle></CardHeader>
        <CardBody className="px-0">
          <Table>
            <thead><tr><Th>Admin</Th><Th>Role</Th><Th>Last sign-in</Th><Th>Active</Th></tr></thead>
            <tbody>
              {data?.admins.map((a) => (
                <tr key={a.id}>
                  <Td><span className="font-medium">{a.name}</span><span className="block text-xs text-muted">{a.email}</span></Td>
                  <Td>{a.roles.length ? a.roles.map((r) => <Badge key={r} className="mr-1">{r.replace(/_/g, ' ')}</Badge>) : <span className="text-muted">none</span>}</Td>
                  <Td className="text-muted">{ago(a.lastLogin)}</Td>
                  <Td><Switch checked={a.active} label={`${a.email} active`} onChange={(v) => toggle.mutate({ id: a.id, active: v })} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {toggle.error && <p className="px-4 pt-2 text-sm text-bad">{(toggle.error as Error).message}</p>}
        </CardBody>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Invite an admin</CardTitle></CardHeader>
          <CardBody>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
              <Input required type="email" placeholder="Email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
              <Input placeholder="Name" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} />
              <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                {data?.roles.map((r) => <option key={r.name} value={r.name}>{r.name.replace(/_/g, ' ')}</option>)}
              </select>
              {invite.error && <p className="text-sm text-bad">{(invite.error as Error).message}</p>}
              {created && <p className="rounded-lg bg-good/10 p-3 text-sm text-good">Created {created.email}. One-time password (shown once — send it privately): <span className="font-mono">{created.temporaryPassword}</span></p>}
              <Button type="submit" className="w-full" disabled={invite.isPending}>Invite</Button>
            </form>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Change your password</CardTitle></CardHeader>
          <CardBody>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
              <Input required type="password" autoComplete="current-password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              <Input required type="password" autoComplete="new-password" placeholder="New password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              {change.error && <p className="text-sm text-bad">{(change.error as Error).message}</p>}
              {change.isSuccess && <p className="text-sm text-good">Password changed.</p>}
              <Button type="submit" variant="secondary" className="w-full" disabled={change.isPending}>Change password</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['audit', page], queryFn: () => api<{ entries: Array<{ id: string; at: string; actor: string; action: string; resource: string; resourceId: string | null; metadata: Record<string, unknown> | null }>; total: number; pageSize: number }>(`/console/audit?page=${page}`), refetchInterval: 15_000 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <Card>
      <Table>
        <thead><tr><Th>When</Th><Th>Who</Th><Th>What</Th><Th>Details</Th></tr></thead>
        <tbody>
          {data?.entries.map((e) => (
            <tr key={e.id}>
              <Td className="text-muted">{date(e.at)}</Td>
              <Td>{e.actor}</Td>
              <Td><span className="font-mono text-xs">{e.action}</span></Td>
              <Td className="max-w-md truncate text-xs text-muted" title={JSON.stringify(e.metadata)}>{e.metadata ? JSON.stringify(e.metadata) : ''}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm text-muted">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span>{page} / {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('switches');
  const TABS: Array<[Tab, string]> = [['switches', 'Limits & switches'], ['promos', 'Promo codes'], ['team', 'Team'], ['audit', 'Audit log']];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cn('rounded-md px-3 py-1.5 text-sm', tab === k ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}>{label}</button>
        ))}
      </div>
      {tab === 'switches' && <Switches />}
      {tab === 'promos' && <Promos />}
      {tab === 'team' && <Team />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}
