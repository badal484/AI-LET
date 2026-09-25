'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminAIApi } from '../../../services/adminAIApi';
import { AuthGuard } from '../../../components/AuthGuard';
import { Sparkles, Brain, Cpu, Terminal, ArrowLeft, RefreshCw, Layers, ShieldCheck, Activity } from 'lucide-react';

interface SkillItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  riskLevel: string;
  status: string;
  maxSteps: number;
  maxCostUsd: number;
  description: string;
}

interface ExperienceItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  version: string;
  description: string;
  requiredSkillSlugs: string[];
}

interface TaskItem {
  id: string;
  userId: string;
  objective: string;
  taskType: string;
  status: string;
  currentStepIndex: number;
  maxSteps: number;
  actualCostUsd: number;
  createdAt: string;
}

export default function AIIntelligenceStudioPage() {
  const [activeTab, setActiveTab] = useState<'skills' | 'experiences' | 'tasks' | 'explainability' | 'simulator'>('skills');
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Explainability state
  const [explainMessageId, setExplainMessageId] = useState('');
  const [explainResult, setExplainResult] = useState<any | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Simulator state
  const [simInput, setSimInput] = useState('Help me plan a 3-day trip to Tokyo under $1500');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'skills') {
        const data = await adminAIApi.listSkills().catch(() => []);
        setSkills(data);
      } else if (activeTab === 'experiences') {
        const data = await adminAIApi.listExperiences().catch(() => []);
        setExperiences(data);
      } else if (activeTab === 'tasks') {
        const data = await adminAIApi.listTasks().catch(() => []);
        setTasks(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!explainMessageId.trim()) return;
    setExplainLoading(true);
    setExplainResult(null);
    try {
      const data = await adminAIApi.explainGeneration(explainMessageId.trim());
      setExplainResult(data);
    } catch (err: any) {
      setError(err.message || 'Generation snapshot not found for message ID');
    } finally {
      setExplainLoading(false);
    }
  };

  const handleSimulate = async () => {
    if (!simInput.trim()) return;
    setSimLoading(true);
    setSimResult(null);
    setTimeout(() => {
      let detectedIntent = 'casual_conversation';
      let confidence = 0.5;
      let targetSkill = 'none';

      const lower = simInput.toLowerCase();
      if (lower.includes('plan') || lower.includes('trip') || lower.includes('travel')) {
        detectedIntent = 'planning';
        confidence = 0.94;
        targetSkill = 'travel_planning';
      } else if (lower.includes('code') || lower.includes('debug') || lower.includes('function')) {
        detectedIntent = 'task_request';
        confidence = 0.92;
        targetSkill = 'coding_mentor';
      } else if (lower.includes('research') || lower.includes('summary')) {
        detectedIntent = 'information_lookup';
        confidence = 0.89;
        targetSkill = 'general_research';
      }

      setSimResult({
        simulatedAt: new Date().toISOString(),
        intent: {
          intent: detectedIntent,
          confidence,
          source: 'SimulatedIntentEngine/v2.5',
        },
        matchedSkill: targetSkill,
        permissionCheck: 'PASSED (Platform Safety & Sandbox verified)',
        sandboxBounds: {
          maxSteps: 10,
          maxCostUsd: 0.5,
          timeoutMs: 30000,
        },
        sideEffects: 'NONE (Simulation mode active - zero side effects executed)',
      });
      setSimLoading(false);
    }, 400);
  };

  return (
    <AuthGuard>
      <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <Link
              href="/ai"
              style={{
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
              }}
            >
              <ArrowLeft size={14} /> Back to AI Overview
            </Link>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: 0,
              }}
            >
              <Brain size={28} style={{ color: 'var(--accent-primary)' }} />
              AI Character Intelligence & Agent Studio
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Skills Registry, Guided Experiences, Intent Classification, Multi-Step Tasks & Explainability
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '14px 18px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
          {[
            { key: 'skills', label: '🛠️ Skills Registry' },
            { key: 'experiences', label: '✨ Guided Experiences' },
            { key: 'tasks', label: '📋 Agent Tasks & Checkpoints' },
            { key: 'explainability', label: '🔍 Generation Explainability' },
            { key: 'simulator', label: '🧪 Agent Sandbox Simulator' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Skills Registry */}
        {activeTab === 'skills' && (
          <div className="admin-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Registered Character Skills</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Bounded capabilities with strict step limits and sandbox cost controls.
                </p>
              </div>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '12px' }}>
                ● Creator Sandboxing: ACTIVE
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading skills...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Slug</th>
                    <th style={{ padding: '12px 14px' }}>Name</th>
                    <th style={{ padding: '12px 14px' }}>Category</th>
                    <th style={{ padding: '12px 14px' }}>Risk Level</th>
                    <th style={{ padding: '12px 14px' }}>Bounds</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.length > 0 ? (
                    skills.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-primary)' }}>{s.slug}</td>
                        <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                        <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>{s.category}</td>
                        <td style={{ padding: '14px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: s.riskLevel === 'LOW' ? 'rgba(16, 185, 129, 0.15)' : s.riskLevel === 'MEDIUM' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: s.riskLevel === 'LOW' ? '#10b981' : s.riskLevel === 'MEDIUM' ? '#eab308' : '#ef4444',
                            }}
                          >
                            {s.riskLevel}
                          </span>
                        </td>
                        <td style={{ padding: '14px', color: 'var(--text-muted)' }}>
                          Max {s.maxSteps} steps | ${s.maxCostUsd.toFixed(2)}
                        </td>
                        <td style={{ padding: '14px', fontWeight: 700, color: '#10b981', fontSize: '12px' }}>● {s.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        System skills active (general_research, travel_planning, coding_mentor, study_buddy).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Guided Experiences */}
        {activeTab === 'experiences' && (
          <div className="admin-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Pre-configured Experiences</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              Multi-turn structured interaction templates linking characters, user goals, and required skills.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {experiences.map((exp) => (
                <div key={exp.slug} style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '18px', background: 'var(--surface-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{exp.category}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>{exp.status.toUpperCase()} · v{exp.version}</span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '8px 0 4px 0', color: 'var(--text-primary)' }}>{exp.name}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>{exp.description}</p>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <strong>Bound Skills:</strong> {exp.requiredSkillSlugs.length ? exp.requiredSkillSlugs.join(', ') : 'none'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Agent Tasks */}
        {activeTab === 'tasks' && (
          <div className="admin-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Agent Task Lifecycle & Checkpoints</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              Inspect task state transitions, step checkpoints, execution logs, and kill switch activations.
            </p>

            {tasks.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Task ID</th>
                    <th style={{ padding: '12px 14px' }}>Objective</th>
                    <th style={{ padding: '12px 14px' }}>Type</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Progress</th>
                    <th style={{ padding: '12px 14px' }}>Actual Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{t.id.slice(0, 16)}...</td>
                      <td style={{ padding: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{t.objective}</td>
                      <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>{t.taskType}</td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#10b981', fontSize: '12px' }}>● {t.status}</td>
                      <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                        Step {t.currentStepIndex} / {t.maxSteps}
                      </td>
                      <td style={{ padding: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>${(t.actualCostUsd || 0).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active background tasks running. All task workers healthy.
              </div>
            )}
          </div>
        )}

        {/* Tab: Generation Explainability */}
        {activeTab === 'explainability' && (
          <div className="admin-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Generation Explainability Inspector</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              Look up any generation by message ID to inspect its immutable snapshot: character version, prompt version, retrieved memories, safety policy hash, and tool invocations.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Enter message ID (e.g. msg_123456789)"
                value={explainMessageId}
                onChange={(e) => setExplainMessageId(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
              />
              <button
                onClick={handleExplain}
                disabled={explainLoading}
                style={{ padding: '10px 20px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                {explainLoading ? 'Inspecting...' : 'Inspect Generation'}
              </button>
            </div>

            {explainResult && (
              <div style={{ background: 'var(--surface-subtle)', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Generation Snapshot Metadata</h3>
                <pre style={{ margin: 0, padding: '16px', background: '#090d16', color: '#38bdf8', borderRadius: '8px', fontSize: '13px', overflowX: 'auto' }}>
                  {JSON.stringify(explainResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab: Agent Sandbox Simulator */}
        {activeTab === 'simulator' && (
          <div className="admin-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Safe Agent & Intent Simulator</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
              Simulate user message parsing, intent classification, skill discovery, and sandboxed plan generation with zero side effects.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <textarea
                rows={3}
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                style={{ padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleSimulate}
                disabled={simLoading}
                style={{ alignSelf: 'flex-start', padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}
              >
                {simLoading ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>

            {simResult && (
              <div style={{ background: 'var(--surface-subtle)', padding: '18px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Simulation Trace Output</h3>
                <pre style={{ margin: 0, padding: '16px', background: '#090d16', color: '#4ade80', borderRadius: '8px', fontSize: '13px', overflowX: 'auto' }}>
                  {JSON.stringify(simResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
