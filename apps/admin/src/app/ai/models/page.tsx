'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIModelData, AIRoutingPolicyData } from '@ai-companion/types';
import Link from 'next/link';

export default function ModelRegistryPage() {
  const [models, setModels] = useState<AIModelData[]>([]);
  const [policies, setPolicies] = useState<AIRoutingPolicyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelsData, policiesData] = await Promise.all([
        adminAIApi.listModels(),
        adminAIApi.listRoutingPolicies(),
      ]);
      setModels(modelsData);
      setPolicies(policiesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load model registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleModel = async (model: AIModelData) => {
    try {
      await adminAIApi.updateModel(model.id, { isEnabled: !model.isEnabled });
      setStatusMessage(`Updated ${model.displayName} status`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetCircuit = async (provider: string, modelName: string) => {
    try {
      await adminAIApi.resetCircuitBreaker(provider, modelName);
      setStatusMessage(`Circuit breaker reset for ${provider}/${modelName}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link href="/ai" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            ← Back to AI Hub
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0 0 0', color: '#111827' }}>Model Registry & Routing Policies</h1>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '0.75rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '1rem' }}>
          {statusMessage}
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading model registry...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Models Table */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Registered AI Models</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Model Name</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Provider</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Context</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Cost / 1k (In/Out)</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Latency / Quality</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Capabilities</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{m.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{m.modelName}</div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{m.provider}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{m.contextWindow.toLocaleString()} tokens</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>${m.inputCostPer1k} / ${m.outputCostPer1k}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span style={{ textTransform: 'capitalize' }}>{m.latencyClass}</span> / <span style={{ textTransform: 'capitalize' }}>{m.qualityClass}</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {m.capabilities.map((cap) => (
                          <span key={cap} style={{ background: '#f3f4f6', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem' }}>
                            {cap}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: m.isEnabled ? '#dcfce7' : '#fee2e2',
                          color: m.isEnabled ? '#166534' : '#991b1b',
                        }}
                      >
                        {m.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleToggleModel(m)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          {m.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleResetCircuit(m.provider, m.modelName)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Reset Circuit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Workload Routing Policies */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Workload Routing Policies</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {policies.length > 0 ? (
                policies.map((p) => (
                  <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', background: '#f9fafb' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>{p.workload}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#4b5563', marginTop: '0.5rem' }}>
                      <strong>Preferred:</strong> {p.preferredModelId}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      <strong>Fallbacks:</strong> {p.fallbackModelIds.join(', ') || 'None'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      <strong>Latency Sensitivity:</strong> {p.latencySensitivity}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Dynamic heuristic workload policies active across: CONVERSATION, MEMORY_EXTRACTION, MEMORY_SUMMARIZATION, RELATIONSHIP_ANALYSIS, PROACTIVE_DECISION, PROACTIVE_GENERATION, EMBEDDING, MODERATION, EVALUATION.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
