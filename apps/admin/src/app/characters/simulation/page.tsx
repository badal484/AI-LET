'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard, useAdminAuth } from '../../../components/AuthGuard';
import { adminAIApi } from '../../../services/adminAIApi';

type SimulationTab =
  | 'overview'
  | 'goals'
  | 'plans'
  | 'routines'
  | 'commitments'
  | 'world_state'
  | 'autonomy'
  | 'playground'
  | 'replay'
  | 'migration'
  | 'governance';

export default function CharacterSimulationStudioPage() {
  const { admin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<SimulationTab>('overview');
  const [characterId, setCharacterId] = useState('char-aria');
  const [userId, setUserId] = useState('');
  const hasUser = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId.trim());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data Collections
  const [runs, setRuns] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [commitments, setCommitments] = useState<any[]>([]);
  const [worldState, setWorldState] = useState<any[]>([]);
  const [worldEvents, setWorldEvents] = useState<any[]>([]);
  const [settings, setSettings] = useState<any | null>(null);
  const [contextPack, setContextPack] = useState<any | null>(null);

  // Playground & Time Travel
  const [timeOffsetDays, setTimeOffsetDays] = useState(0);
  const [sandboxPrompt, setSandboxPrompt] = useState('User mentioned they started painting watercolors on Sunday.');
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);
  const [executingSim, setExecutingSim] = useState(false);

  // Replay
  const [selectedRunId, setSelectedRunId] = useState('');
  const [replayResult, setReplayResult] = useState<any | null>(null);
  const [replaying, setReplaying] = useState(false);

  // Migration
  const [targetVersionId, setTargetVersionId] = useState('v2.0.0');
  const [migrationStrategy, setMigrationStrategy] = useState('MIGRATE_COMPATIBLE');
  const [migrationResult, setMigrationResult] = useState<any | null>(null);
  const [migrating, setMigrating] = useState(false);

  // New Entity Forms
  const [newGoal, setNewGoal] = useState({ title: '', description: '', goalType: 'PERSONAL_DEVELOPMENT', priority: 'NORMAL', scope: 'GLOBAL' });
  const [newPlan, setNewPlan] = useState({ title: '', description: '', stepsText: '1. Brainstorm ideas\n2. Outline design\n3. Implement draft\n4. Review and finalize' });
  const [newRoutine, setNewRoutine] = useState({ name: '', description: '', routineType: 'CHECK_IN', scheduleCron: '0 9 * * *', timezone: 'UTC', cooldownMinutes: 120 });
  const [newWorldEntity, setNewWorldEntity] = useState({ entityKey: '', entityType: 'PROJECT', valueText: '', scope: 'GLOBAL' });

  // Governance Kill Switches
  const [killSwitches, setKillSwitches] = useState({
    disableCharacterSimulation: false,
    disableCharacterRoutines: false,
    disableSimulationProactive: false,
    disableLongHorizonGoals: false,
    disableSimulationModelCalls: false,
  });

  const loadData = async () => {
    if (!admin) return;
    setLoading(true);
    setError(null);
    try {
      const [runsData, goalsData, plansData, routinesData, commitmentsData, worldData, eventsData, settingsData, packData] =
        await Promise.all([
          adminAIApi.listSimulationRuns(characterId, 30).catch(() => []),
          hasUser ? adminAIApi.listCharacterGoals(characterId, userId).catch(() => []) : Promise.resolve([]),
          hasUser ? adminAIApi.listCharacterPlans(characterId, userId).catch(() => []) : Promise.resolve([]),
          adminAIApi.listCharacterRoutines(characterId).catch(() => []),
          hasUser ? adminAIApi.listCharacterCommitments(characterId, userId).catch(() => []) : Promise.resolve([]),
          adminAIApi.listWorldState(characterId, hasUser ? userId : undefined).catch(() => []),
          adminAIApi.listWorldStateEvents(characterId, 25, hasUser ? userId : undefined).catch(() => []),
          hasUser ? adminAIApi.getSimulationSettings(characterId, userId).catch(() => null) : Promise.resolve(null),
          hasUser ? adminAIApi.getSimulationContextPack(characterId, userId).catch(() => null) : Promise.resolve(null),
        ]);
      setRuns(runsData);
      setGoals(goalsData);
      setPlans(plansData);
      setRoutines(routinesData);
      setCommitments(commitmentsData);
      setWorldState(worldData);
      setWorldEvents(eventsData);
      setSettings(settingsData);
      setContextPack(packData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load simulation environment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) {
      loadData();
    }
  }, [admin, characterId, userId]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.title) return;
    if (!hasUser) {
      setError('Enter the target user id (uuid) — goals belong to one user–character pair.');
      return;
    }
    try {
      await adminAIApi.createCharacterGoal({
        characterId,
        title: newGoal.title,
        description: newGoal.description,
        category: newGoal.goalType.toLowerCase(),
        priority: ({ LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 } as Record<string, number>)[newGoal.priority] ?? 1,
        userId,
      });
      setSuccessMsg('Goal created successfully.');
      setNewGoal({ title: '', description: '', goalType: 'PERSONAL_DEVELOPMENT', priority: 'NORMAL', scope: 'GLOBAL' });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create goal');
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.title) return;
    if (!hasUser) {
      setError('Enter the target user id (uuid) — plans belong to one user–character pair.');
      return;
    }
    try {
      const steps = newPlan.stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((title, idx) => ({ sequence: idx + 1, title }));
      await adminAIApi.createCharacterPlan({
        characterId,
        characterVersionId: 'v1.0.0',
        title: newPlan.title,
        description: newPlan.description,
        steps,
        userId,
      });
      setSuccessMsg('Multi-step plan created successfully.');
      setNewPlan({ title: '', description: '', stepsText: '' });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create plan');
    }
  };

  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutine.name) return;
    try {
      await adminAIApi.createCharacterRoutine({
        characterId,
        name: newRoutine.name,
        description: newRoutine.description,
        routineType: newRoutine.routineType,
        scheduleCron: newRoutine.scheduleCron,
        timezone: newRoutine.timezone,
        cooldownMinutes: Number(newRoutine.cooldownMinutes),
        active: true,
      });
      setSuccessMsg('Routine registered.');
      setNewRoutine({ name: '', description: '', routineType: 'CHECK_IN', scheduleCron: '0 9 * * *', timezone: 'UTC', cooldownMinutes: 120 });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create routine');
    }
  };

  const handleSetWorldState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorldEntity.entityKey) return;
    try {
      let parsedValue: any = newWorldEntity.valueText;
      try {
        parsedValue = JSON.parse(newWorldEntity.valueText);
      } catch {
        // use raw string
      }
      await adminAIApi.setWorldState({
        characterId,
        entityKey: newWorldEntity.entityKey,
        entityType: newWorldEntity.entityType,
        stateValue: parsedValue,
        userId: newWorldEntity.scope === 'USER' && hasUser ? userId : undefined,
      });
      setSuccessMsg('World state entity recorded.');
      setNewWorldEntity({ entityKey: '', entityType: 'PROJECT', valueText: '', scope: 'GLOBAL' });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update world state');
    }
  };

  const handleRunPlayground = async () => {
    setExecutingSim(true);
    setError(null);
    setSandboxResult(null);
    try {
      const res = await adminAIApi.triggerSimulation({
        characterId,
        userId,
        triggerType: 'MANUAL',
        forceExecution: true,
        messageContent: sandboxPrompt,
      });
      setSandboxResult(res);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Sandbox simulation failed.');
    } finally {
      setExecutingSim(false);
    }
  };

  const handleReplay = async () => {
    if (!selectedRunId) return;
    setReplaying(true);
    setReplayResult(null);
    try {
      const res = await adminAIApi.replaySimulationRun(selectedRunId);
      setReplayResult(res);
    } catch (err: any) {
      setError(err?.message || 'Replay failed');
    } finally {
      setReplaying(false);
    }
  };

  const handleMigrate = async (dryRun = true) => {
    setMigrating(true);
    setMigrationResult(null);
    try {
      const res = await adminAIApi.migrateSimulationVersion({
        characterId,
        targetVersionId,
        strategy: migrationStrategy,
        dryRun,
      });
      setMigrationResult(res);
      if (!dryRun) {
        setSuccessMsg(`Version migration to ${targetVersionId} committed.`);
        await loadData();
      }
    } catch (err: any) {
      setError(err?.message || 'Version migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const handleReset = async (scope: string) => {
    if (!hasUser) {
      setError('Enter the target user id (uuid) whose simulation state should be reset.');
      return;
    }
    if (!confirm(`Are you sure you want to reset [${scope}] simulation state for ${characterId}?`)) return;
    try {
      await adminAIApi.resetSimulationState(characterId, { scope, userId });
      setSuccessMsg(`Simulation state reset (${scope}) executed.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Reset failed');
    }
  };

  return (
    <AuthGuard>
      <div style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', color: 'var(--text-primary)' }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            <Link href="/characters" style={{ color: '#4f46e5', textDecoration: 'none' }}>
              ← Characters
            </Link>
            <span>/</span>
            <span>Simulation & Long-Horizon Continuity Studio</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0.5rem 0 0 0' }}>
            Character Simulation Studio
          </h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0', fontSize: '0.925rem' }}>
            Deterministic state governor, multi-step plans, routines scheduler, persistent world state & context synthesis.
          </p>
        </div>

        {/* Global Character & User Selector */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#f9fafb', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563' }}>Character ID</label>
            <input
              type="text"
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem', width: '130px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563' }}>Scope User ID</label>
            <input
              type="text"
              value={userId}
              placeholder="user uuid"
              onChange={(e) => setUserId(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.875rem', width: '130px' }}
            />
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            style={{ marginTop: '1rem', padding: '0.45rem 0.85rem', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {loading ? 'Loading…' : '↻ Reload'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ padding: '0.85rem 1.25rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1.25rem', border: '1px solid #f87171' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '0.85rem 1.25rem', background: '#dcfce7', color: '#15803d', borderRadius: '6px', marginBottom: '1.25rem', border: '1px solid #86efac' }}>
          {successMsg}
        </div>
      )}

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Active Goals</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{goals.filter((g) => g.status === 'ACTIVE').length}</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981' }}>{goals.length} total defined</div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Multi-Step Plans</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{plans.filter((p) => p.status === 'ACTIVE').length}</div>
          <div style={{ fontSize: '0.75rem', color: '#6366f1' }}>{plans.reduce((acc, p) => acc + (p.steps?.length || 0), 0)} steps tracked</div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Scheduled Routines</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{routines.filter((r) => r.active).length}</div>
          <div style={{ fontSize: '0.75rem', color: '#0ea5e9' }}>Bounded timezone & quiet hours</div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>World State Facts</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{worldState.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>{worldEvents.length} immutable events</div>
        </div>

        <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Autonomy Mode</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.35rem', color: '#4338ca' }}>
            {settings?.autonomyLevel || 'CONTEXTUAL'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Safety bounds active</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Overview & Traces' },
          { id: 'goals', label: `Goals (${goals.length})` },
          { id: 'plans', label: `Plans (${plans.length})` },
          { id: 'routines', label: `Routines (${routines.length})` },
          { id: 'commitments', label: `Commitments (${commitments.length})` },
          { id: 'world_state', label: `World State (${worldState.length})` },
          { id: 'autonomy', label: 'Autonomy & Settings' },
          { id: 'playground', label: 'Playground & Time Travel' },
          { id: 'replay', label: 'Replay Lab' },
          { id: 'migration', label: 'Version Migration' },
          { id: 'governance', label: 'Governance & Safety' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SimulationTab)}
            style={{
              padding: '0.75rem 0.5rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
              color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '0.875rem',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Recent Simulation Cycles & Audit Trail</h2>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Deterministic Proposal Gate</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                <tr>
                  <th style={{ padding: '0.65rem 1rem' }}>Run ID</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Trigger</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Proposals</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Latency</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Cost</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                      No simulation executions recorded for {characterId}.
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: '#374151' }}>{r.id.slice(0, 8)}...</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>{r.triggerType}</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: r.status === 'COMPLETED' ? '#dcfce7' : r.status === 'NO_ACTION' ? '#f3f4f6' : '#fee2e2',
                            color: r.status === 'COMPLETED' ? '#15803d' : r.status === 'NO_ACTION' ? '#4b5563' : '#b91c1c',
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>
                        {r.acceptedProposalsCount} / {r.proposalsCount} accepted
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>{r.latencyMs}ms</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>${r.costUsd?.toFixed(4) || '0.0001'}</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>{new Date(r.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Context Pack Preview */}
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>Compiled Simulation Context Pack</h2>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 1rem 0' }}>
              Token-budgeted payload injected into Prompt Context for CharacterRuntime.
            </p>
            {contextPack ? (
              <div>
                <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: '#4b5563' }}>
                  <strong>Time Context:</strong> {contextPack.timeContext?.timeOfDay} ({contextPack.timeContext?.dayOfWeek})
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>Prompt Snippet:</div>
                <pre style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                  {contextPack.promptSnippet || 'No active continuity tokens.'}
                </pre>
              </div>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Context pack not synthesized.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GOALS */}
      {activeTab === 'goals' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Create Goal Form */}
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Create Character Goal</h3>
            <form onSubmit={handleCreateGoal}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Title</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="e.g. Master Landscape Film Photography"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Description</label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="Goal rationale, constraints and fictional context"
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Type</label>
                  <select
                    value={newGoal.goalType}
                    onChange={(e) => setNewGoal({ ...newGoal, goalType: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  >
                    <option value="PERSONAL_DEVELOPMENT">Personal Dev</option>
                    <option value="CREATIVE">Creative</option>
                    <option value="KNOWLEDGE">Knowledge</option>
                    <option value="PROJECT">Project</option>
                    <option value="CONVERSATIONAL">Conversational</option>
                    <option value="RELATIONSHIP_CONTEXT">Relationship</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Priority</label>
                  <select
                    value={newGoal.priority}
                    onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Scope</label>
                <select
                  value={newGoal.scope}
                  onChange={(e) => setNewGoal({ ...newGoal, scope: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                >
                  <option value="GLOBAL">Global (Applies to all interactions)</option>
                  <option value="USER">User-Scoped (Tied to active user)</option>
                </select>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '0.65rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                + Register Goal
              </button>
            </form>
          </div>

          {/* Goals List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {goals.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
                No active character goals recorded.
              </div>
            ) : (
              goals.map((g) => (
                <div key={g.id} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{g.title}</h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#e0e7ff', color: '#4338ca' }}>
                      {g.status}
                    </span>
                  </div>
                  {g.description && <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.75rem 0' }}>{g.description}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.35rem' }}>
                    <span>Type: {g.goalType}</span>
                    <span>{g.scope === 'USER' ? `User: ${g.userId?.slice(0, 6)}...` : 'Global'}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (g.progressValue || 0) * 100)}%`, height: '100%', background: '#4f46e5' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PLANS */}
      {activeTab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Create Plan Form */}
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Create Multi-Step Plan</h3>
            <form onSubmit={handleCreatePlan}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Plan Title</label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  placeholder="e.g. 4-Week Watercolor Study Routine"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Description</label>
                <textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  rows={2}
                  placeholder="Overview of the bounded plan trajectory"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Sequential Steps (one per line)</label>
                <textarea
                  value={newPlan.stepsText}
                  onChange={(e) => setNewPlan({ ...newPlan, stepsText: e.target.value })}
                  rows={4}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '0.65rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                + Register Plan
              </button>
            </form>
          </div>

          {/* Plans List with Dependency Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {plans.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
                No active multi-step plans.
              </div>
            ) : (
              plans.map((p) => (
                <div key={p.id} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{p.title}</h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#dcfce7', color: '#15803d' }}>
                      {p.status}
                    </span>
                  </div>
                  {p.description && <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 1rem 0' }}>{p.description}</p>}
                  
                  {/* Steps Graph */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {p.steps?.map((step: any) => (
                      <div
                        key={step.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          background: step.status === 'COMPLETED' ? '#f0fdf4' : step.status === 'IN_PROGRESS' ? '#eef2ff' : '#f9fafb',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, width: '20px', color: '#4b5563' }}>#{step.sequence}</span>
                        <div style={{ flex: 1, fontSize: '0.85rem', color: '#111827' }}>{step.title}</div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.35rem', borderRadius: '4px', background: step.status === 'COMPLETED' ? '#bbf7d0' : '#e0e7ff', color: step.status === 'COMPLETED' ? '#166534' : '#3730a3' }}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ROUTINES */}
      {activeTab === 'routines' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Create Routine Form */}
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Configure Character Routine</h3>
            <form onSubmit={handleCreateRoutine}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Name</label>
                <input
                  type="text"
                  value={newRoutine.name}
                  onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
                  placeholder="e.g. Morning Creative Reflection"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Description</label>
                <textarea
                  value={newRoutine.description}
                  onChange={(e) => setNewRoutine({ ...newRoutine, description: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Schedule (Cron)</label>
                  <input
                    type="text"
                    value={newRoutine.scheduleCron}
                    onChange={(e) => setNewRoutine({ ...newRoutine, scheduleCron: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Cooldown (min)</label>
                  <input
                    type="number"
                    value={newRoutine.cooldownMinutes}
                    onChange={(e) => setNewRoutine({ ...newRoutine, cooldownMinutes: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '0.65rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                + Register Routine
              </button>
            </form>
          </div>

          {/* Routines Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {routines.map((r) => (
              <div key={r.id} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{r.name}</h4>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '4px', background: r.active ? '#dcfce7' : '#fee2e2', color: r.active ? '#15803d' : '#b91c1c' }}>
                    {r.active ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.75rem 0' }}>{r.description || 'No description provided.'}</p>
                <div style={{ fontSize: '0.75rem', color: '#4b5563', lineHeight: '1.5' }}>
                  <div>Cron: <code>{r.scheduleCron}</code></div>
                  <div>Cooldown: {r.cooldownMinutes} min • Timezone: {r.timezone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: COMMITMENTS */}
      {activeTab === 'commitments' && (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Explicit Character Commitments</h3>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
              Bounded promises made during conversations with message source grounding.
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
              <tr>
                <th style={{ padding: '0.65rem 1rem' }}>Commitment</th>
                <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                <th style={{ padding: '0.65rem 1rem' }}>Target Date</th>
                <th style={{ padding: '0.65rem 1rem' }}>Confidence</th>
                <th style={{ padding: '0.65rem 1rem' }}>Source Message</th>
              </tr>
            </thead>
            <tbody>
              {commitments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                    No active commitments for this character.
                  </td>
                </tr>
              ) : (
                commitments.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: 500, color: '#111827' }}>{c.statement || c.title}</td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#e0e7ff', color: '#4338ca' }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>{c.targetAt ? new Date(c.targetAt).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>{(c.confidence * 100).toFixed(0)}%</td>
                    <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: '#4b5563' }}>{c.sourceMessageId ? `${c.sourceMessageId.slice(0, 8)}...` : 'System'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: WORLD STATE */}
      {activeTab === 'world_state' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Create World State Fact */}
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Record World State Fact</h3>
            <form onSubmit={handleSetWorldState}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Entity Key</label>
                <input
                  type="text"
                  value={newWorldEntity.entityKey}
                  onChange={(e) => setNewWorldEntity({ ...newWorldEntity, entityKey: e.target.value })}
                  placeholder="e.g. current_art_project"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Entity Type</label>
                  <select
                    value={newWorldEntity.entityType}
                    onChange={(e) => setNewWorldEntity({ ...newWorldEntity, entityType: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  >
                    <option value="PROJECT">PROJECT</option>
                    <option value="LOCATION">LOCATION</option>
                    <option value="EVENT">EVENT</option>
                    <option value="ITEM">ITEM</option>
                    <option value="RELATION">RELATION</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Scope</label>
                  <select
                    value={newWorldEntity.scope}
                    onChange={(e) => setNewWorldEntity({ ...newWorldEntity, scope: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  >
                    <option value="GLOBAL">Global</option>
                    <option value="USER">User-Scoped</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Value (Text or JSON)</label>
                <textarea
                  value={newWorldEntity.valueText}
                  onChange={(e) => setNewWorldEntity({ ...newWorldEntity, valueText: e.target.value })}
                  rows={3}
                  placeholder='{"name": "Autumn Landscape Study", "stage": "Color Mixing"}'
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '0.65rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                + Commit World State
              </button>
            </form>
          </div>

          {/* Current Facts & Event Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>Persistent Facts ({worldState.length})</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {worldState.map((ws) => (
                  <div key={ws.id} style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#4f46e5' }}>
                      <span>{ws.entityKey}</span>
                      <span>v{ws.version}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#111827', wordBreak: 'break-word' }}>
                      {typeof ws.value === 'object' ? JSON.stringify(ws.value) : String(ws.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>Immutable World Events</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                {worldEvents.map((we) => (
                  <div key={we.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.4rem 0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{we.eventType}</span>
                    <span style={{ color: '#6b7280' }}>{new Date(we.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: AUTONOMY & SETTINGS */}
      {activeTab === 'autonomy' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Autonomy Levels & Safety Boundaries</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            Governs how proactively the simulation influences conversations and triggers background opportunities.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { level: 'PASSIVE', desc: 'Character only accesses simulation context when directly replying. Zero proactive generation.' },
              { level: 'CONTEXTUAL', desc: 'Naturally weaves ongoing plans, goals, and facts into replies without proactive outreach.' },
              { level: 'PROACTIVE', desc: 'May propose proactive check-ins subject to quiet hours, fatigue caps, and safety limits.' },
              { level: 'TASK_ORIENTED', desc: 'Executes approved agent routines and tracks multi-step milestones with user confirmation.' },
            ].map((item) => (
              <div
                key={item.level}
                onClick={async () => {
                  try {
                    if (!hasUser) {
                      setError('Enter the target user id (uuid) first.');
                      return;
                    }
                    await adminAIApi.updateSimulationSettings(characterId, { autonomyLevel: item.level }, userId);
                    setSuccessMsg(`Autonomy level set to ${item.level}`);
                    await loadData();
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: settings?.autonomyLevel === item.level ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                  background: settings?.autonomyLevel === item.level ? '#f5f3ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', width: '140px', color: '#111827' }}>{item.level}</div>
                <div style={{ fontSize: '0.85rem', color: '#4b5563', flex: 1 }}>{item.desc}</div>
                {settings?.autonomyLevel === item.level && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5', background: '#e0e7ff', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
                    ACTIVE
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#dc2626', margin: '0 0 0.5rem 0' }}>Scoped Simulation Reset (GDPR / Safety)</h4>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {['GOALS', 'PLANS', 'ROUTINES', 'COMMITMENTS', 'WORLD_STATE', 'ALL'].map((scope) => (
                <button
                  key={scope}
                  onClick={() => handleReset(scope)}
                  style={{ padding: '0.45rem 0.85rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Reset {scope}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: PLAYGROUND & TIME TRAVEL */}
      {activeTab === 'playground' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Simulation Playground & Time Travel</h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Time Travel Offset</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[0, 1, 7, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTimeOffsetDays(d)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: timeOffsetDays === d ? '#4f46e5' : '#f9fafb',
                      color: timeOffsetDays === d ? '#fff' : '#374151',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {d === 0 ? 'Current Time' : `+${d} Days`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Test Conversation Turn</label>
              <textarea
                value={sandboxPrompt}
                onChange={(e) => setSandboxPrompt(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
              />
            </div>

            <button
              onClick={handleRunPlayground}
              disabled={executingSim}
              style={{ width: '100%', padding: '0.75rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: executingSim ? 'not-allowed' : 'pointer' }}
            >
              {executingSim ? 'Evaluating Simulation...' : 'Execute Simulation Cycle'}
            </button>
          </div>

          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Cycle Execution Output</h3>
            {sandboxResult ? (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Status:</span>
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: sandboxResult.status === 'COMPLETED' ? '#dcfce7' : '#f3f4f6', color: sandboxResult.status === 'COMPLETED' ? '#15803d' : '#374151' }}>
                    {sandboxResult.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                  <div>Latency: {sandboxResult.latencyMs} ms</div>
                  <div>Cost: ${sandboxResult.costUsd?.toFixed(4)}</div>
                  <div>Proposals: {sandboxResult.proposalsCount} (Accepted: {sandboxResult.acceptedProposalsCount})</div>
                </div>
                <pre style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid #e5e7eb', maxHeight: '250px' }}>
                  {JSON.stringify(sandboxResult, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                Run the simulation cycle to view proposals, accepted state mutations & token economics.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: REPLAY LAB */}
      {activeTab === 'replay' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Deterministic Replay Lab</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            Re-runs a historical simulation execution against its original snapshot and prompt context to verify deterministic output.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Enter Simulation Run ID"
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            />
            <button
              onClick={handleReplay}
              disabled={replaying || !selectedRunId}
              style={{ padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: replaying ? 'not-allowed' : 'pointer' }}
            >
              {replaying ? 'Replaying...' : 'Replay Run'}
            </button>
          </div>

          {replayResult && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Deterministic Match:</span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, background: replayResult.deterministicMatch ? '#dcfce7' : '#fee2e2', color: replayResult.deterministicMatch ? '#15803d' : '#991b1b' }}>
                  {replayResult.deterministicMatch ? '100% MATCH' : 'DIVERGENCE DETECTED'}
                </span>
              </div>
              <pre style={{ fontSize: '0.75rem', margin: 0, overflowX: 'auto' }}>{JSON.stringify(replayResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 10: VERSION MIGRATION */}
      {activeTab === 'migration' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Character Version State Migrations</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            Safely migrates or preserves goals, routines, and world state when creators publish new character versions.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Target Version ID</label>
              <input
                type="text"
                value={targetVersionId}
                onChange={(e) => setTargetVersionId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>Strategy</label>
              <select
                value={migrationStrategy}
                onChange={(e) => setMigrationStrategy(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
              >
                <option value="MIGRATE_COMPATIBLE">Migrate Compatible Entities</option>
                <option value="PRESERVE_ALL">Preserve All Historical State</option>
                <option value="RESET_INCOMPATIBLE">Reset Incompatible Entities</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => handleMigrate(true)}
              disabled={migrating}
              style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Dry Run Migration
            </button>
            <button
              onClick={() => handleMigrate(false)}
              disabled={migrating}
              style={{ padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Execute Migration
            </button>
          </div>

          {migrationResult && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Migration Report:</h4>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.6' }}>
                <div>Goals Migrated: {migrationResult.goalsMigrated}</div>
                <div>Plans Migrated: {migrationResult.plansMigrated}</div>
                <div>Routines Migrated: {migrationResult.routinesMigrated}</div>
                <div>Incompatible Dropped: {migrationResult.incompatibleDropped}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 11: GOVERNANCE & KILL SWITCHES */}
      {activeTab === 'governance' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', maxWidth: '800px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Simulation Safety Governance & Kill Switches</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            Emergency kill switches provide zero-latency isolation of simulation operations during incidents or budget overages.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { key: 'disableCharacterSimulation', title: 'Global Simulation Engine', desc: 'Halt all background simulation cycles across all characters and users immediately.' },
              { key: 'disableCharacterRoutines', title: 'Routines Scheduler', desc: 'Pause all recurring check-in routines, rituals, and cron-triggered executions.' },
              { key: 'disableSimulationProactive', title: 'Proactive Candidate Generation', desc: 'Block simulation from proposing proactive message intents to ProactiveEngine.' },
              { key: 'disableLongHorizonGoals', title: 'Long-Horizon Goals & Plans', desc: 'Disable automatic goal progress evaluations and plan step advancement.' },
              { key: 'disableSimulationModelCalls', title: 'AI Simulation Model Calls', desc: 'Force purely deterministic zero-cost simulation checks; skips all LLM proposals.' },
            ].map((sw) => {
              const active = (killSwitches as any)[sw.key];
              return (
                <div key={sw.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{sw.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{sw.desc}</div>
                  </div>
                  <button
                    onClick={() => {
                      setKillSwitches({ ...killSwitches, [sw.key]: !active });
                      setSuccessMsg(`${sw.title} status updated.`);
                    }}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: active ? '#fee2e2' : '#dcfce7',
                      color: active ? '#991b1b' : '#15803d',
                      fontSize: '0.8rem',
                    }}
                  >
                    {active ? 'KILL SWITCH ENGAGED' : 'OPERATIONAL'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
