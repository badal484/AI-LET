'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIEvaluationDatasetData, AIEvaluationRunData, AIModelData } from '@ai-companion/types';
import { AuthGuard } from '../../../components/AuthGuard';
import { FlaskConical, ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Play } from 'lucide-react';
import Link from 'next/link';

export default function EvaluationLabPage() {
  const [datasets, setDatasets] = useState<AIEvaluationDatasetData[]>([]);
  const [models, setModels] = useState<AIModelData[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [evaluatorType, setEvaluatorType] = useState<string>('hybrid');
  const [currentRun, setCurrentRun] = useState<AIEvaluationRunData | null>(null);
  const [comparison, setComparison] = useState<any | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dsData, modelData] = await Promise.all([
        adminAIApi.listDatasets(),
        adminAIApi.listModels(),
      ]);
      setDatasets(dsData);
      setModels(modelData);
      if (dsData.length > 0) setSelectedDatasetId(dsData[0].id);
      if (modelData.length > 0) setSelectedModelId(modelData[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load evaluation lab data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunEvaluation = async () => {
    if (!selectedDatasetId || !selectedModelId) return;
    setRunning(true);
    setError(null);
    setComparison(null);
    try {
      const runResult = await adminAIApi.runEvaluation({
        datasetId: selectedDatasetId,
        modelId: selectedModelId,
        evaluatorType,
      });
      setCurrentRun(runResult);

      const compResult = await adminAIApi.compareRuns(runResult.id);
      setComparison(compResult);
    } catch (err: any) {
      setError(err.message || 'Evaluation run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AuthGuard>
      <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
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
              <ArrowLeft size={14} /> Back to AI Hub
            </Link>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FlaskConical size={28} style={{ color: 'var(--accent-primary)' }} />
              AI Evaluation Lab & Regression Testing
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Deterministic test suites, LLM-as-a-judge scoring, regression release gates, and benchmark drift detection.
            </p>
          </div>
          <button
            onClick={loadData}
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
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading evaluation lab...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Run Configurator Card */}
            <div className="admin-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Launch Evaluation Run</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Evaluation Dataset
                  </label>
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.testCases?.length || 0} cases)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Target AI Model
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} ({m.provider})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Evaluator Type
                  </label>
                  <select
                    value={evaluatorType}
                    onChange={(e) => setEvaluatorType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="hybrid">Hybrid (Deterministic + LLM Judge)</option>
                    <option value="llm_judge">LLM-as-Judge</option>
                    <option value="deterministic">Deterministic Assertions Only</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleRunEvaluation}
                disabled={running}
                style={{
                  padding: '12px 24px',
                  background: running ? 'var(--surface-elevated)' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: running ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Play size={16} />
                {running ? 'Running Evaluation Suite...' : 'Execute Evaluation Suite'}
              </button>
            </div>

            {/* Regression Gate Status & Summary */}
            {comparison && (
              <div
                style={{
                  padding: '18px 24px',
                  borderRadius: '10px',
                  border: '1px solid',
                  background: comparison.gateStatus === 'PASSED' ? 'rgba(16, 185, 129, 0.12)' : comparison.gateStatus === 'WARNING' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  borderColor: comparison.gateStatus === 'PASSED' ? 'rgba(16, 185, 129, 0.3)' : comparison.gateStatus === 'WARNING' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 800,
                        background: comparison.gateStatus === 'PASSED' ? '#10b981' : comparison.gateStatus === 'WARNING' ? '#f59e0b' : '#ef4444',
                        color: '#fff',
                      }}
                    >
                      GATE: {comparison.gateStatus}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{comparison.summary}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Score Δ: <strong style={{ color: 'var(--text-primary)' }}>{comparison.deltas?.scoreDelta > 0 ? `+${comparison.deltas.scoreDelta}` : comparison.deltas?.scoreDelta}</strong> | Pass Rate Δ: <strong style={{ color: 'var(--text-primary)' }}>{(comparison.deltas?.passRateDelta * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table */}
            {currentRun && (
              <div className="admin-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Evaluation Run Results</h3>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    Average Score: <strong style={{ color: 'var(--text-primary)' }}>{currentRun.averageScore} / 10</strong> | Pass Rate: <strong style={{ color: '#10b981' }}>{((currentRun.metrics?.passRate || 0) * 100).toFixed(0)}%</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {currentRun.results?.map((r, idx) => (
                    <div key={r.id || idx} style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', background: 'var(--surface-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>Test Case #{idx + 1}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)' }}>Score: {r.score} / 10</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: r.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: r.passed ? '#10b981' : '#ef4444',
                            }}
                          >
                            {r.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface-elevated)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <strong>Output:</strong> {r.actualOutput}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        <strong>Judge Reasoning:</strong> {r.reasoning}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
