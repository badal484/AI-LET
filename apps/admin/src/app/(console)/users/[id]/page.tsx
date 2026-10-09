'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Brain, Crown, LogOut, MessageSquarePlus, MoreHorizontal, RotateCcw, ShieldCheck, Trash2, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Modal } from '@/components/ui/modal';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, date, rupees, shortDay } from '@/lib/format';
import { GENDER, LANG, PLATFORM, SIGN_IN, STAGE } from '@/lib/labels';
import { cn } from '@/lib/utils';

interface UserDetail {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  status: string;
  joined: string;
  lastActive: string | null;
  lastLogin: string | null;
  signIn: string[];
  profile: { name: string; language: string; gender: string | null; timezone: string; birthday: string | null; onboardingCompleted: boolean; onboardingStep: string } | null;
  devices: Array<{ platform: string; appVersion: string | null; os: string | null; name: string | null; lastSeen: string; active: boolean; logins: number }>;
  activeSessions: number;
  allowance: { premium: boolean; used: number; limit: number; credits: number; resetsAt: string; enforced: boolean };
  activity: Array<{ day: string; messages: number }>;
  subscriptions: Array<{ id: string; plan: string; planCode: string; status: string; provider: string; periodEnd: string; trialEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string }>;
  purchases: Array<{ id: string; product: string; amount: number; currency: string; status: string; at: string }>;
  wallet: Array<{ id: string; type: string; amount: number; balance: number; description: string; at: string }>;
  characters: Array<{ characterId: string; name: string; avatarUrl: string; messages: number; lastAt: string | null; stage: string | null; streak: number | null; since: string }>;
  feedback: Array<{ id: string; rating: string; reason: string | null; text: string | null; character: string | null; at: string }>;
  support: Array<{ id: string; topic: string; message: string; status: string; reply: string | null; at: string }>;
  safety: Array<{ id: string; kind: string; character: string | null; at: string; resolved: boolean }>;
  adminActions: Array<{ id: string; action: string; admin: string | null; metadata: Record<string, unknown> | null; at: string }>;
  deletion: { status: string; scheduledFor: string; reason: string | null } | null;
  aiCost30d: number;
}

interface Memories {
  cards: Array<{ characterId: string; character: string; avatarUrl: string; data: Record<string, unknown>; updatedAt: string }>;
  memories: Array<{ id: string; content: string; category: string; sensitive: boolean; character: string; at: string }>;
}

type Action = 'premium' | 'removePremium' | 'messages' | 'reset' | 'signOut' | 'block' | 'delete' | 'cancelDelete' | 'memories';

const ACTIONS: Record<Action, { title: string; amount?: { label: string; def: string; max: number }; note?: string; danger?: boolean; path: string; done: string }> = {
  premium: { title: 'Give Premium for free', amount: { label: 'Days of Premium', def: '30', max: 365 }, path: 'premium', done: 'Premium given.' },
  removePremium: {
    title: 'Remove Premium you gave',
    note: 'Ends Premium that an admin gave. Paid Google Play subscriptions are cancelled by the user in the Play Store, or refunded in the Play Console.',
    danger: true,
    path: 'premium/remove',
    done: 'Premium removed.',
  },
  messages: { title: 'Add extra messages', amount: { label: 'Number of messages', def: '100', max: 10000 }, path: 'messages', done: 'Messages added.' },
  reset: { title: "Reset today's message limit", note: 'They get today\'s free messages back right away.', path: 'reset-today', done: "Today's limit reset." },
  signOut: { title: 'Sign out of all devices', note: 'They are signed out on every phone and can sign in again (e.g. a lost phone).', path: 'sign-out', done: 'Signed out everywhere.' },
  block: { title: 'Block this user', note: "They'll be signed out and can't use the app until you unblock them.", danger: true, path: 'block', done: 'Done.' },
  delete: {
    title: 'Delete this account',
    note: 'The account is deleted in 24 hours (you can cancel until then): chats, memories and login are erased for good. Payment records are kept without their name, as the law requires.',
    danger: true,
    path: 'delete',
    done: 'Deletion scheduled for 24 hours from now.',
  },
  cancelDelete: { title: 'Cancel the deletion', path: 'delete/cancel', done: 'Deletion cancelled.' },
  memories: {
    title: 'Open what the characters remember',
    note: 'Memories are private. Opening them is saved in the audit log with your reason.',
    path: 'memories',
    done: '',
  },
};

const MOMENT: Record<string, string> = { crisis: 'Crisis', emergency: 'Emergency', eating: 'Eating', boundary: 'Boundary', minor: 'Possibly a minor' };
const TOPIC: Record<string, string> = { payment: 'Payment', account: 'Account', bug: 'Bug', delete_data: 'Delete data', feedback: 'Feedback', other: 'Other' };
const WALLET: Record<string, string> = { PURCHASE: 'Bought', GRANT: 'Given', CONSUMPTION: 'Used', REFUND: 'Refunded', EXPIRATION: 'Expired', ADJUSTMENT: 'Adjusted', REVERSAL: 'Reversed' };

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 };

/** "console.user.premium_granted" → "Premium granted". */
const actionLabel = (a: string) => {
  const s = a.replace(/^console\.(user|safety|users)\./, '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: u, dataUpdatedAt, isFetching, error } = useQuery({ queryKey: ['user', id], queryFn: () => api<UserDetail>(`/console/users/${id}`), refetchInterval: LIVE_MS });
  const [action, setAction] = useState<Action | null>(null);
  const [menu, setMenu] = useState(false);
  const [amount, setAmount] = useState('30');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memories | null>(null);

  const blocked = u?.status === 'SUSPENDED';
  const run = useMutation({
    mutationFn: async (a: Action) => {
      const body: Record<string, unknown> = { reason };
      if (a === 'premium') body['days'] = Number(amount);
      if (a === 'messages') body['amount'] = Number(amount);
      if (a === 'block') body['blocked'] = !blocked;
      return api<unknown>(`/console/users/${id}/${ACTIONS[a].path}`, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: (data, a) => {
      if (a === 'memories') setMemories(data as Memories);
      else setResult(a === 'block' ? (blocked ? 'User unblocked.' : 'User blocked and signed out.') : ACTIONS[a].done);
      setAction(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['user', id] });
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const forget = useMutation({
    mutationFn: (memoryId: string) => api(`/console/users/${id}/memories/${memoryId}?reason=${encodeURIComponent('deleted from the admin console')}`, { method: 'DELETE' }),
    onSuccess: (_d, memoryId) => setMemories((m) => m && { ...m, memories: m.memories.filter((x) => x.id !== memoryId) }),
  });

  const open = (a: Action) => {
    setAmount(ACTIONS[a].amount?.def ?? '');
    setReason('');
    setMenu(false);
    run.reset();
    setAction(a);
  };

  if (error) return <Card className="p-6 text-sm text-bad">{(error as Error).message}</Card>;
  if (!u) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;

  const now = new Date();
  const active = u.subscriptions.find((s) => new Date(s.periodEnd) > now && ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'CANCELLED'].includes(s.status));
  const adminGiven = u.subscriptions.some((s) => s.provider === 'MOCK' && new Date(s.periodEnd) > now && s.status !== 'EXPIRED');
  const paid = u.purchases.filter((p) => p.status === 'SUCCEEDED').reduce((t, p) => t + p.amount, 0);
  const chart = u.activity.map((d) => ({ ...d, date: shortDay(d.day) }));
  const cfg = action ? ACTIONS[action] : null;

  const more: Array<{ a: Action; label: string; icon: ReactNode; show: boolean; danger?: boolean }> = [
    { a: 'removePremium', label: 'Remove Premium you gave', icon: <XCircle size={16} />, show: adminGiven },
    { a: 'reset', label: "Reset today's limit", icon: <RotateCcw size={16} />, show: true },
    { a: 'signOut', label: 'Sign out of all devices', icon: <LogOut size={16} />, show: true },
    { a: 'delete', label: 'Delete account', icon: <Trash2 size={16} />, show: !u.deletion, danger: true },
    { a: 'cancelDelete', label: 'Cancel deletion', icon: <Undo2 size={16} />, show: u.deletion?.status === 'PENDING' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft size={16} /> Users
        </Link>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      {u.deletion && (
        <Card className="border-bad/40 bg-bad/5 p-4 text-sm">
          <span className="font-medium text-bad">Account deletion {u.deletion.status === 'PENDING' ? 'scheduled' : u.deletion.status.toLowerCase()}</span>
          <span className="text-muted"> · {date(u.deletion.scheduledFor)}{u.deletion.reason && ` · ${u.deletion.reason}`}</span>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{u.profile?.name ?? 'No name'}</h2>
            <p className="text-sm text-muted">{u.email}{u.phone && ` · ${u.phone}`}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {active ? <Badge tone={active.status === 'TRIALING' ? 'warn' : 'accent'}>{active.status === 'TRIALING' ? 'Trial' : 'Premium'}</Badge> : <Badge>Free</Badge>}
              {blocked && <Badge tone="bad">Blocked</Badge>}
              {!u.profile?.onboardingCompleted && <Badge tone="warn">Didn't finish onboarding</Badge>}
              {u.profile?.language && <Badge>{LANG[u.profile.language] ?? u.profile.language}</Badge>}
              {u.profile?.gender && GENDER[u.profile.gender] && <Badge>{GENDER[u.profile.gender]}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => open('premium')}><Crown size={16} /> Give Premium</Button>
            <Button variant="secondary" size="sm" onClick={() => open('messages')}><MessageSquarePlus size={16} /> Add messages</Button>
            <Button variant={blocked ? 'secondary' : 'danger'} size="sm" onClick={() => open('block')}>
              {blocked ? <><ShieldCheck size={16} /> Unblock</> : <><Ban size={16} /> Block</>}
            </Button>
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setMenu((m) => !m)} aria-label="More actions"><MoreHorizontal size={16} /></Button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                    {more.filter((m) => m.show).map((m) => (
                      <button
                        key={m.a}
                        onClick={() => open(m.a)}
                        className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2', m.danger && 'text-bad')}
                      >
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {result && <p className="mt-3 text-sm text-good">{result}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Messages today" value={<>{count(u.allowance.used)} <span className="text-sm font-normal text-muted">/ {u.allowance.limit}</span></>} sub={!u.allowance.enforced ? 'Limits are off' : undefined} />
        <Stat label="Extra messages" value={count(u.allowance.credits)} />
        <Stat label="Paid us" value={rupees(paid)} />
        <Stat label="AI cost, 30 days" value={rupees(u.aiCost30d)} />
        <Stat label="Last active" value={ago(u.lastActive)} sub={`Joined ${ago(u.joined)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardBody>
            <Row k="Signed in with">{u.signIn.map((p) => SIGN_IN[p] ?? p).join(', ') || '—'}</Row>
            <Row k="Email">{u.emailVerified ? <Badge tone="good">Verified</Badge> : <Badge>Not verified</Badge>}</Row>
            <Row k="Phone">{u.phone ?? '—'}</Row>
            <Row k="Timezone">{u.profile?.timezone ?? '—'}</Row>
            <Row k="Birthday">{u.profile?.birthday ? new Date(u.profile.birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Row>
            <Row k="Onboarding">{u.profile?.onboardingCompleted ? 'Finished' : `Stopped at: ${(u.profile?.onboardingStep ?? 'start').toLowerCase().replace(/_/g, ' ')}`}</Row>
            <Row k="Joined">{date(u.joined)}</Row>
            <Row k="Last sign-in">{date(u.lastLogin)}</Row>
            <Row k="Signed in on">{count(u.activeSessions)} active session{u.activeSessions === 1 ? '' : 's'}</Row>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Devices</CardTitle></CardHeader>
          <CardBody className="px-0">
            {u.devices.length === 0 ? (
              <Empty>No devices recorded.</Empty>
            ) : (
              <Table>
                <thead><tr><Th>Device</Th><Th>App</Th><Th>Last seen</Th></tr></thead>
                <tbody>
                  {u.devices.map((d, i) => (
                    <tr key={i}>
                      <Td>
                        {PLATFORM[d.platform] ?? d.platform}
                        {d.name && <span className="text-muted"> · {d.name}</span>}
                        {d.os && <span className="text-muted"> · OS {d.os}</span>}
                        {d.logins > 1 && <span className="block text-xs text-muted">{d.logins} sign-ins</span>}
                      </Td>
                      <Td className="text-muted">{d.appVersion ? `v${d.appVersion}` : '—'}</Td>
                      <Td className="text-muted">{ago(d.lastSeen)}{!d.active && ' · signed out'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages per day</CardTitle>
          <span className="text-xs text-muted">Last 30 days · {count(u.activity.reduce((t, d) => t + d.messages, 0))} messages</span>
        </CardHeader>
        <CardBody className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" type="category" interval="preserveStartEnd" minTickGap={16} {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar isAnimationActive={false} dataKey="messages" name="Messages" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Characters they talk to</CardTitle></CardHeader>
        <CardBody className="px-0">
          {u.characters.length === 0 ? (
            <Empty>No chats yet.</Empty>
          ) : (
            <Table>
              <thead><tr><Th>Character</Th><Th>Relationship</Th><Th className="text-right">Day streak</Th><Th className="text-right">Their messages</Th><Th>Last chat</Th><Th>Since</Th></tr></thead>
              <tbody>
                {u.characters.map((c) => (
                  <tr key={c.characterId}>
                    <Td><span className="flex items-center gap-3"><img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />{c.name}</span></Td>
                    <Td>{c.stage ? <Badge tone={c.stage === 'STRANGER' ? 'neutral' : 'accent'}>{STAGE[c.stage] ?? c.stage}</Badge> : '—'}</Td>
                    <Td className="text-right tabular-nums">{c.streak ? `${c.streak} 🔥` : '—'}</Td>
                    <Td className="text-right tabular-nums">{count(c.messages)}</Td>
                    <Td className="text-muted">{ago(c.lastAt)}</Td>
                    <Td className="text-muted">{ago(c.since)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the characters remember</CardTitle>
          <Button variant="secondary" size="sm" onClick={() => (memories ? setMemories(null) : open('memories'))}>
            <Brain size={16} /> {memories ? 'Hide' : 'Open'}
          </Button>
        </CardHeader>
        <CardBody>
          {!memories ? (
            <p className="text-sm text-muted">Private. Opening asks for a reason and is saved in the audit log.</p>
          ) : (
            <div className="space-y-5">
              {memories.cards.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {memories.cards.map((c) => (
                    <ProfileCard key={c.characterId} card={c} />
                  ))}
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Memories ({memories.memories.length})</p>
                {memories.memories.length === 0 ? (
                  <p className="text-sm text-muted">Nothing remembered yet.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {memories.memories.map((m) => (
                      <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                        <div>
                          <p>{m.content}</p>
                          <p className="text-xs text-muted">
                            {m.character} · {m.category.toLowerCase().replace(/_/g, ' ')} · {ago(m.at)}
                            {m.sensitive && <Badge tone="warn" className="ml-2">Sensitive</Badge>}
                          </p>
                        </div>
                        <button
                          className="shrink-0 rounded p-1 text-muted hover:bg-surface-2 hover:text-bad disabled:opacity-50"
                          title="Delete this memory"
                          disabled={forget.isPending}
                          onClick={() => window.confirm('Delete this memory? The character will forget it.') && forget.mutate(m.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Subscriptions and purchases</CardTitle></CardHeader>
          <CardBody className="px-0">
            {u.subscriptions.length + u.purchases.length === 0 ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <Table>
                <thead><tr><Th>What</Th><Th>Status</Th><Th>Until / when</Th></tr></thead>
                <tbody>
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
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Extra messages history</CardTitle></CardHeader>
          <CardBody className="px-0">
            {u.wallet.length === 0 ? (
              <Empty>No extra messages bought, given or used.</Empty>
            ) : (
              <Table>
                <thead><tr><Th>What</Th><Th className="text-right">Change</Th><Th className="text-right">Left</Th><Th>When</Th></tr></thead>
                <tbody>
                  {u.wallet.map((w) => (
                    <tr key={w.id}>
                      <Td>{WALLET[w.type] ?? w.type}<span className="block max-w-56 truncate text-xs text-muted">{w.description}</span></Td>
                      <Td className={cn('text-right tabular-nums', w.amount > 0 ? 'text-good' : 'text-muted')}>{w.amount > 0 ? `+${w.amount}` : w.amount}</Td>
                      <Td className="text-right tabular-nums">{count(w.balance)}</Td>
                      <Td className="text-muted">{ago(w.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Their ratings</CardTitle></CardHeader>
          <CardBody className="px-0">
            {u.feedback.length === 0 ? (
              <Empty>No 👍 / 👎 given yet.</Empty>
            ) : (
              <Table>
                <tbody>
                  {u.feedback.map((f) => (
                    <tr key={f.id}>
                      <Td>{f.rating === 'THUMBS_UP' ? '👍' : '👎'}</Td>
                      <Td className="whitespace-normal">
                        {f.character ?? '—'}
                        {(f.reason || f.text) && <span className="block text-xs text-muted">{[f.reason, f.text].filter(Boolean).join(' · ')}</span>}
                      </Td>
                      <Td className="text-muted">{ago(f.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support requests</CardTitle>
            {u.support.some((s) => s.status === 'open') && <Link href="/support" className="text-xs text-accent hover:underline">Reply in Support</Link>}
          </CardHeader>
          <CardBody className="px-0">
            {u.support.length === 0 ? (
              <Empty>No support requests.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {u.support.map((s) => (
                  <li key={s.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{TOPIC[s.topic] ?? s.topic}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Badge tone={s.status === 'open' ? 'warn' : 'good'}>{s.status}</Badge> {ago(s.at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted">{s.message}</p>
                    {s.reply && <p className="mt-1 line-clamp-2 text-xs"><span className="text-muted">Reply: </span>{s.reply}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety moments</CardTitle>
            {u.safety.length > 0 && <Link href="/safety" className="text-xs text-accent hover:underline">Open Safety</Link>}
          </CardHeader>
          <CardBody className="px-0">
            {u.safety.length === 0 ? (
              <Empty>None. 🙏</Empty>
            ) : (
              <Table>
                <tbody>
                  {u.safety.map((m) => (
                    <tr key={m.id}>
                      <Td><Badge tone={m.kind === 'crisis' || m.kind === 'emergency' ? 'bad' : 'warn'}>{MOMENT[m.kind] ?? m.kind}</Badge></Td>
                      <Td>{m.character ?? '—'}</Td>
                      <Td className="text-muted">{m.resolved ? 'Resolved' : 'Open'}</Td>
                      <Td className="text-muted">{ago(m.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>What admins did</CardTitle></CardHeader>
          <CardBody className="px-0">
            {u.adminActions.length === 0 ? (
              <Empty>No admin actions on this user.</Empty>
            ) : (
              <Table>
                <tbody>
                  {u.adminActions.map((a) => (
                    <tr key={a.id}>
                      <Td className="whitespace-normal">
                        {actionLabel(a.action)}
                        {typeof a.metadata?.['reason'] === 'string' && <span className="block text-xs text-muted">{a.metadata['reason'] as string}</span>}
                      </Td>
                      <Td className="text-muted">{a.admin ?? '—'}</Td>
                      <Td className="text-muted">{ago(a.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal open={action !== null} onClose={() => setAction(null)} title={action === 'block' && blocked ? 'Unblock this user' : cfg?.title ?? ''}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (action) run.mutate(action);
          }}
        >
          {cfg?.amount && (
            <label className="block space-y-1.5">
              <span className="text-sm text-muted">{cfg.amount.label}</span>
              <Input type="number" min={1} max={cfg.amount.max} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}
          {cfg?.note && !(action === 'block' && blocked) && <p className="text-sm text-muted">{cfg.note}</p>}
          {action !== 'cancelDelete' && (
            <label className="block space-y-1.5">
              <span className="text-sm text-muted">Reason (saved in the audit log)</span>
              <Input
                required
                placeholder={action === 'memories' ? 'e.g. user asked what we store, bad reply report' : 'e.g. payment issue, influencer, abuse'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {run.error && <p className="text-sm text-bad">{(run.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button type="submit" variant={cfg?.danger && !(action === 'block' && blocked) ? 'danger' : 'primary'} disabled={run.isPending}>
              {run.isPending ? 'Saving…' : action === 'memories' ? 'Open' : 'Confirm'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const CARD_LABELS: Record<string, string> = {
  name: 'Name', nickname: 'Calls themselves', city: 'City', work: 'Work', people: 'People', likes: 'Likes', dislikes: 'Dislikes', goals: 'Goals',
  health: 'Health', jokes: 'Inside jokes', facts: 'Facts', events: 'Dates', tasks: 'Tasks', project: 'Project', style: 'How they talk',
};

/** One string per item, whatever shape the profile card stored it in. */
function describe(v: unknown): string {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return v.map(describe).filter(Boolean).join(' · ');
  const o = v as Record<string, unknown>;
  if ('relation' in o) return [o['relation'], o['name'], o['note']].filter(Boolean).join(' — ');
  if ('what' in o) return [o['what'], o['date'] ?? o['given'], o['result']].filter(Boolean).join(' — ');
  return Object.entries(o)
    .filter(([, x]) => x != null && x !== '' && !(Array.isArray(x) && x.length === 0))
    .map(([k, x]) => `${k}: ${describe(x)}`)
    .join(' · ');
}

function ProfileCard({ card }: { card: Memories['cards'][number] }) {
  const rows = Object.entries(card.data ?? {})
    .map(([k, v]) => [CARD_LABELS[k] ?? k, describe(v)] as const)
    .filter(([, v]) => v);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <img src={card.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        <span className="text-sm font-medium">{card.character}</span>
        <span className="text-xs text-muted">· {ago(card.updatedAt)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Nothing learned yet.</p>
      ) : (
        <dl className="space-y-1 text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
