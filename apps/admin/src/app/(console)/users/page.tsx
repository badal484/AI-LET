'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, PlanBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Switch } from '@/components/ui/switch';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count, rupees } from '@/lib/format';
import { GENDER, LANG, PLATFORM, SIGN_IN } from '@/lib/labels';
import { cn } from '@/lib/utils';

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  status: string;
  joined: string;
  lastActive: string | null;
  plan: 'premium' | 'trial' | 'free';
  gender: string | null;
  language: string | null;
  onboarded: boolean;
  signIn: string[];
  platform: string | null;
  appVersion: string | null;
  paid: number;
  characters: number;
  messagesToday: number;
  messagesTotal: number;
  test: boolean;
}
interface Stats { total: number; newToday: number; newWeek: number; activeToday: number; premium: number; trial: number; blocked: number; notOnboarded: number }

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'premium', label: 'Premium' },
  { key: 'trial', label: 'In trial' },
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid us' },
  { key: 'new', label: 'New this week' },
  { key: 'inactive', label: 'Inactive 7+ days' },
  { key: 'onboarding', label: 'No onboarding' },
  { key: 'blocked', label: 'Blocked' },
];


function Stat({ label, value, sub, onClick, active }: { label: string; value: number | undefined; sub?: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-xl border bg-surface p-4 text-left transition-colors hover:border-accent/50', active ? 'border-accent' : 'border-border')}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{count(value)}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </button>
  );
}

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'lastActive', dir: 'desc' });
  const [showTest, setShowTest] = useState(false);
  const [page, setPage] = useState(1);
  // Links like /users?filter=new open the list already filtered.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('filter');
    if (f && FILTERS.some((x) => x.key === f)) setFilter(f);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = `search=${encodeURIComponent(search)}&filter=${filter}&sort=${sort.key}&dir=${sort.dir}&test=${showTest ? 1 : 0}`;
  const { data, isLoading, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['users', query, page],
    queryFn: () => api<{ users: UserRow[]; total: number; pageSize: number; stats: Stats }>(`/console/users?${query}&page=${page}`),
    refetchInterval: LIVE_MS,
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const s = data?.stats;

  const pickFilter = (key: string) => {
    setFilter((f) => (f === key && key !== '' ? '' : key));
    setPage(1);
  };
  const SortTh = ({ k, children, right }: { k: string; children: React.ReactNode; right?: boolean }) => (
    <Th className={right ? 'text-right' : undefined}>
      <button
        type="button"
        className={cn('inline-flex items-center gap-1 hover:text-text', sort.key === k && 'text-text')}
        onClick={() => {
          setSort((cur) => ({ key: k, dir: cur.key === k && cur.dir === 'desc' ? 'asc' : 'desc' }));
          setPage(1);
        }}
      >
        {children}
        {sort.key === k && (sort.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </Th>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Stat label="All users" value={s?.total} onClick={() => pickFilter('')} active={filter === ''} />
        <Stat label="New today" value={s?.newToday} sub={`${count(s?.newWeek)} this week`} onClick={() => pickFilter('new')} active={filter === 'new'} />
        <Stat label="Active today" value={s?.activeToday} />
        <Stat label="Premium" value={s?.premium} onClick={() => pickFilter('premium')} active={filter === 'premium'} />
        <Stat label="In ₹1 trial" value={s?.trial} onClick={() => pickFilter('trial')} active={filter === 'trial'} />
        <Stat label="No onboarding" value={s?.notOnboarded} sub="Signed up, didn't finish" onClick={() => pickFilter('onboarding')} active={filter === 'onboarding'} />
        <Stat label="Blocked" value={s?.blocked} onClick={() => pickFilter('blocked')} active={filter === 'blocked'} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search by name, email, phone or user ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <Switch checked={showTest} onChange={(v) => { setShowTest(v); setPage(1); }} label="Show test accounts" />
          Show test accounts
        </label>
        <a
          href={`/api/v1/admin/console/users.csv?${query}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface-2 px-3 text-sm hover:bg-border"
        >
          <Download size={16} /> CSV
        </a>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => pickFilter(f.key)}
            className={cn('rounded-md px-3 py-1.5 text-sm', filter === f.key ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <SortTh k="name">User</SortTh>
              <Th>Plan</Th>
              <Th>About</Th>
              <Th>Signed in with</Th>
              <SortTh k="today" right>Today</SortTh>
              <SortTh k="messages" right>All messages</SortTh>
              <Th className="text-right">Characters</Th>
              <SortTh k="paid" right>Paid</SortTh>
              <SortTh k="lastActive">Last active</SortTh>
              <SortTh k="joined">Joined</SortTh>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <Td colSpan={10} className="text-center text-muted">Loading…</Td>
              </tr>
            )}
            {data?.users.length === 0 && (
              <tr>
                <Td colSpan={10} className="py-10 text-center text-muted">No users match.</Td>
              </tr>
            )}
            {data?.users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-2">
                <Td>
                  <Link href={`/users/${u.id}`} className="block">
                    <span className="font-medium">{u.name ?? 'No name'}</span>
                    {u.status === 'SUSPENDED' && <Badge tone="bad" className="ml-2">Blocked</Badge>}
                    {!u.onboarded && <Badge tone="warn" className="ml-2">No onboarding</Badge>}
                    {u.test && <Badge className="ml-2">Test</Badge>}
                    <span className="block text-xs text-muted">{u.email}</span>
                  </Link>
                </Td>
                <Td><PlanBadge plan={u.plan} /></Td>
                <Td className="text-xs text-muted">
                  {[u.gender ? GENDER[u.gender] ?? null : null, u.language ? LANG[u.language] ?? u.language : null].filter(Boolean).join(' · ') || '—'}
                </Td>
                <Td className="text-xs text-muted">
                  {u.signIn.map((p) => SIGN_IN[p] ?? p).join(', ') || '—'}
                  {u.platform && <span className="block">{PLATFORM[u.platform.toLowerCase()] ?? u.platform}{u.appVersion && ` · v${u.appVersion}`}</span>}
                </Td>
                <Td className="text-right tabular-nums">{count(u.messagesToday)}</Td>
                <Td className="text-right tabular-nums">{count(u.messagesTotal)}</Td>
                <Td className="text-right tabular-nums">{count(u.characters)}</Td>
                <Td className="text-right tabular-nums">{u.paid ? rupees(u.paid) : <span className="text-muted">—</span>}</Td>
                <Td className="text-muted">{ago(u.lastActive)}</Td>
                <Td className="text-muted">{ago(u.joined)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="flex items-center justify-between px-4 py-3 text-sm text-muted">
          <span>{data ? `${count(data.total)} user${data.total === 1 ? '' : 's'}` : ''}</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>{page} / {pages}</span>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
