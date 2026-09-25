'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIEvaluationDatasetData, AIEvaluationRunData, AIModelData } from '@ai-companion/types';
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

      // Perform regression comparison against baseline
      const compResult = await adminAIApi.compareRuns(runResult.id);
      setComparison(compResult);
    } catch (err: any) {
      setError(err.message || 'Evaluation run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link href="/ai" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            ← Back to AI Hub
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0 0 0', color: '#111827' }}>AI Evaluation Lab & Regression Testing</h1>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading evaluation lab...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Run Configurator Card */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Launch Evaluation Run</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                  Evaluation Dataset
                </label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.testCases?.length || 0} cases)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                  Target AI Model
                </label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                  Evaluator Type
                </label>
                <select
                  value={evaluatorType}
                  onChange={(e) => setEvaluatorType(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
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
                padding: '0.6rem 1.25rem',
                background: running ? '#9ca3af' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? 'Running Evaluation Suite...' : 'Execute Evaluation Suite'}
            </button>
          </div>

          {/* Regression Gate Status & Summary */}
          {comparison && (
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid',
                background: comparison.gateStatus === 'PASSED' ? '#ecfdf5' : comparison.gateStatus === 'WARNING' ? '#fffbeb' : '#fef2f2',
                borderColor: comparison.gateStatus === 'PASSED' ? '#6ee7b7' : comparison.gateStatus === 'WARNING' ? '#fcd34d' : '#fca5a5',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      background: comparison.gateStatus === 'PASSED' ? '#10b981' : comparison.gateStatus === 'WARNING' ? '#f59e0b' : '#ef4444',
                      color: '#fff',
                    }}
                  >
                    GATE: {comparison.gateStatus}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{comparison.summary}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#4b5563' }}>
                  Score Δ: {comparison.deltas?.scoreDelta > 0 ? `+${comparison.deltas.scoreDelta}` : comparison.deltas?.scoreDelta} | Pass Rate Δ: {(comparison.deltas?.passRateDelta * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          {currentRun && (
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Evaluation Run Results</h3>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Average Score: <strong>{currentRun.averageScore} / 10</strong> | Pass Rate: <strong>{((currentRun.metrics?.passRate || 0) * 100).toFixed(0)}%</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {currentRun.results?.map((r, idx) => (
                  <div key={r.id || idx} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', background: '#f9fafb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Test Case #{idx + 1}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#3b82f6' }}>Score: {r.score} / 10</span>
                        <span
                          style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: r.passed ? '#dcfce7' : '#fee2e2',
                            color: r.passed ? '#166534' : '#991b1b',
                          }}
                        >
                          {r.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#111827', background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                      <strong>Output:</strong> {r.actualOutput}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.4rem' }}>
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
  );
}
