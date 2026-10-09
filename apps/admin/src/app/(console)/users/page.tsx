'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, PlanBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Live, LIVE_MS } from '@/components/ui/live';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { ago, count } from '@/lib/format';
import { cn } from '@/lib/utils';

interface UserRow { id: string; name: string | null; email: string; status: string; joined: string; lastActive: string | null; plan: 'premium' | 'trial' | 'free'; messagesToday: number; messagesTotal: number }

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'premium', label: 'Premium' },
  { key: 'trial', label: 'In trial' },
  { key: 'free', label: 'Free' },
  { key: 'blocked', label: 'Blocked' },
];

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['users', search, filter, page],
    queryFn: () => api<{ users: UserRow[]; total: number; pageSize: number }>(`/console/users?search=${encodeURIComponent(search)}&filter=${filter}&page=${page}`),
    refetchInterval: LIVE_MS,
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search by name, email or user ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className={cn('rounded-md px-3 py-1.5 text-sm', filter === f.key ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Live updatedAt={dataUpdatedAt} fetching={isFetching} />
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Plan</Th>
              <Th className="text-right">Today</Th>
              <Th className="text-right">All messages</Th>
              <Th>Last active</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <Td colSpan={6} className="text-center text-muted">Loading…</Td>
              </tr>
            )}
            {data?.users.length === 0 && (
              <tr>
                <Td colSpan={6} className="py-10 text-center text-muted">No users match.</Td>
              </tr>
            )}
            {data?.users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-2">
                <Td>
                  <Link href={`/users/${u.id}`} className="block">
                    <span className="font-medium">{u.name ?? 'No name'}</span>
                    {u.status === 'SUSPENDED' && <Badge tone="bad" className="ml-2">Blocked</Badge>}
                    <span className="block text-xs text-muted">{u.email}</span>
                  </Link>
                </Td>
                <Td><PlanBadge plan={u.plan} /></Td>
                <Td className="text-right tabular-nums">{count(u.messagesToday)}</Td>
                <Td className="text-right tabular-nums">{count(u.messagesTotal)}</Td>
                <Td className="text-muted">{ago(u.lastActive)}</Td>
                <Td className="text-muted">{ago(u.joined)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="flex items-center justify-between px-4 py-3 text-sm text-muted">
          <span>{data ? `${count(data.total)} users` : ''}</span>
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
