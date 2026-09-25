'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Code2, KeyRound, Webhook, Activity, ShieldAlert, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { AuthGuard } from '../../components/AuthGuard';
import {
  adminDeveloperPlatformApi,
  DeveloperPlatformOverview,
  DeveloperProjectDetail,
  DeveloperProjectRow,
  DeveloperProjectStatus,
} from '../../services/adminDeveloperPlatformApi';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981' },
  RESTRICTED: { bg: 'rgba(234, 179, 8, 0.15)', fg: '#eab308' },
  SUSPENDED: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
  DELIVERED: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981' },
  FAILED: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
  EXPIRED: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
};

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');
const fmtUsd = (v: number) => `$${v.toFixed(2)}`;

function Badge({ value }: { value: string }) {
  const c = STATUS_COLORS[value] ?? { bg: 'rgba(107, 114, 128, 0.15)', fg: '#9ca3af' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: c.bg, color: c.fg }}>
      {value}
    </span>
  );
}

const cell: React.CSSProperties = { padding: '14px 18px', verticalAlign: 'top' };
const head: React.CSSProperties = {
  textAlign: 'left',
  color: 'var(--text-muted)',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--surface-subtle)',
};
const panel: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--border-subtle)',
  borderRadius: '12px',
  background: 'var(--surface)',
  marginBottom: '24px',
};

export default function DeveloperPlatformAdminPage() {
  const [overview, setOverview] = useState<DeveloperPlatformOverview | null>(null);
  const [projects, setProjects] = useState<DeveloperProjectRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState<DeveloperProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, rows] = await Promise.all([
        adminDeveloperPlatformApi.getOverview(),
        adminDeveloperPlatformApi.listProjects(statusFilter),
      ]);
      setOverview(ov);
      setProjects(rows);
    } catch (err: any) {
      setError(err?.message || 'Failed to load developer platform data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openProject = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      setSelected(await adminDeveloperPlatformApi.getProject(id));
    } catch (err: any) {
      setError(err?.message || 'Failed to load project');
    }
  };

  const changeStatus = async (next: DeveloperProjectStatus) => {
    if (!selected) return;
    const reason = window.prompt(`Reason for setting "${selected.name}" to ${next} (recorded in the audit log):`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) setError('A reason of at least 3 characters is required.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await adminDeveloperPlatformApi.setProjectStatus(selected.id, next, reason.trim());
      setNotice(
        next === 'ACTIVE'
          ? `${selected.name} is active again.`
          : `${selected.name} is now ${next.toLowerCase()}; its API keys are rejected until it is reactivated.`
      );
      await Promise.all([openProject(selected.id), load()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to change project status');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthGuard>
      <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Code2 size={28} style={{ color: 'var(--accent-primary)' }} /> Developer Platform & Public APIs
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Oversight of developer projects, API keys, OAuth apps and webhook delivery health. Secrets are strictly hashed.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div role="alert" style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '14px' }}>
            {error}
          </div>
        )}
        {notice && (
          <div role="status" style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', fontSize: '14px' }}>
            {notice}
          </div>
        )}

        {selected ? (
          <>
            <button
              onClick={() => setSelected(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                padding: '8px 16px',
                borderRadius: '8px',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={16} /> Back to Projects Directory
            </button>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {selected.name} <Badge value={selected.status} />
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
                  {selected.slug} · {selected.environment} · owner <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{selected.userId}</span> · created {fmtDate(selected.createdAt)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {selected.status !== 'ACTIVE' && (
                  <button disabled={pending} onClick={() => changeStatus('ACTIVE')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #065f46', background: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                    <ShieldCheck size={16} /> Reactivate
                  </button>
                )}
                {selected.status !== 'RESTRICTED' && (
                  <button disabled={pending} onClick={() => changeStatus('RESTRICTED')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #713f12', background: 'rgba(234, 179, 8, 0.1)', color: '#fde68a', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                    Restrict
                  </button>
                )}
                {selected.status !== 'SUSPENDED' && (
                  <button disabled={pending} onClick={() => changeStatus('SUSPENDED')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #7f1d1d', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                    <ShieldAlert size={16} /> Suspend
                  </button>
                )}
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>API keys</h3>
            <div style={panel}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={head}>
                    <th style={cell}>Name</th>
                    <th style={cell}>Prefix</th>
                    <th style={cell}>Type</th>
                    <th style={cell}>Scopes</th>
                    <th style={cell}>Last used</th>
                    <th style={cell}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.apiKeys.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...cell, color: 'var(--text-muted)' }}>No API keys created yet.</td>
                    </tr>
                  )}
                  {selected.apiKeys.map((k) => (
                    <tr key={k.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ ...cell, fontWeight: 600, color: 'var(--text-primary)' }}>{k.name}</td>
                      <td style={{ ...cell, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{k.keyPrefix}…</td>
                      <td style={{ ...cell, color: 'var(--text-secondary)' }}>{k.keyType} · {k.environment}</td>
                      <td style={{ ...cell, color: 'var(--text-secondary)' }}>{Array.isArray(k.scopes) ? k.scopes.join(', ') : '—'}</td>
                      <td style={{ ...cell, color: 'var(--text-muted)' }}>{fmtDate(k.lastUsedAt)}</td>
                      <td style={cell}>{k.revokedAt ? <Badge value="REVOKED" /> : k.expiresAt && new Date(k.expiresAt) < new Date() ? <Badge value="EXPIRED" /> : <Badge value="ACTIVE" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Webhook endpoints</h3>
            <div style={panel}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={head}>
                    <th style={cell}>URL</th>
                    <th style={cell}>Events</th>
                    <th style={cell}>Consecutive failures</th>
                    <th style={cell}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.webhooks.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ ...cell, color: 'var(--text-muted)' }}>No webhook endpoints configured.</td>
                    </tr>
                  )}
                  {selected.webhooks.map((w) => (
                    <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ ...cell, wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{w.url}</td>
                      <td style={{ ...cell, color: 'var(--text-secondary)' }}>{Array.isArray(w.eventTypes) ? w.eventTypes.join(', ') : '—'}</td>
                      <td style={{ ...cell, color: w.failureCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>{w.failureCount}</td>
                      <td style={cell}>{w.active ? <Badge value="ACTIVE" /> : <Badge value="DISABLED" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Recent webhook deliveries</h3>
            <div style={panel}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={head}>
                    <th style={cell}>When</th>
                    <th style={cell}>Event</th>
                    <th style={cell}>Status</th>
                    <th style={cell}>HTTP</th>
                    <th style={cell}>Attempt</th>
                    <th style={cell}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.recentDeliveries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...cell, color: 'var(--text-muted)' }}>No deliveries yet.</td>
                    </tr>
                  )}
                  {selected.recentDeliveries.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ ...cell, color: 'var(--text-muted)' }}>{fmtDate(d.createdAt)}</td>
                      <td style={{ ...cell, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{d.eventType}</td>
                      <td style={cell}><Badge value={d.status} /></td>
                      <td style={{ ...cell, color: d.statusCode && d.statusCode >= 400 ? '#ef4444' : '#10b981' }}>{d.statusCode ?? '—'}</td>
                      <td style={{ ...cell, color: 'var(--text-muted)' }}>{d.attemptNumber}</td>
                      <td style={{ ...cell, color: 'var(--text-secondary)' }}>{d.durationMs != null ? `${d.durationMs} ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
              <div className="admin-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Projects</span>
                  <Code2 size={18} />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {overview ? `${overview.projects}` : '—'}
                </div>
                <span style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', display: 'block' }}>
                  {overview?.activeProjects || 0} active
                </span>
              </div>

              <div className="admin-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Active API Keys</span>
                  <KeyRound size={18} style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#8b5cf6' }}>
                  {overview ? String(overview.activeKeys) : '—'}
                </div>
              </div>

              <div className="admin-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Webhooks</span>
                  <Webhook size={18} style={{ color: '#38bdf8' }} />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8' }}>
                  {overview ? String(overview.activeWebhooks) : '—'}
                </div>
              </div>

              <div className="admin-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Delivery Rate (24h)</span>
                  <Activity size={18} style={{ color: '#10b981' }} />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981' }}>
                  {overview ? (overview.deliverySuccessRate24h == null ? '100%' : `${(overview.deliverySuccessRate24h * 100).toFixed(1)}%`) : '—'}
                </div>
              </div>

              <div className="admin-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Spend (MTD)</span>
                  <Activity size={18} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b' }}>
                  {overview ? fmtUsd(overview.monthToDateSpendUsd) : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Developer Projects</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter projects by status"
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="RESTRICTED">Restricted</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            <div className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={head}>
                    <th style={cell}>Project</th>
                    <th style={cell}>Status</th>
                    <th style={cell}>Keys / webhooks / OAuth</th>
                    <th style={cell}>Spend (MTD)</th>
                    <th style={cell}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} style={{ ...cell, color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>
                        Loading developer projects…
                      </td>
                    </tr>
                  )}
                  {!loading && projects.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...cell, color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>
                        No developer projects registered yet.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    projects.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => openProject(p.id)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        <td style={cell}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {p.slug} · {p.environment}
                          </div>
                        </td>
                        <td style={cell}>
                          <Badge value={p.status} />
                        </td>
                        <td style={{ ...cell, color: 'var(--text-secondary)' }}>
                          {p.activeKeys} / {p.activeWebhooks} / {p.oauthApps}
                        </td>
                        <td style={{ ...cell, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtUsd(p.monthToDateSpendUsd)}</td>
                        <td style={{ ...cell, color: 'var(--text-muted)' }}>{fmtDate(p.createdAt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
