'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, Search, ShieldAlert, ShieldCheck, ScrollText } from 'lucide-react';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import { AdminAuthService } from '../../services/adminAuth';

type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED';

interface AdminUserRow {
  id: string;
  email: string;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  profile: { displayName?: string | null; username?: string | null } | null;
  activeSessionsCount: number;
  activeDevicesCount: number;
}

interface AuditLogRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<UserStatus, { bg: string; fg: string }> = {
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981' },
  SUSPENDED: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
  PENDING: { bg: 'rgba(234, 179, 8, 0.15)', fg: '#eab308' },
  DELETED: { bg: 'rgba(107, 114, 128, 0.15)', fg: '#9ca3af' },
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function UsersAdminPage() {
  const { admin } = useAdminAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError(null);
    try {
      const [userRows, logs] = await Promise.all([
        AdminAuthService.listUsers({
          limit: 50,
          search: appliedSearch || undefined,
          status: status === 'ALL' ? undefined : status,
        }) as Promise<AdminUserRow[]>,
        (AdminAuthService.getAuditLogs({ limit: 15 }) as Promise<AuditLogRow[]>).catch(() => []),
      ]);
      setUsers(userRows);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, status]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (user: AdminUserRow, next: 'ACTIVE' | 'SUSPENDED') => {
    const verb = next === 'SUSPENDED' ? 'suspend' : 'reactivate';
    const reason = window.prompt(`Reason to ${verb} ${user.email} (recorded in the audit log):`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) setError('A reason of at least 3 characters is required.');
      return;
    }
    setPendingId(user.id);
    setError(null);
    setNotice(null);
    try {
      await AdminAuthService.updateUserStatus(user.id, next, reason.trim());
      setNotice(
        next === 'SUSPENDED'
          ? `${user.email} suspended. Their active sessions were revoked.`
          : `${user.email} reactivated.`,
      );
      await load();
    } catch (err: any) {
      setError(err?.message || `Failed to ${verb} user`);
    } finally {
      setPendingId(null);
    }
  };

  const cell: React.CSSProperties = { padding: '14px 18px', verticalAlign: 'top' };

  return (
    <AuthGuard>
      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#f3f4f6' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={28} color="#6366f1" /> Users
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
          Find accounts, review session activity, and suspend or reactivate access. Every change is audited.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', fontSize: '14px' }}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#6ee7b7', fontSize: '14px' }}>
          {notice}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search.trim());
        }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, display name or username"
            aria-label="Search users"
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#f3f4f6', fontSize: '14px' }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#f3f4f6', fontSize: '14px' }}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="PENDING">Pending</option>
          <option value="DELETED">Deleted</option>
        </select>
        <button
          type="submit"
          style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
        >
          Search
        </button>
      </form>

      <div style={{ overflowX: 'auto', border: '1px solid #1f2937', borderRadius: '12px', background: '#111827', marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #1f2937' }}>
              <th style={cell}>Account</th>
              <th style={cell}>Status</th>
              <th style={cell}>Sessions / devices</th>
              <th style={cell}>Joined</th>
              <th style={cell}>Last login</th>
              <th style={{ ...cell, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ ...cell, color: '#9ca3af' }}>Loading users…</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...cell, color: '#9ca3af' }}>No users match.</td>
              </tr>
            )}
            {!loading &&
              users.map((user) => {
                const colors = STATUS_COLORS[user.status] ?? STATUS_COLORS.DELETED;
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={cell}>
                      <div style={{ fontWeight: 600 }}>{user.profile?.displayName || user.email}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {user.email}
                        {user.profile?.username ? ` · @${user.profile.username}` : ''}
                        {user.emailVerified ? '' : ' · email unverified'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>{user.id}</div>
                    </td>
                    <td style={cell}>
                      <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, background: colors.bg, color: colors.fg }}>
                        {user.status}
                      </span>
                    </td>
                    <td style={cell}>
                      {user.activeSessionsCount} / {user.activeDevicesCount}
                    </td>
                    <td style={cell}>{formatDate(user.createdAt)}</td>
                    <td style={cell}>{formatDate(user.lastLoginAt)}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>
                      {user.status === 'ACTIVE' || user.status === 'PENDING' ? (
                        <button
                          onClick={() => changeStatus(user, 'SUSPENDED')}
                          disabled={pendingId === user.id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: '12px' }}
                        >
                          <ShieldAlert size={14} /> Suspend
                        </button>
                      ) : user.status === 'SUSPENDED' ? (
                        <button
                          onClick={() => changeStatus(user, 'ACTIVE')}
                          disabled={pendingId === user.id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #065f46', background: 'transparent', color: '#6ee7b7', cursor: 'pointer', fontSize: '12px' }}
                        >
                          <ShieldCheck size={14} /> Reactivate
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Deleted accounts are handled by the deletion pipeline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <ScrollText size={18} color="#6366f1" /> Recent audit log
      </h2>
      <div style={{ overflowX: 'auto', border: '1px solid #1f2937', borderRadius: '12px', background: '#111827' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #1f2937' }}>
              <th style={cell}>When</th>
              <th style={cell}>Actor</th>
              <th style={cell}>Action</th>
              <th style={cell}>Resource</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...cell, color: '#9ca3af' }}>
                  {loading ? 'Loading…' : 'No audit entries visible (requires audit log permission).'}
                </td>
              </tr>
            )}
            {auditLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #1f2937' }}>
                <td style={cell}>{formatDate(log.createdAt)}</td>
                <td style={cell}>
                  {log.actorType}
                  {log.actorId ? <span style={{ color: '#6b7280', fontFamily: 'monospace' }}> {log.actorId.slice(0, 8)}</span> : null}
                </td>
                <td style={cell}>{log.action}</td>
                <td style={cell}>
                  {log.resourceType ?? '—'}
                  {log.resourceId ? <span style={{ color: '#6b7280', fontFamily: 'monospace' }}> {log.resourceId.slice(0, 12)}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </AuthGuard>
  );
}
