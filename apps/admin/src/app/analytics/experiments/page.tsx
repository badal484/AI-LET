'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../../components/AuthGuard';
import { adminAnalyticsApi } from '../../../services/adminAnalyticsApi';
import type {
  ExperimentItem,
  ExperimentCreateInput,
  ExperimentAnalysisResult,
} from '@ai-companion/types';
import { ArrowLeft, RefreshCw, PlusCircle, CheckCircle, AlertTriangle, Play, Pause, Archive } from 'lucide-react';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ExperimentAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal create state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExp, setNewExp] = useState<ExperimentCreateInput>({
    id: 'exp_',
    name: '',
    description: '',
    primaryMetric: 'activation_completed',
    allocation: 100,
    variants: [
      { key: 'control', name: 'Control (Default)', allocationPercentage: 50 },
      { key: 'treatment_a', name: 'Treatment A', allocationPercentage: 50 },
    ],
  });

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await adminAnalyticsApi.getExperiments();
      setExperiments(list);
      if (list.length > 0 && !selectedExpId) {
        setSelectedExpId(list[0]!.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async (expId: string) => {
    try {
      setAnalysisLoading(true);
      const result = await adminAnalyticsApi.getExperimentAnalysis(expId);
      setAnalysis(result);
    } catch (err: any) {
      loggerError('Failed to fetch analysis', err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const loggerError = (msg: string, err: any) => {
    console.error(msg, err);
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await adminAnalyticsApi.createExperiment(newExp);
      setShowCreateModal(false);
      await fetchExperiments();
      setSelectedExpId(created.id);
    } catch (err: any) {
      alert(`Failed to create experiment: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (expId: string, status: any) => {
    try {
      await adminAnalyticsApi.updateExperiment(expId, { status });
      await fetchExperiments();
      if (selectedExpId === expId) {
        await fetchAnalysis(expId);
      }
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  useEffect(() => {
    if (selectedExpId) {
      fetchAnalysis(selectedExpId);
    }
  }, [selectedExpId]);

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link href="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                <ArrowLeft size={16} />
              </Link>
              <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
                A/B Experimentation & Statistical Evaluation Console
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Deterministic variant hashing, exposure tracking, Z-score significance tests, and guardrail metrics
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--accent-primary)',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={14} /> New Experiment
            </button>

            <button
              onClick={fetchExperiments}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '8px', color: '#F87171', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="card" style={{ border: '1px solid var(--accent-primary)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px' }}>Configure New A/B Experiment</h3>
            <form onSubmit={handleCreateExperiment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Experiment ID (Slug)</label>
                  <input
                    type="text"
                    value={newExp.id}
                    onChange={e => setNewExp({ ...newExp, id: e.target.value })}
                    placeholder="exp_onboarding_flow_v2"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Experiment Name</label>
                  <input
                    type="text"
                    value={newExp.name}
                    onChange={e => setNewExp({ ...newExp, name: e.target.value })}
                    placeholder="Simplified Character Selection"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Primary Conversion Metric Event</label>
                <input
                  type="text"
                  value={newExp.primaryMetric}
                  onChange={e => setNewExp({ ...newExp, primaryMetric: e.target.value })}
                  placeholder="activation_completed or first_message_sent"
                  style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '6px 14px', backgroundColor: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '6px 16px', backgroundColor: 'var(--accent-primary)', border: 'none', borderRadius: '6px', color: '#FFFFFF', fontWeight: '600', cursor: 'pointer' }}>Create Experiment</button>
              </div>
            </form>
          </div>
        )}

        {/* Experiment List & Selected Analysis Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '20px' }}>
          {/* Left Column: Experiment Selector */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Experiments ({experiments.length})</h3>

            {experiments.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No experiments created yet.</p>
            ) : (
              experiments.map(exp => (
                <div
                  key={exp.id}
                  onClick={() => setSelectedExpId(exp.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: selectedExpId === exp.id ? 'var(--bg-secondary)' : 'transparent',
                    border: `1px solid ${selectedExpId === exp.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{exp.name}</strong>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: exp.status === 'RUNNING' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                      color: exp.status === 'RUNNING' ? '#4ADE80' : '#94A3B8',
                    }}>
                      {exp.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Metric: <code>{exp.primaryMetric}</code>
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Statistical Analysis Card */}
          <div className="card">
            {!selectedExpId ? (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Select an experiment to view results</p>
            ) : analysisLoading ? (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Loading statistical analysis...</p>
            ) : !analysis ? (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No analysis data available</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Status Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{analysis.experimentId}</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Total Subjects: {analysis.totalSubjects.toLocaleString()} | Exposed: {analysis.totalExposed.toLocaleString()}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {analysis.status !== 'RUNNING' ? (
                      <button
                        onClick={() => handleUpdateStatus(analysis.experimentId, 'RUNNING')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '6px', color: '#4ADE80', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                      >
                        <Play size={12} /> Launch
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(analysis.experimentId, 'PAUSED')}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '6px', color: '#F59E0B', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                      >
                        <Pause size={12} /> Pause
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateStatus(analysis.experimentId, 'ARCHIVED')}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '6px', color: '#94A3B8', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                    >
                      <Archive size={12} /> Archive
                    </button>
                  </div>
                </div>

                {/* Recommendation Banner */}
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: analysis.recommendation === 'ROLLOUT_TREATMENT' ? 'rgba(74, 222, 128, 0.15)' : analysis.recommendation === 'ROLLBACK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                  border: `1px solid ${analysis.recommendation === 'ROLLOUT_TREATMENT' ? '#4ADE80' : analysis.recommendation === 'ROLLBACK' ? '#EF4444' : '#64748B'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  {analysis.recommendation === 'ROLLOUT_TREATMENT' ? <CheckCircle size={18} style={{ color: '#4ADE80' }} /> : <AlertTriangle size={18} style={{ color: '#F59E0B' }} />}
                  <div>
                    <strong style={{ fontSize: '13px' }}>System Recommendation: {analysis.recommendation}</strong>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {analysis.recommendation === 'ROLLOUT_TREATMENT'
                        ? 'Statistically significant positive uplift observed without violating guardrails. Safe to roll out.'
                        : analysis.recommendation === 'ROLLBACK'
                          ? 'Statistically significant drop in primary metric or guardrail regression detected. Recommend immediate rollback.'
                          : 'Sample size or p-value not yet sufficient for confident conclusion. Continue running.'}
                    </p>
                  </div>
                </div>

                {/* Variant Statistical Comparison Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>Variant</th>
                        <th style={{ padding: '10px 12px' }}>Assigned / Exposed</th>
                        <th style={{ padding: '10px 12px' }}>Conversions</th>
                        <th style={{ padding: '10px 12px' }}>Conv. Rate</th>
                        <th style={{ padding: '10px 12px' }}>Uplift vs Ctrl</th>
                        <th style={{ padding: '10px 12px' }}>Z-Score / p-Value</th>
                        <th style={{ padding: '10px 12px' }}>95% Confidence Interval</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.variants.map(v => (
                        <tr key={v.variantKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '600' }}>{v.variantKey}</td>
                          <td style={{ padding: '10px 12px' }}>{v.assignedUsers.toLocaleString()} / {v.exposedUsers.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>{v.primaryMetricValue.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontWeight: '600' }}>{(v.primaryMetricRate * 100).toFixed(1)}%</td>
                          <td style={{ padding: '10px 12px', color: v.upliftVsControl > 0 ? '#4ADE80' : v.upliftVsControl < 0 ? '#F87171' : 'var(--text-muted)', fontWeight: '600' }}>
                            {v.variantKey === 'control' ? 'Baseline' : `${v.upliftVsControl > 0 ? '+' : ''}${v.upliftVsControl}%`}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {v.variantKey === 'control' ? '—' : `Z: ${v.zScore} (p=${v.pValue})`}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            [{(v.confidenceInterval[0] * 100).toFixed(1)}%, {(v.confidenceInterval[1] * 100).toFixed(1)}%]
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {v.isSignificant ? (
                              <span style={{ fontSize: '11px', fontWeight: '600', color: '#4ADE80', backgroundColor: 'rgba(74, 222, 128, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                Significant (p &lt; 0.05)
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending sample</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
