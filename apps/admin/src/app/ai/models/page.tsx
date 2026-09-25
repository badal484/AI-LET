'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIModelData, AIRoutingPolicyData } from '@ai-companion/types';
import { AuthGuard } from '../../../components/AuthGuard';
import { Cpu, ArrowLeft, RefreshCw, Layers, ShieldCheck, Zap } from 'lucide-react';
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
              <Cpu size={28} style={{ color: 'var(--accent-primary)' }} />
              Model Registry & Routing Policies
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Active AI backends, context window boundaries, unit economics, and heuristic workload routing policies.
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

        {statusMessage && (
          <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
            {statusMessage}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading model registry...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Models Table */}
            <div className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Registered AI Models</h2>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '14px 20px' }}>Model Name</th>
                    <th style={{ padding: '14px 20px' }}>Provider</th>
                    <th style={{ padding: '14px 20px' }}>Context</th>
                    <th style={{ padding: '14px 20px' }}>Cost / 1k (In/Out)</th>
                    <th style={{ padding: '14px 20px' }}>Latency / Quality</th>
                    <th style={{ padding: '14px 20px' }}>Capabilities</th>
                    <th style={{ padding: '14px 20px' }}>Status</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.displayName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{m.modelName}</div>
                      </td>
                      <td style={{ padding: '16px 20px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{m.provider}</td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{m.contextWindow.toLocaleString()} tokens</td>
                      <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontWeight: 600 }}>${m.inputCostPer1k} / ${m.outputCostPer1k}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{m.latencyClass}</span> / <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{m.qualityClass}</span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {m.capabilities.map((cap) => (
                            <span key={cap} style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: m.isEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: m.isEnabled ? '#10b981' : '#ef4444',
                          }}
                        >
                          {m.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleToggleModel(m)}
                            style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            {m.isEnabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleResetCircuit(m.provider, m.modelName)}
                            style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(234, 179, 8, 0.1)', color: '#fde68a', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
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
            <div className="admin-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Workload Routing Policies</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {policies.length > 0 ? (
                  policies.map((p) => (
                    <div key={p.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '18px', background: 'var(--surface-subtle)' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent-primary)' }}>{p.workload}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '8px' }}>
                        <strong>Preferred:</strong> {p.preferredModelId}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <strong>Fallbacks:</strong> {p.fallbackModelIds.join(', ') || 'None'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <strong>Latency Sensitivity:</strong> {p.latencySensitivity}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Dynamic heuristic workload policies active across: CONVERSATION, MEMORY_EXTRACTION, MEMORY_SUMMARIZATION, RELATIONSHIP_ANALYSIS, PROACTIVE_DECISION, PROACTIVE_GENERATION, EMBEDDING, MODERATION, EVALUATION.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
