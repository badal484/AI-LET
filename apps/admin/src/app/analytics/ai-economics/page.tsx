'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MetricCard } from '../../../components/MetricCard';
import { AuthGuard } from '../../../components/AuthGuard';
import { adminAnalyticsApi } from '../../../services/adminAnalyticsApi';
import type {
  AIUnitEconomicsSummary,
  AIModelPricingItem,
  AIModelPricingCreateInput,
} from '@ai-companion/types';
import { ArrowLeft, RefreshCw, Cpu, Layers, AlertCircle, PlusCircle } from 'lucide-react';

export default function AIEconomicsPage() {
  const [days, setDays] = useState(30);
  const [economics, setEconomics] = useState<AIUnitEconomicsSummary | null>(null);
  const [pricing, setPricing] = useState<AIModelPricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for adding pricing rate
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [newPricing, setNewPricing] = useState<AIModelPricingCreateInput>({
    provider: 'openai',
    model: '',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    cachedInputPricePerMillion: 0.075,
    currency: 'USD',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [eco, rates] = await Promise.all([
        adminAnalyticsApi.getAIEconomics(days),
        adminAnalyticsApi.getPricing(),
      ]);
      setEconomics(eco);
      setPricing(rates);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load AI economics');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPricing.model) return;
    try {
      await adminAnalyticsApi.createPricing(newPricing);
      setShowPricingModal(false);
      setNewPricing({
        provider: 'openai',
        model: '',
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.6,
        cachedInputPricePerMillion: 0.075,
        currency: 'USD',
      });
      await fetchData();
    } catch (err: any) {
      alert(`Failed to save pricing: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

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
                AI Economics, Request Ledger & Unit Costs
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Token consumption breakdown, cost per conversation, model pricing manager, and anomaly detection
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>

            <button
              onClick={fetchData}
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

        {/* AI Unit Economics KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <MetricCard
            title="Total Estimated Spend"
            value={loading ? '...' : `$${(economics?.totalEstimatedCost ?? 0).toFixed(4)}`}
            change={`${economics?.totalRequests.toLocaleString() || 0} requests`}
            isPositive={true}
          />
          <MetricCard
            title="Cost per Active User"
            value={loading ? '...' : `$${(economics?.costPerUser ?? 0).toFixed(4)}`}
            change="Target < $0.10"
            isPositive={(economics?.costPerUser ?? 0) < 0.1}
          />
          <MetricCard
            title="Cost per Conversation"
            value={loading ? '...' : `$${(economics?.costPerConversation ?? 0).toFixed(4)}`}
            change="Per session"
            isPositive={true}
          />
          <MetricCard
            title="Cost per Message"
            value={loading ? '...' : `$${(economics?.costPerMessage ?? 0).toFixed(5)}`}
            change="Blended average"
            isPositive={true}
          />
          <MetricCard
            title="Input / Output Tokens"
            value={loading ? '...' : `${((economics?.totalInputTokens ?? 0) / 1000).toFixed(1)}k / ${((economics?.totalOutputTokens ?? 0) / 1000).toFixed(1)}k`}
            change={`Cached: ${((economics?.totalCachedTokens ?? 0) / 1000).toFixed(1)}k`}
            isPositive={true}
          />
        </div>

        {/* Cost by Provider & Task breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} style={{ color: '#60A5FA' }} /> Cost by Model Provider
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(economics?.costByProvider || {}).length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No provider usage recorded in window</p>
              ) : (
                Object.entries(economics?.costByProvider || {}).map(([provider, cost]) => (
                  <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '13px' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{provider}</span>
                    <span style={{ fontWeight: '600', color: '#4ADE80' }}>${cost.toFixed(4)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: '#C084FC' }} /> Cost by Workload Task
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(economics?.costByTask || {}).length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No task workload recorded in window</p>
              ) : (
                Object.entries(economics?.costByTask || {}).map(([task, cost]) => (
                  <div key={task} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '13px' }}>
                    <span style={{ fontWeight: '500' }}>{task}</span>
                    <span style={{ fontWeight: '600', color: '#4ADE80' }}>${cost.toFixed(4)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Top Characters by Cost */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Top Characters by Token Spend & AI Resource Consumption
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Identifies characters driving high conversation volume and context generation costs
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Character</th>
                  <th style={{ padding: '10px 12px' }}>Requests</th>
                  <th style={{ padding: '10px 12px' }}>Total Tokens</th>
                  <th style={{ padding: '10px 12px' }}>Total AI Cost</th>
                </tr>
              </thead>
              <tbody>
                {(!economics?.topCharactersByCost || economics.topCharactersByCost.length === 0) ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No character spend recorded yet
                    </td>
                  </tr>
                ) : (
                  economics.topCharactersByCost.map(char => (
                    <tr key={char.characterId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>{char.name}</td>
                      <td style={{ padding: '10px 12px' }}>{char.requestCount.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>{char.totalTokens.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#F87171', fontWeight: '600' }}>${char.totalCost.toFixed(4)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Pricing Manager */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
                Configured AI Model Pricing Rates ($ / 1M Tokens)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Used to calculate real-time ledger costs and prevent hard-coded pricing drift
              </p>
            </div>

            <button
              onClick={() => setShowPricingModal(!showPricingModal)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'var(--accent-primary)',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <PlusCircle size={14} /> Add Model Rate
            </button>
          </div>

          {showPricingModal && (
            <form onSubmit={handleCreatePricing} style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Provider</label>
                  <input
                    type="text"
                    value={newPricing.provider}
                    onChange={e => setNewPricing({ ...newPricing, provider: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Model Name / ID</label>
                  <input
                    type="text"
                    value={newPricing.model}
                    onChange={e => setNewPricing({ ...newPricing, model: e.target.value })}
                    placeholder="e.g. gpt-4o"
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Input $/M</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newPricing.inputPricePerMillion}
                    onChange={e => setNewPricing({ ...newPricing, inputPricePerMillion: parseFloat(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Output $/M</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newPricing.outputPricePerMillion}
                    onChange={e => setNewPricing({ ...newPricing, outputPricePerMillion: parseFloat(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '4px' }}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPricingModal(false)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '6px 14px', backgroundColor: 'var(--accent-primary)', border: 'none', borderRadius: '6px', color: '#FFFFFF', fontWeight: '600', cursor: 'pointer' }}>Save Rate</button>
              </div>
            </form>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 10px' }}>Provider</th>
                  <th style={{ padding: '8px 10px' }}>Model</th>
                  <th style={{ padding: '8px 10px' }}>Input Price / 1M</th>
                  <th style={{ padding: '8px 10px' }}>Output Price / 1M</th>
                  <th style={{ padding: '8px 10px' }}>Cached Input / 1M</th>
                  <th style={{ padding: '8px 10px' }}>Effective From</th>
                </tr>
              </thead>
              <tbody>
                {pricing.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Using built-in default rates (OpenAI $2.5/$10, Claude $3/$15, Gemini $1.25/$5, Mini $0.15/$0.60)
                    </td>
                  </tr>
                ) : (
                  pricing.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>{p.provider}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '600' }}>{p.model}</td>
                      <td style={{ padding: '8px 10px' }}>${p.inputPricePerMillion}</td>
                      <td style={{ padding: '8px 10px' }}>${p.outputPricePerMillion}</td>
                      <td style={{ padding: '8px 10px' }}>${p.cachedInputPricePerMillion}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{p.effectiveFrom.split('T')[0]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Token / Cost Anomalies */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} style={{ color: '#F87171' }} /> Recent Token Spikes & Cost Anomalies
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Requests flagged for high token consumption (&gt;16k tokens), extended latency, or high cost
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 10px' }}>Timestamp</th>
                  <th style={{ padding: '8px 10px' }}>Request ID</th>
                  <th style={{ padding: '8px 10px' }}>Model</th>
                  <th style={{ padding: '8px 10px' }}>Tokens</th>
                  <th style={{ padding: '8px 10px' }}>Cost</th>
                  <th style={{ padding: '8px 10px' }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {(!economics?.recentAnomalies || economics.recentAnomalies.length === 0) ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No cost anomalies detected in this timeframe
                    </td>
                  </tr>
                ) : (
                  economics.recentAnomalies.map(a => (
                    <tr key={a.requestId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{a.createdAt.split('T')[0]}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '12px' }}>{a.requestId.slice(0, 16)}...</td>
                      <td style={{ padding: '8px 10px', fontWeight: '500' }}>{a.model}</td>
                      <td style={{ padding: '8px 10px' }}>{a.tokens.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: '#F87171', fontWeight: '600' }}>${a.cost.toFixed(4)}</td>
                      <td style={{ padding: '8px 10px', color: '#F59E0B' }}>{a.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
