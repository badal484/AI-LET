'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, Search, ShieldAlert, ShieldCheck, ScrollText, UserCheck, Smartphone, KeyRound, RefreshCw, AlertTriangle } from 'lucide-react';
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

const STATUS_COLORS: Record<UserStatus, { bg: string; fg: string; border: string }> = {
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.12)', fg: '#34D399', border: 'rgba(16, 185, 129, 0.3)' },
  SUSPENDED: { bg: 'rgba(239, 68, 68, 0.12)', fg: '#F87171', border: 'rgba(239, 68, 68, 0.3)' },
  PENDING: { bg: 'rgba(245, 158, 11, 0.12)', fg: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },
  DELETED: { bg: 'rgba(100, 116, 139, 0.12)', fg: '#94A3B8', border: 'rgba(100, 116, 139, 0.3)' },
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
  }, [appliedSearch, status, admin]);

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

  const cell: React.CSSProperties = { padding: '16px 20px', verticalAlign: 'middle' };

  return (
    <AuthGuard>
      <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto', color: '#F8FAFC' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#A855F7',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Governance & Directory
              </span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Users & Account Management
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '6px', margin: 0 }}>
              Search member identities, review concurrent session activity, and enforce security policies.
            </p>
          </div>

          <button
            onClick={load}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: '#E2E8F0',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Directory
          </button>
        </div>

        {/* Telemetry Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>Total Users</span>
              <Users size={16} color="#A855F7" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFFFFF', marginTop: '8px' }}>
              {users.length}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              Active platform accounts
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>Active Sessions</span>
              <Smartphone size={16} color="#10B981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#34D399', marginTop: '8px' }}>
              {users.reduce((acc, u) => acc + (u.activeSessionsCount || 0), 0)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              Live connected devices
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>Suspensions</span>
              <AlertTriangle size={16} color="#EF4444" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#F87171', marginTop: '8px' }}>
              {users.filter((u) => u.status === 'SUSPENDED').length}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              Revoked access accounts
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>Verified Identities</span>
              <UserCheck size={16} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#60A5FA', marginTop: '8px' }}>
              {users.length > 0 ? Math.round((users.filter((u) => u.emailVerified).length / users.length) * 100) : 100}%
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              Email confirmation rate
            </span>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontSize: '13px' }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', fontSize: '13px' }}>
            {notice}
          </div>
        )}

        {/* Filter & Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearch(search.trim());
          }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '22px' }}
        >
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={15} color="#64748B" style={{ position: 'absolute', left: '14px', top: '12px' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, display name, username, or ID..."
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: '#0C1019',
                color: '#FFFFFF',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: '#0C1019',
              color: '#CBD5E1',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="ALL">All account statuses</option>
            <option value="ACTIVE">Active accounts only</option>
            <option value="SUSPENDED">Suspended accounts only</option>
            <option value="PENDING">Pending verification</option>
            <option value="DELETED">Deleted accounts</option>
          </select>
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: '#A855F7',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Search
          </button>
        </form>

        {/* Users Table */}
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '16px',
            background: '#0C1019',
            marginBottom: '36px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  color: '#64748B',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <th style={cell}>Account Profile</th>
                <th style={cell}>Status</th>
                <th style={cell}>Active Sessions</th>
                <th style={cell}>Joined</th>
                <th style={cell}>Last Seen</th>
                <th style={{ ...cell, textAlign: 'right' }}>Security Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ ...cell, color: '#94A3B8', textAlign: 'center', padding: '40px' }}>
                    Loading user identities…
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...cell, color: '#94A3B8', textAlign: 'center', padding: '40px' }}>
                    No users match current filters.
                  </td>
                </tr>
              )}
              {!loading &&
                users.map((user) => {
                  const colors = STATUS_COLORS[user.status] ?? STATUS_COLORS.DELETED;
                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={cell}>
                        <div style={{ fontWeight: '700', color: '#FFFFFF', fontSize: '14px' }}>
                          {user.profile?.displayName || user.email}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                          {user.email}
                          {user.profile?.username ? ` · @${user.profile.username}` : ''}
                          {user.emailVerified ? (
                            <span style={{ color: '#10B981', marginLeft: '6px' }}>✓ Verified</span>
                          ) : (
                            <span style={{ color: '#F59E0B', marginLeft: '6px' }}>· Unverified</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace', marginTop: '2px' }}>
                          ID: {user.id}
                        </div>
                      </td>
                      <td style={cell}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: colors.bg,
                            color: colors.fg,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '3px', backgroundColor: colors.fg }} />
                          {user.status}
                        </span>
                      </td>
                      <td style={cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E2E8F0' }}>
                          <Smartphone size={13} color="#94A3B8" />
                          <span>{user.activeSessionsCount} active ({user.activeDevicesCount} devices)</span>
                        </div>
                      </td>
                      <td style={{ ...cell, color: '#94A3B8' }}>{formatDate(user.createdAt)}</td>
                      <td style={{ ...cell, color: '#94A3B8' }}>{formatDate(user.lastLoginAt)}</td>
                      <td style={{ ...cell, textAlign: 'right' }}>
                        {user.status === 'ACTIVE' || user.status === 'PENDING' ? (
                          <button
                            onClick={() => changeStatus(user, 'SUSPENDED')}
                            disabled={pendingId === user.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#F87171',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                          >
                            <ShieldAlert size={13} /> Suspend
                          </button>
                        ) : user.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => changeStatus(user, 'ACTIVE')}
                            disabled={pendingId === user.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              background: 'rgba(16, 185, 129, 0.08)',
                              color: '#34D399',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}
                          >
                            <ShieldCheck size={13} /> Reactivate
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748B' }}>Managed by pipeline</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Audit Log Card */}
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ScrollText size={18} color="#A855F7" />
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF', margin: 0 }}>
            Security Audit Trail
          </h2>
        </div>
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '16px',
            background: '#0C1019',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  color: '#64748B',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <th style={cell}>Timestamp</th>
                <th style={cell}>Actor Type</th>
                <th style={cell}>Action Taken</th>
                <th style={cell}>Target Resource</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: '#94A3B8', textAlign: 'center', padding: '32px' }}>
                    {loading ? 'Loading audit records…' : 'No recent audit logs available.'}
                  </td>
                </tr>
              )}
              {auditLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ ...cell, color: '#94A3B8' }}>{formatDate(log.createdAt)}</td>
                  <td style={cell}>
                    <span style={{ color: '#E2E8F0', fontWeight: '600' }}>{log.actorType}</span>
                    {log.actorId ? (
                      <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '11px' }}> ({log.actorId.slice(0, 8)})</span>
                    ) : null}
                  </td>
                  <td style={cell}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        color: '#D8B4FE',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td style={{ ...cell, color: '#94A3B8' }}>
                    {log.resourceType ?? '—'}
                    {log.resourceId ? (
                      <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '11px' }}> ({log.resourceId.slice(0, 12)})</span>
                    ) : null}
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

