'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../services/adminAIApi';
import { AIAnalyticsOverview, AIModelMetrics, AICostMetrics } from '@ai-companion/types';
import Link from 'next/link';

export default function AIOverviewPage() {
  const [overview, setOverview] = useState<AIAnalyticsOverview | null>(null);
  const [modelMetrics, setModelMetrics] = useState<AIModelMetrics[]>([]);
  const [costMetrics, setCostMetrics] = useState<AICostMetrics | null>(null);
  const [feedback, setFeedback] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovData, costData, fbData] = await Promise.all([
        adminAIApi.getOverview(7),
        adminAIApi.getCosts(),
        adminAIApi.getFeedbackSummary(30),
      ]);
      setOverview(ovData.overview);
      setModelMetrics(ovData.modelMetrics);
      setCostMetrics(costData);
      setFeedback(fbData);
    } catch (err: any) {
      setError(err.message || 'Failed to load AI overview metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, color: '#111827' }}>AI Reliability & Quality Hub</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>Production AI gateway telemetry, model routing, prompt governance & evaluation</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/ai/intelligence" style={{ padding: '0.5rem 1rem', background: '#6366f1', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            Intelligence Studio
          </Link>
          <Link href="/ai/knowledge" style={{ padding: '0.5rem 1rem', background: '#0284c7', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            Knowledge & RAG
          </Link>
          <Link href="/ai/models" style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            Model Registry
          </Link>
          <Link href="/ai/prompts" style={{ padding: '0.5rem 1rem', background: '#8b5cf6', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            Prompt Registry
          </Link>
          <Link href="/ai/evaluation" style={{ padding: '0.5rem 1rem', background: '#10b981', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            Evaluation Lab
          </Link>
          <Link href="/character-simulation" style={{ padding: '0.5rem 1rem', background: '#ec4899', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            Simulation & Goals
          </Link>
          <Link href="/ai/playground" style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 500 }}>
            Playground & Replay
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading AI metrics...</div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Total AI Requests (7d)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>{overview?.totalRequests.toLocaleString() || 0}</div>
              <div style={{ color: '#10b981', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Success rate: {((overview?.successRate || 1) * 100).toFixed(1)}%</div>
            </div>

            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Avg Generation Latency</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>{overview?.averageLatencyMs || 0} ms</div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>TTFT: {overview?.averageTtftMs || 0} ms</div>
            </div>

            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>Estimated Cost (30d)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>${costMetrics?.monthlyCostUsd?.toFixed(4) || '0.0000'}</div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Daily: ${costMetrics?.dailyCostUsd?.toFixed(4) || '0.0000'}</div>
            </div>

            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>User Satisfaction Rate</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>{((feedback?.positiveRate || 1) * 100).toFixed(1)}%</div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Total feedback: {feedback?.totalFeedback || 0}</div>
            </div>
          </div>

          {/* Provider Health & Circuit Status */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginTop: 0, marginBottom: '1rem' }}>Provider Health & Circuit Status</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {overview?.providerHealth?.length ? (
                overview.providerHealth.map((ph) => (
                  <div key={ph.provider} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', background: '#f9fafb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{ph.provider}</span>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: ph.status === 'HEALTHY' ? '#dcfce7' : ph.status === 'DEGRADED' ? '#fef3c7' : '#fee2e2',
                          color: ph.status === 'HEALTHY' ? '#166534' : ph.status === 'DEGRADED' ? '#92400e' : '#991b1b',
                        }}
                      >
                        {ph.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      Avg Latency: {ph.avgLatencyMs} ms | Failures: {ph.consecutiveFailures}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>All integrated AI adapters (Mock, OpenAI, Anthropic) active and operational.</div>
              )}
            </div>
          </div>

          {/* Model Breakdown Table */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginTop: 0, marginBottom: '1rem' }}>Active Model Performance & Routing Metrics</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Model</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Provider</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Requests</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Error Rate</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Avg Latency</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Total Tokens</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelMetrics.map((m) => (
                  <tr key={m.modelId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{m.modelName}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{m.provider}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{m.totalRequests}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: m.errorRate > 0.05 ? '#ef4444' : '#10b981' }}>{(m.errorRate * 100).toFixed(1)}%</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{m.averageLatencyMs} ms</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{m.totalTokens.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>${m.estimatedCostUsd.toFixed(4)}</td>
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
