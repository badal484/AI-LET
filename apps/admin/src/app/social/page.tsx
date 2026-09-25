'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, FlaskConical, Power, RefreshCw, Search, ShieldAlert, SlidersHorizontal, Users2, Bot, History, type LucideIcon } from 'lucide-react';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import type { SocialModerationCaseItem, SocialOverviewMetrics, SocialPolicyVersionItem, SocialSimulationResult } from '@ai-companion/types';
import { AdminSocialApi, type SocialPolicySnapshot } from '../../services/adminSocialApi';
import { MetricCard } from '../../components/MetricCard';

type Tab = 'overview' | 'moderation' | 'config' | 'simulator' | 'investigate' | 'ai';

const QUEUES = ['USER_CONTENT', 'COMMENTS', 'MESSAGES', 'COMMUNITIES', 'CREATORS', 'AI_SOCIAL_CONTENT', 'MEDIA', 'PROFILES'] as const;
const DECISIONS = ['DISMISS', 'RESTRICT_CONTENT', 'HIDE_CONTENT', 'REMOVE_CONTENT', 'RESTORE_CONTENT', 'RESTRICT_USER_SOCIAL', 'SUSPEND_USER', 'ESCALATE'] as const;
const DANGEROUS = new Set(['SUSPEND_USER', 'REMOVE_CONTENT', 'RESTRICT_USER_SOCIAL']);

const panel: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 };
const input: React.CSSProperties = { background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-primary)', padding: '9px 12px', fontSize: 13, width: '100%' };
const button = (tone: 'default' | 'primary' | 'danger' = 'default'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid ${tone === 'danger' ? 'var(--danger)' : tone === 'primary' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
  background: tone === 'primary' ? 'var(--accent-primary)' : 'transparent',
  color: tone === 'primary' ? '#fff' : tone === 'danger' ? 'var(--danger)' : 'var(--text-secondary)',
});
const muted: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12 };

function Toast({ message, tone }: { message: string; tone: 'ok' | 'error' }) {
  return (
    <div role="status" style={{ ...panel, padding: '12px 16px', marginBottom: 16, borderColor: tone === 'ok' ? 'var(--success)' : 'var(--danger)', color: tone === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
      {message}
    </div>
  );
}

/** Requires a typed reason AND an explicit confirmation before a dangerous change is sent. */
function useConfirmedAction(onToast: (m: string, t: 'ok' | 'error') => void) {
  return useCallback(
    async (label: string, run: (reason: string) => Promise<unknown>) => {
      const reason = window.prompt(`${label}\n\nThis change is versioned and audited. Enter a reason (min 10 characters):`);
      if (!reason || reason.trim().length < 10) {
        onToast('Cancelled — a reason of at least 10 characters is required.', 'error');
        return false;
      }
      if (!window.confirm(`Confirm: ${label}?`)) return false;
      try {
        await run(reason.trim());
        onToast(`${label} — applied.`, 'ok');
        return true;
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Request failed', 'error');
        return false;
      }
    },
    [onToast],
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab() {
  const [days, setDays] = useState(7);
  const [m, setM] = useState<SocialOverviewMetrics | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([AdminSocialApi.overview(days), AdminSocialApi.graphHealth()])
      .then(([o, h]) => {
        setM(o);
        setHealth(h);
      })
      .catch((e: Error) => setError(e.message));
  }, [days]);

  if (error) return <Toast message={error} tone="error" />;
  if (!m) return <p style={muted}>Loading social metrics…</p>;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={muted}>Window</span>
        {[1, 7, 30].map((d) => (
          <button key={d} style={button(d === days ? 'primary' : 'default')} onClick={() => setDays(d)} aria-pressed={d === days}>
            {d}d
          </button>
        ))}
      </div>

      <section aria-label="Safety guardrails">
        <h3 style={{ fontSize: 14, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <ShieldAlert size={16} /> Safety guardrails
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MetricCard title="Reports / 1k content" value={m.reportRatePer1kContent} />
          <MetricCard title="Blocks / 1k follows" value={m.blockRatePer1kFollows} />
          <MetricCard title="Content rejection rate" value={pct(m.contentRejectionRate)} />
          <MetricCard title="Open moderation cases" value={m.openCases} />
          <MetricCard title="AI actions denied" value={m.aiSocialActionsDenied} />
        </div>
      </section>

      <section aria-label="Activity">
        <h3 style={{ fontSize: 14, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Activity size={16} /> Activity
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <MetricCard title="Social profiles" value={m.socialProfiles} />
          <MetricCard title="Active social users" value={m.activeSocialUsers} />
          <MetricCard title="Follows" value={m.follows} />
          <MetricCard title="Character follows" value={m.characterFollows} />
          <MetricCard title="Shares" value={m.shares} />
          <MetricCard title="Comments" value={m.comments} />
          <MetricCard title="Reactions" value={m.reactions} />
          <MetricCard title="Message requests" value={m.messageRequests} />
          <MetricCard title="Communities created" value={m.communities} />
          <MetricCard title="AI actions executed" value={m.aiSocialActionsAllowed} />
        </div>
      </section>

      <section style={panel} aria-label="Graph health">
        <h3 style={{ fontSize: 14, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={16} /> Graph health (internal abuse signals)
        </h3>
        <p style={{ ...muted, marginBottom: 12 }}>Signals are for investigation only and are never shown to users.</p>
        <pre style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(health, null, 2)}</pre>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

function ModerationTab({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [queue, setQueue] = useState<string>('USER_CONTENT');
  const [cases, setCases] = useState<SocialModerationCaseItem[]>([]);
  const [selected, setSelected] = useState<Awaited<ReturnType<typeof AdminSocialApi.caseDetail>> | null>(null);
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]>('DISMISS');
  const [notes, setNotes] = useState('');
  const [userReason, setUserReason] = useState('');
  const [hours, setHours] = useState<number | ''>('');
  const [appeals, setAppeals] = useState<Awaited<ReturnType<typeof AdminSocialApi.appeals>>>([]);

  const load = useCallback(() => {
    AdminSocialApi.cases(queue).then((p) => setCases(p.items)).catch((e: Error) => toast(e.message, 'error'));
    AdminSocialApi.appeals().then(setAppeals).catch(() => setAppeals([]));
  }, [queue, toast]);
  useEffect(load, [load]);

  const submit = async () => {
    if (!selected) return;
    if (notes.trim().length < 3) return toast('Moderator notes are required.', 'error');
    if (DANGEROUS.has(decision) && !window.confirm(`${decision} is a high-impact action. Continue?`)) return;
    try {
      await AdminSocialApi.decide(selected.case.id, {
        decision,
        notes,
        userFacingReason: userReason || undefined,
        restrictionHours: hours === '' ? undefined : Number(hours),
        confirm: DANGEROUS.has(decision) ? true : undefined,
      });
      toast(`Decision ${decision} applied.`, 'ok');
      setSelected(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 20 }}>
      <div style={panel}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }} role="tablist" aria-label="Moderation queues">
          {QUEUES.map((q) => (
            <button key={q} role="tab" aria-selected={q === queue} style={button(q === queue ? 'primary' : 'default')} onClick={() => setQueue(q)}>
              {q.replace(/_/g, ' ').toLowerCase()}
            </button>
          ))}
        </div>
        {cases.length === 0 ? (
          <p style={muted}>No open cases in this queue.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ ...muted, textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Priority</th>
                <th style={{ padding: 8 }}>Severity</th>
                <th style={{ padding: 8 }}>Reporters</th>
                <th style={{ padding: 8 }}>Top reasons</th>
                <th style={{ padding: 8 }}>Reach</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  onClick={() => AdminSocialApi.caseDetail(c.id).then(setSelected).catch((e: Error) => toast(e.message, 'error'))}
                  onKeyDown={(e) => e.key === 'Enter' && AdminSocialApi.caseDetail(c.id).then(setSelected)}
                  style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', background: selected?.case.id === c.id ? 'var(--surface-hover)' : undefined }}
                >
                  <td style={{ padding: 8, fontWeight: 600 }}>{c.priorityScore.toFixed(0)}</td>
                  <td style={{ padding: 8 }}>{c.severity}</td>
                  <td style={{ padding: 8 }}>{c.uniqueReporterCount}</td>
                  <td style={{ padding: 8 }}>{Object.entries(c.reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join(', ') || '—'}</td>
                  <td style={{ padding: 8 }}>{c.reach}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ ...muted, marginTop: 12 }}>Report volume alone never determines an outcome; review the content and automated signals.</p>
      </div>

      <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
        {selected ? (
          <div style={panel}>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>{selected.case.targetType} case</h3>
            <p style={muted}>
              {selected.case.reportCount} reports · automated signals: {selected.case.automatedSignals ? 'yes' : 'none'}
            </p>
            <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: '12px 0', maxHeight: 220, overflow: 'auto', color: 'var(--text-secondary)' }}>{JSON.stringify(selected.target, null, 2)}</pre>
            <label style={muted} htmlFor="decision">Decision</label>
            <select id="decision" value={decision} onChange={(e) => setDecision(e.target.value as (typeof DECISIONS)[number])} style={{ ...input, marginBottom: 10 }}>
              {DECISIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {(decision === 'RESTRICT_USER_SOCIAL' || decision === 'SUSPEND_USER') && (
              <input aria-label="Restriction hours" placeholder="Duration in hours (blank = indefinite)" type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...input, marginBottom: 10 }} />
            )}
            <input aria-label="User-facing reason" placeholder="What the user will be told (no anti-abuse details)" value={userReason} onChange={(e) => setUserReason(e.target.value)} style={{ ...input, marginBottom: 10 }} />
            <textarea aria-label="Moderator notes" placeholder="Internal moderator notes (required, audited)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...input, minHeight: 80, marginBottom: 10 }} />
            <button style={button(DANGEROUS.has(decision) ? 'danger' : 'primary')} onClick={submit}>Apply decision</button>
          </div>
        ) : (
          <div style={panel}><p style={muted}>Select a case to review it.</p></div>
        )}

        <div style={panel}>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Appeals</h3>
          {appeals.length === 0 && <p style={muted}>No pending appeals.</p>}
          {appeals.map((a) => (
            <div key={a.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 0' }}>
              <p style={{ fontSize: 13 }}>{a.reason}</p>
              <p style={muted}>Case {a.case.decision} · {new Date(a.createdAt).toLocaleString()}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {(['UPHOLD', 'REVERSE'] as const).map((d) => (
                  <button
                    key={d}
                    style={button(d === 'REVERSE' ? 'primary' : 'default')}
                    onClick={async () => {
                      const n = window.prompt(`Notes for ${d.toLowerCase()} (audited):`);
                      if (!n) return;
                      await AdminSocialApi.decideAppeal(a.id, d, n).then(() => toast(`Appeal ${d.toLowerCase()}d.`, 'ok'), (e: Error) => toast(e.message, 'error'));
                      load();
                    }}
                  >
                    {d === 'UPHOLD' ? 'Uphold' : 'Reverse'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuration: versioned policy, rollout, kill switches, rollback
// ---------------------------------------------------------------------------

function ConfigTab({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [policy, setPolicy] = useState<SocialPolicySnapshot | null>(null);
  const [versions, setVersions] = useState<SocialPolicyVersionItem[]>([]);
  const [patchText, setPatchText] = useState('{\n  "comments": { "maxLength": 1000 }\n}');
  const confirmed = useConfirmedAction(toast);

  const load = useCallback(() => {
    AdminSocialApi.policy().then(setPolicy).catch((e: Error) => toast(e.message, 'error'));
    AdminSocialApi.policyVersions().then(setVersions).catch(() => setVersions([]));
  }, [toast]);
  useEffect(load, [load]);

  const parsedPatch = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(patchText) as Record<string, unknown> };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [patchText]);

  if (!policy) return <p style={muted}>Loading policy…</p>;
  const features = Object.entries(policy.config.features);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 20 }}>
      <div style={panel}>
        <h3 style={{ fontSize: 15, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Power size={16} /> Features & kill switches <span style={muted}>(policy v{policy.version})</span>
        </h3>
        <p style={{ ...muted, marginBottom: 12 }}>A kill switch disables a feature everywhere immediately, regardless of rollout. Blocking and reporting can never be switched off.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ ...muted, textAlign: 'left' }}>
              <th style={{ padding: 6 }}>Feature</th>
              <th style={{ padding: 6 }}>Enabled</th>
              <th style={{ padding: 6 }}>Rollout</th>
              <th style={{ padding: 6 }}>Cohorts</th>
              <th style={{ padding: 6 }}>Kill switch</th>
            </tr>
          </thead>
          <tbody>
            {features.map(([key, r]) => {
              const killed = policy.config.killSwitches[key];
              return (
                <tr key={key} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: 6, fontFamily: 'monospace' }}>{key}</td>
                  <td style={{ padding: 6 }}>{r.enabled ? 'Yes' : 'No'}</td>
                  <td style={{ padding: 6 }}>{r.rolloutPercent}%</td>
                  <td style={{ padding: 6 }}>{r.cohorts.join(', ') || '—'}</td>
                  <td style={{ padding: 6 }}>
                    <button
                      style={button(killed ? 'danger' : 'default')}
                      aria-pressed={killed}
                      onClick={async () => {
                        if (await confirmed(`${killed ? 'Release' : 'Activate'} kill switch for ${key}`, (reason) => AdminSocialApi.setKillSwitch(key, !killed, reason))) load();
                      }}
                    >
                      {killed ? 'ACTIVE — release' : 'Activate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
        <div style={panel}>
          <h3 style={{ fontSize: 15, marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <SlidersHorizontal size={16} /> Edit policy (patch)
          </h3>
          <p style={{ ...muted, marginBottom: 8 }}>Deep-merged onto the active version. Unknown keys are rejected. Produces a new version with a diff.</p>
          <textarea aria-label="Policy patch JSON" value={patchText} onChange={(e) => setPatchText(e.target.value)} spellCheck={false} style={{ ...input, minHeight: 160, fontFamily: 'monospace' }} />
          {!parsedPatch.ok && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{parsedPatch.error}</p>}
          <button
            style={{ ...button('primary'), marginTop: 10 }}
            disabled={!parsedPatch.ok}
            onClick={async () => {
              if (parsedPatch.ok && (await confirmed('Publish new social policy version', (reason) => AdminSocialApi.updatePolicy(parsedPatch.value, reason)))) load();
            }}
          >
            Publish version
          </button>
        </div>

        <div style={panel}>
          <h3 style={{ fontSize: 15, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <History size={16} /> Version history
          </h3>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            {versions.map((v) => (
              <div key={v.version} style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>v{v.version}{v.isActive ? ' · active' : ''}{v.rolledBackFrom ? ` · rollback of v${v.rolledBackFrom}` : ''}</strong>
                  {!v.isActive && (
                    <button style={button()} onClick={async () => { if (await confirmed(`Roll back to v${v.version}`, (reason) => AdminSocialApi.rollback(v.version, reason))) load(); }}>
                      Roll back to this
                    </button>
                  )}
                </div>
                <p style={muted}>{v.changeReason} · {new Date(v.effectiveAt).toLocaleString()}</p>
                {v.diff && Object.keys(v.diff).length > 0 && (
                  <pre style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: 4 }}>
                    {Object.entries(v.diff).slice(0, 6).map(([k, d]) => `${k}: ${JSON.stringify((d as { from: unknown }).from)} → ${JSON.stringify((d as { to: unknown }).to)}`).join('\n')}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

function SimulatorTab({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [action, setAction] = useState<'VIEW_PROFILE' | 'FOLLOW' | 'MESSAGE' | 'MESSAGE_REQUEST' | 'COMMENT' | 'MENTION' | 'NOTIFY' | 'CHARACTER_POST' | 'CHARACTER_REPLY' | 'RECOMMEND'>('FOLLOW');
  const [actor, setActor] = useState('');
  const [target, setTarget] = useState('');
  const [characterSlug, setCharacterSlug] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState<SocialSimulationResult | null>(null);
  const characterAction = action === 'CHARACTER_POST' || action === 'CHARACTER_REPLY';

  const run = () =>
    AdminSocialApi.simulate({ action, actor: actor || undefined, target: target || undefined, characterSlug: characterSlug || undefined, text: text || undefined })
      .then(setResult)
      .catch((e: Error) => toast(e.message, 'error'));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}>
      <div style={{ ...panel, display: 'grid', gap: 10, alignContent: 'start' }}>
        <p style={muted}>Runs the same policy code as production, read-only. Nothing is written.</p>
        <label style={muted} htmlFor="sim-action">Action</label>
        <select id="sim-action" value={action} onChange={(e) => setAction(e.target.value as typeof action)} style={input}>
          {['VIEW_PROFILE', 'FOLLOW', 'MESSAGE', 'MESSAGE_REQUEST', 'COMMENT', 'MENTION', 'NOTIFY', 'RECOMMEND', 'CHARACTER_POST', 'CHARACTER_REPLY'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {!characterAction && <input aria-label="Actor" placeholder="User A (public id or username)" value={actor} onChange={(e) => setActor(e.target.value)} style={input} />}
        {characterAction && <input aria-label="Character slug" placeholder="Character slug" value={characterSlug} onChange={(e) => setCharacterSlug(e.target.value)} style={input} />}
        <input aria-label="Target" placeholder={action === 'COMMENT' ? 'Content public id' : action === 'CHARACTER_REPLY' ? 'Comment id' : 'User B (public id or username)'} value={target} onChange={(e) => setTarget(e.target.value)} style={input} />
        {(action === 'COMMENT' || characterAction) && <textarea aria-label="Text" placeholder="Text to evaluate" value={text} onChange={(e) => setText(e.target.value)} style={{ ...input, minHeight: 80 }} />}
        <button style={button('primary')} onClick={run}><FlaskConical size={14} /> Simulate</button>
      </div>
      <div style={panel} aria-live="polite">
        {!result ? (
          <p style={muted}>Results appear here with each policy check.</p>
        ) : (
          <>
            <h3 style={{ fontSize: 15, marginBottom: 8, color: result.allowed ? 'var(--success)' : 'var(--danger)' }}>
              {result.allowed ? 'Allowed' : 'Denied'} · {result.decision.action}
            </h3>
            <ol style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
              {result.steps.map((s, i) => (
                <li key={i} style={{ fontSize: 13 }}>
                  <strong>{s.passed ? 'PASS' : 'FAIL'}</strong> {s.check} — <span style={muted}>{s.detail}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investigations & AI actions
// ---------------------------------------------------------------------------

function InvestigateTab({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [handle, setHandle] = useState('');
  const [data, setData] = useState<(Record<string, unknown> & { userId: string }) | null>(null);
  const confirmed = useConfirmedAction(toast);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ ...panel, display: 'flex', gap: 10 }}>
        <input aria-label="User handle" placeholder="Username, public id, or user id" value={handle} onChange={(e) => setHandle(e.target.value)} style={input} />
        <button style={button('primary')} onClick={() => AdminSocialApi.investigate(handle).then(setData).catch((e: Error) => toast(e.message, 'error'))}>
          <Search size={14} /> Look up
        </button>
      </div>
      {data && (
        <div style={panel}>
          <p style={{ ...muted, marginBottom: 10 }}>Metadata only. Private message content is never shown here; it requires break-glass access tied to a case.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {['CANNOT_COMMENT', 'CANNOT_DIRECT_MESSAGE', 'CANNOT_SHARE_CONTENT', 'SOCIAL_RESTRICTED'].map((t) => (
              <button key={t} style={button('danger')} onClick={() => confirmed(`Issue ${t} (72h) for this user`, (reason) => AdminSocialApi.restrict(data.userId, t, reason, 72))}>
                {t.replace(/_/g, ' ').toLowerCase()} · 72h
              </button>
            ))}
          </div>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', maxHeight: 480, overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function AiActionsTab({ toast }: { toast: (m: string, t: 'ok' | 'error') => void }) {
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [slug, setSlug] = useState('');
  const confirmed = useConfirmedAction(toast);
  useEffect(() => {
    AdminSocialApi.actionLogs('AI_CHARACTER').then(setLogs).catch((e: Error) => toast(e.message, 'error'));
  }, [toast]);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ ...panel, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input aria-label="Character slug" placeholder="Character slug" value={slug} onChange={(e) => setSlug(e.target.value)} style={input} />
        <button style={button('primary')} onClick={() => confirmed(`Approve social capabilities for ${slug}`, (reason) => AdminSocialApi.approveCharacter(slug, true, reason))}>Approve</button>
        <button style={button('danger')} onClick={() => confirmed(`Revoke social approval for ${slug}`, (reason) => AdminSocialApi.approveCharacter(slug, false, reason))}>Revoke</button>
      </div>
      <div style={panel}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Recent AI social actions (audit)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ ...muted, textAlign: 'left' }}>
              {['When', 'Action', 'Decision', 'Status', 'Reasons', 'Generation', 'Cost (¢)'].map((h) => (
                <th key={h} style={{ padding: 6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={String(l['id'])} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: 6 }}>{new Date(String(l['createdAt'])).toLocaleString()}</td>
                <td style={{ padding: 6 }}>{String(l['action'])}</td>
                <td style={{ padding: 6 }}>{String(l['decision'])}</td>
                <td style={{ padding: 6 }}>{String(l['status'] ?? '—')}</td>
                <td style={{ padding: 6 }}>{Array.isArray(l['reasons']) ? (l['reasons'] as string[]).join(', ') : ''}</td>
                <td style={{ padding: 6, fontFamily: 'monospace' }}>{String(l['generationId'] ?? '—')}</td>
                <td style={{ padding: 6 }}>{String(l['costCents'] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const TABS: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { key: 'config', label: 'Configuration', icon: SlidersHorizontal },
  { key: 'simulator', label: 'Simulator', icon: FlaskConical },
  { key: 'investigate', label: 'Investigations', icon: Users2 },
  { key: 'ai', label: 'AI Social Actions', icon: Bot },
];

export default function SocialStudioPage() {
  const { admin } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [toastState, setToastState] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null);
  const [nonce, setNonce] = useState(0);
  const toast = useCallback((message: string, tone: 'ok' | 'error') => {
    setToastState({ message, tone });
    window.setTimeout(() => setToastState(null), 5000);
  }, []);

  return (
    <AuthGuard>
      <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Social Studio</h1>
          <p style={{ ...muted, fontSize: 13, marginTop: 4 }}>Safety, moderation, rollout and incident controls for the social layer. Every change is versioned and audited.</p>
        </div>
        <button style={button()} onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {toastState && <Toast message={toastState.message} tone={toastState.tone} />}

      <nav role="tablist" aria-label="Social Studio sections" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === key ? 'var(--accent-primary)' : 'transparent'}`,
              color: tab === key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: tab === key ? 600 : 500,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      <div key={nonce}>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'moderation' && <ModerationTab toast={toast} />}
        {tab === 'config' && <ConfigTab toast={toast} />}
        {tab === 'simulator' && <SimulatorTab toast={toast} />}
        {tab === 'investigate' && <InvestigateTab toast={toast} />}
        {tab === 'ai' && <AiActionsTab toast={toast} />}
      </div>
    </div>
    </AuthGuard>
  );
}
