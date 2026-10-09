'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Crown, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Modal } from '@/components/ui/modal';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, date, rupees } from '@/lib/format';

interface UserDetail {
  id: string;
  email: string;
  status: string;
  joined: string;
  lastActive: string | null;
  profile: { name: string; language: string; gender: string | null; timezone: string; onboardingCompleted: boolean } | null;
  allowance: { premium: boolean; used: number; limit: number; credits: number; resetsAt: string; enforced: boolean };
  subscriptions: Array<{ id: string; plan: string; planCode: string; status: string; provider: string; periodEnd: string; trialEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string }>;
  purchases: Array<{ id: string; product: string; amount: number; currency: string; status: string; at: string }>;
  characters: Array<{ characterId: string; name: string; avatarUrl: string; messages: number; lastAt: string | null }>;
  aiCost30d: number;
}

type Action = 'premium' | 'messages' | 'block' | null;

const LANG: Record<string, string> = { en: 'English', hinglish: 'Hinglish', hi: 'Hindi' };

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: u, dataUpdatedAt, isFetching, error } = useQuery({ queryKey: ['user', id], queryFn: () => api<UserDetail>(`/console/users/${id}`), refetchInterval: LIVE_MS });
  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState('30');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      if (action === 'premium') return api(`/console/users/${id}/premium`, { method: 'POST', body: JSON.stringify({ days: Number(amount), reason }) });
      if (action === 'messages') return api(`/console/users/${id}/messages`, { method: 'POST', body: JSON.stringify({ amount: Number(amount), reason }) });
      return api(`/console/users/${id}/block`, { method: 'POST', body: JSON.stringify({ blocked: u?.status !== 'SUSPENDED', reason }) });
    },
    onSuccess: () => {
      setResult(action === 'premium' ? `Premium given for ${amount} days.` : action === 'messages' ? `${amount} messages added.` : u?.status === 'SUSPENDED' ? 'User unblocked.' : 'User blocked and signed out.');
      setAction(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['user', id] });
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const open = (a: Action, def: string) => {
    setAmount(def);
    setReason('');
    run.reset();
    setAction(a);
  };

  if (error) return <Card className="p-6 text-sm text-bad">{(error as Error).message}</Card>;
  if (!u) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;

  const active = u.subscriptions.find((s) => new Date(s.periodEnd) > new Date() && ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'CANCELLED'].includes(s.status));
  const blocked = u.status === 'SUSPENDED';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft size={16} /> Users
        </Link>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{u.profile?.name ?? 'No name'}</h2>
            <p className="text-sm text-muted">{u.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {active ? <Badge tone={active.status === 'TRIALING' ? 'warn' : 'accent'}>{active.status === 'TRIALING' ? 'Trial' : 'Premium'}</Badge> : <Badge>Free</Badge>}
              {blocked && <Badge tone="bad">Blocked</Badge>}
              {u.profile?.language && <Badge>{LANG[u.profile.language] ?? u.profile.language}</Badge>}
              {u.profile?.gender && u.profile.gender !== 'unspecified' && <Badge>{u.profile.gender === 'male' ? 'Man' : 'Woman'}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => open('premium', '30')}><Crown size={16} /> Give Premium</Button>
            <Button variant="secondary" size="sm" onClick={() => open('messages', '100')}><MessageSquarePlus size={16} /> Add messages</Button>
            <Button variant={blocked ? 'secondary' : 'danger'} size="sm" onClick={() => open('block', '')}>
              {blocked ? <><ShieldCheck size={16} /> Unblock</> : <><Ban size={16} /> Block</>}
            </Button>
          </div>
        </div>
        {result && <p className="mt-3 text-sm text-good">{result}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">Messages today</p><p className="mt-1 text-xl font-semibold">{count(u.allowance.used)} <span className="text-sm font-normal text-muted">/ {u.allowance.limit}{!u.allowance.enforced && ' (limits off)'}</span></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Extra messages</p><p className="mt-1 text-xl font-semibold">{count(u.allowance.credits)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">AI cost, 30 days</p><p className="mt-1 text-xl font-semibold">{rupees(u.aiCost30d)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Last active</p><p className="mt-1 text-xl font-semibold">{ago(u.lastActive)}</p><p className="text-xs text-muted">Joined {ago(u.joined)}</p></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Characters they talk to</CardTitle></CardHeader>
          <CardBody className="px-0">
            <Table>
              <tbody>
                {u.characters.length === 0 && <tr><Td className="text-muted">No chats yet.</Td></tr>}
                {u.characters.map((c) => (
                  <tr key={c.characterId}>
                    <Td><span className="flex items-center gap-3"><img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />{c.name}</span></Td>
                    <Td className="text-right tabular-nums">{count(c.messages)} msgs</Td>
                    <Td className="text-muted">{ago(c.lastAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subscriptions and purchases</CardTitle></CardHeader>
          <CardBody className="px-0">
            <Table>
              <thead><tr><Th>What</Th><Th>Status</Th><Th>Until / when</Th></tr></thead>
              <tbody>
                {u.subscriptions.length + u.purchases.length === 0 && <tr><Td colSpan={3} className="text-muted">Nothing yet.</Td></tr>}
                {u.subscriptions.map((s) => (
                  <tr key={s.id}>
                    <Td>{s.plan}{s.provider === 'MOCK' && <span className="text-muted"> · given by admin</span>}</Td>
                    <Td><Badge tone={s.status === 'ACTIVE' ? 'good' : s.status === 'TRIALING' ? 'warn' : 'neutral'}>{s.cancelAtPeriodEnd && s.status === 'ACTIVE' ? 'Ends' : s.status.toLowerCase()}</Badge></Td>
                    <Td className="text-muted">{date(s.periodEnd)}</Td>
                  </tr>
                ))}
                {u.purchases.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.product}</Td>
                    <Td><Badge tone={p.status === 'SUCCEEDED' ? 'good' : 'bad'}>{p.status.toLowerCase()}</Badge> {rupees(p.amount)}</Td>
                    <Td className="text-muted">{date(p.at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === 'premium' ? 'Give Premium for free' : action === 'messages' ? 'Add extra messages' : blocked ? 'Unblock this user' : 'Block this user'}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
        >
          {action !== 'block' && (
            <label className="block space-y-1.5">
              <span className="text-sm text-muted">{action === 'premium' ? 'Days of Premium' : 'Number of messages'}</span>
              <Input type="number" min={1} max={action === 'premium' ? 365 : 10000} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}
          {action === 'block' && !blocked && <p className="text-sm text-muted">They'll be signed out and can't use the app until you unblock them.</p>}
          <label className="block space-y-1.5">
            <span className="text-sm text-muted">Reason (saved in the audit log)</span>
            <Input required placeholder="e.g. payment issue, influencer, abuse" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {run.error && <p className="text-sm text-bad">{(run.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button type="submit" variant={action === 'block' && !blocked ? 'danger' : 'primary'} disabled={run.isPending}>
              {run.isPending ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
