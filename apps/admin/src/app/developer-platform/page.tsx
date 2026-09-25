'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Code2, KeyRound, Webhook, Activity, ShieldAlert, ShieldCheck, ArrowLeft } from 'lucide-react';
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
    <span style={{ padding: '3px 9px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, background: c.bg, color: c.fg }}>
      {value}
    </span>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 180px', padding: '18px', borderRadius: '12px', background: '#111827', border: '1px solid #1f2937' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '13px' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '6px' }}>{value}</div>
    </div>
  );
}

const cell: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'top' };
const head: React.CSSProperties = { textAlign: 'left', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #1f2937' };
const panel: React.CSSProperties = { overflowX: 'auto', border: '1px solid #1f2937', borderRadius: '12px', background: '#111827', marginBottom: '24px' };

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
          : `${selected.name} is now ${next.toLowerCase()}; its API keys are rejected until it is reactivated.`,
      );
      await Promise.all([openProject(selected.id), load()]);
    } catch (err: any) {
      setError(err?.message || 'Failed to change project status');
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#f3f4f6' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Code2 size={28} color="#6366f1" /> Developer Platform
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
          Oversight of developer projects, API keys, OAuth apps and webhook delivery health. Secrets are never shown.
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

      {selected ? (
        <>
          <button
            onClick={() => setSelected(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px', background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: '14px' }}
          >
            <ArrowLeft size={16} /> All projects
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                {selected.name} <Badge value={selected.status} />
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>
                {selected.slug} · {selected.environment} · owner <span style={{ fontFamily: 'monospace' }}>{selected.userId}</span> · created {fmtDate(selected.createdAt)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selected.status !== 'ACTIVE' && (
                <button disabled={pending} onClick={() => changeStatus('ACTIVE')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: '1px solid #065f46', background: 'transparent', color: '#6ee7b7', cursor: 'pointer' }}>
                  <ShieldCheck size={15} /> Reactivate
                </button>
              )}
              {selected.status !== 'RESTRICTED' && (
                <button disabled={pending} onClick={() => changeStatus('RESTRICTED')} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #713f12', background: 'transparent', color: '#fde68a', cursor: 'pointer' }}>
                  Restrict
                </button>
              )}
              {selected.status !== 'SUSPENDED' && (
                <button disabled={pending} onClick={() => changeStatus('SUSPENDED')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: '1px solid #7f1d1d', background: 'transparent', color: '#fca5a5', cursor: 'pointer' }}>
                  <ShieldAlert size={15} /> Suspend
                </button>
              )}
            </div>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>API keys</h3>
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
                    <td colSpan={6} style={{ ...cell, color: '#9ca3af' }}>No API keys.</td>
                  </tr>
                )}
                {selected.apiKeys.map((k) => (
                  <tr key={k.id} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={cell}>{k.name}</td>
                    <td style={{ ...cell, fontFamily: 'monospace' }}>{k.keyPrefix}…</td>
                    <td style={cell}>{k.keyType} · {k.environment}</td>
                    <td style={cell}>{Array.isArray(k.scopes) ? k.scopes.join(', ') : '—'}</td>
                    <td style={cell}>{fmtDate(k.lastUsedAt)}</td>
                    <td style={cell}>{k.revokedAt ? <Badge value="REVOKED" /> : k.expiresAt && new Date(k.expiresAt) < new Date() ? <Badge value="EXPIRED" /> : <Badge value="ACTIVE" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Webhook endpoints</h3>
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
                    <td colSpan={4} style={{ ...cell, color: '#9ca3af' }}>No webhook endpoints.</td>
                  </tr>
                )}
                {selected.webhooks.map((w) => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={{ ...cell, wordBreak: 'break-all' }}>{w.url}</td>
                    <td style={cell}>{Array.isArray(w.eventTypes) ? w.eventTypes.join(', ') : '—'}</td>
                    <td style={cell}>{w.failureCount}</td>
                    <td style={cell}>{w.active ? <Badge value="ACTIVE" /> : <Badge value="DISABLED" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Recent webhook deliveries</h3>
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
                    <td colSpan={6} style={{ ...cell, color: '#9ca3af' }}>No deliveries yet.</td>
                  </tr>
                )}
                {selected.recentDeliveries.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={cell}>{fmtDate(d.createdAt)}</td>
                    <td style={cell}>{d.eventType}</td>
                    <td style={cell}><Badge value={d.status} /></td>
                    <td style={cell}>{d.statusCode ?? '—'}</td>
                    <td style={cell}>{d.attemptNumber}</td>
                    <td style={cell}>{d.durationMs != null ? `${d.durationMs} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>OAuth applications</h3>
          <div style={panel}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={head}>
                  <th style={cell}>Name</th>
                  <th style={cell}>Client ID</th>
                  <th style={cell}>Type</th>
                  <th style={cell}>Created</th>
                </tr>
              </thead>
              <tbody>
                {selected.oauthApps.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ ...cell, color: '#9ca3af' }}>No OAuth applications.</td>
                  </tr>
                )}
                {selected.oauthApps.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={cell}>{a.name}</td>
                    <td style={{ ...cell, fontFamily: 'monospace' }}>{a.clientId}</td>
                    <td style={cell}>{a.clientType}{a.isPublicClient ? ' · public (PKCE)' : ' · confidential'}</td>
                    <td style={cell}>{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            <Stat label="Projects (active)" value={overview ? `${overview.projects} (${overview.activeProjects})` : '—'} icon={<Code2 size={15} />} />
            <Stat label="Active API keys" value={overview ? String(overview.activeKeys) : '—'} icon={<KeyRound size={15} />} />
            <Stat label="Active webhooks" value={overview ? String(overview.activeWebhooks) : '—'} icon={<Webhook size={15} />} />
            <Stat
              label="Delivery success (24h)"
              value={overview ? (overview.deliverySuccessRate24h == null ? 'No deliveries' : `${(overview.deliverySuccessRate24h * 100).toFixed(1)}% of ${overview.deliveries24h}`) : '—'}
              icon={<Activity size={15} />}
            />
            <Stat label="Spend, month to date" value={overview ? fmtUsd(overview.monthToDateSpendUsd) : '—'} icon={<Activity size={15} />} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Projects</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter projects by status"
              style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#f3f4f6' }}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="RESTRICTED">Restricted</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <div style={panel}>
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
                    <td colSpan={5} style={{ ...cell, color: '#9ca3af' }}>Loading projects…</td>
                  </tr>
                )}
                {!loading && projects.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...cell, color: '#9ca3af' }}>No developer projects yet.</td>
                  </tr>
                )}
                {!loading &&
                  projects.map((p) => (
                    <tr key={p.id} onClick={() => openProject(p.id)} style={{ borderBottom: '1px solid #1f2937', cursor: 'pointer' }}>
                      <td style={cell}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{p.slug} · {p.environment}</div>
                      </td>
                      <td style={cell}><Badge value={p.status} /></td>
                      <td style={cell}>{p.activeKeys} / {p.activeWebhooks} / {p.oauthApps}</td>
                      <td style={cell}>{fmtUsd(p.monthToDateSpendUsd)}</td>
                      <td style={cell}>{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
