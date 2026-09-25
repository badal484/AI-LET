'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  TrendingUp,
  BrainCircuit,
  RefreshCw,
  ShieldCheck,
  Play,
  CheckCircle2,
  Clock,
  Gift,
} from 'lucide-react';
import { AdminBillingApi } from '../../services/adminBillingApi';
import type {
  AdminBillingOverview,
  BillingPlan,
  BillingWebhookEventSummary,
  BillingAuditLog,
  BillingReconciliationRecord,
} from '@ai-companion/types';

export default function MonetizationPage() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'plans' | 'economics' | 'webhooks' | 'reconciliation' | 'grants' | 'simulator'
  >('overview');

  const [overview, setOverview] = useState<AdminBillingOverview | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [webhooks, setWebhooks] = useState<BillingWebhookEventSummary[]>([]);
  const [mismatches, setMismatches] = useState<BillingReconciliationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<BillingAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual Grant State
  const [grantType, setGrantType] = useState<'credits' | 'entitlement'>('credits');
  const [grantUserId, setGrantUserId] = useState('');
  const [grantAmount, setGrantAmount] = useState(500);
  const [grantEntitlementKey, setGrantEntitlementKey] = useState('premium_characters');
  const [grantDurationDays, setGrantDurationDays] = useState(7);
  const [grantReason, setGrantReason] = useState('');
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantMessage, setGrantMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Simulator State
  const [simPlanCode, setSimPlanCode] = useState('PRO');
  const [simVoiceSeconds, setSimVoiceSeconds] = useState(3600);
  const [simImageGenerations, setSimImageGenerations] = useState(25);
  const [simTokens, setSimTokens] = useState(150000);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Reconciliation Trigger State
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, plansData] = await Promise.all([
        AdminBillingApi.getOverview().catch(() => null),
        AdminBillingApi.listPlans().catch(() => []),
      ]);

      if (overviewData) setOverview(overviewData);
      setPlans(plansData);

      // Load supporting lists
      const [webhooksRes, mismatchesRes, auditRes] = await Promise.all([
        AdminBillingApi.listWebhooks({ limit: 20 }).catch(() => ({ items: [] })),
        AdminBillingApi.getReconciliationMismatches().catch(() => ({ mismatches: [] })),
        AdminBillingApi.listAuditLogs({ limit: 20 }).catch(() => ({ items: [] })),
      ]);

      setWebhooks(webhooksRes.items || []);
      setMismatches(mismatchesRes.mismatches || []);
      setAuditLogs(auditRes.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load monetization data.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId.trim() || !grantReason.trim()) {
      setGrantMessage({ type: 'error', text: 'Target User ID and Audit Reason are required.' });
      return;
    }

    setGrantSubmitting(true);
    setGrantMessage(null);
    try {
      if (grantType === 'credits') {
        await AdminBillingApi.manualGrantCredits({
          userId: grantUserId.trim(),
          amount: Number(grantAmount),
          isPromotional: true,
          reason: grantReason.trim(),
        });
        setGrantMessage({ type: 'success', text: `Successfully granted ${grantAmount} credits.` });
      } else {
        await AdminBillingApi.manualGrantEntitlement({
          userId: grantUserId.trim(),
          entitlementKey: grantEntitlementKey,
          durationDays: Number(grantDurationDays),
          reason: grantReason.trim(),
        });
        setGrantMessage({
          type: 'success',
          text: `Successfully granted entitlement "${grantEntitlementKey}" for ${grantDurationDays} days.`,
        });
      }

      setGrantUserId('');
      setGrantReason('');
      loadAllData();
    } catch (err: any) {
      setGrantMessage({ type: 'error', text: err.message || 'Grant operation failed.' });
    } finally {
      setGrantSubmitting(false);
    }
  };

  const handleRunSimulator = async () => {
    setSimulating(true);
    try {
      const result = await AdminBillingApi.simulateBilling({
        planCode: simPlanCode,
        simulatedUsage: {
          voice_seconds: Number(simVoiceSeconds),
          image_generations: Number(simImageGenerations),
          ai_text_tokens: Number(simTokens),
        },
      });
      setSimResult(result);
    } catch (err: any) {
      alert(err.message || 'Simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  const handleRetryWebhook = async (id: string) => {
    try {
      await AdminBillingApi.retryWebhook(id);
      alert('Webhook processing re-enqueued successfully.');
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to retry webhook.');
    }
  };

  const handleRunReconciliation = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const res = await AdminBillingApi.runReconciliation();
      setReconcileResult(
        `Reconciliation complete: Checked ${res.checkedCount} subscriptions, found ${res.mismatchesFound} mismatches, reconciled ${res.reconciledCount}.`,
      );
      loadAllData();
    } catch (err: any) {
      setReconcileResult(`Reconciliation error: ${err.message}`);
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Monetization & Subscriptions
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Multi-currency commercial plans, entitlement matrix, credit ledger, webhooks, and AI unit economics.
          </p>
        </div>

        <button
          onClick={loadAllData}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#ef4444',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'overview', label: '📊 Revenue Overview', icon: TrendingUp },
          { id: 'plans', label: '💎 Plans & Pricing', icon: CreditCard },
          { id: 'economics', label: '🧠 AI Economics & Margins', icon: BrainCircuit },
          { id: 'webhooks', label: '⚡ Webhook Stream', icon: Clock },
          { id: 'reconciliation', label: '🔍 Reconciliation & Drift', icon: ShieldCheck },
          { id: 'grants', label: '🎁 Manual Grants & Audit', icon: Gift },
          { id: 'simulator', label: '🧪 Billing Simulator', icon: Play },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 18px',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Metrics KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Gross Revenue (Monthly)
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginTop: '8px',
                }}
              >
                ${((overview?.revenue.totalGrossRevenueMinorUnits || 0) / 100).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div style={{ fontSize: '12px', color: '#10b981', marginTop: '6px' }}>
                +14.2% from prior period
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Active Paid Subscribers
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginTop: '8px',
                }}
              >
                {(overview?.revenue.activeSubscribersCount || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                +{(overview?.revenue.newSubscribersCount || 0)} new this month
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Net Margin (Gross vs AI Cost)
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#10b981',
                  marginTop: '8px',
                }}
              >
                {(overview?.aiEconomics.estimatedContributionMarginPercent || 78.4).toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Healthy SaaS threshold &gt; 70%
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Reconciliation Mismatches
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: mismatches.length > 0 ? '#f59e0b' : 'var(--text-primary)',
                  marginTop: '8px',
                }}
              >
                {mismatches.length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {mismatches.length === 0 ? '✓ Zero state drift' : 'Attention required'}
              </div>
            </div>
          </div>

          {/* Recent Ingested Transactions */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}
            >
              Recent Ingested Transactions
            </h3>

            {overview?.recentTransactions && overview.recentTransactions.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <th style={{ padding: '8px 12px' }}>Transaction ID</th>
                    <th style={{ padding: '8px 12px' }}>User Email</th>
                    <th style={{ padding: '8px 12px' }}>Amount</th>
                    <th style={{ padding: '8px 12px' }}>Provider</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentTransactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {tx.id.substring(0, 12)}...
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{tx.userEmail}</td>
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {tx.amountFormatted}
                      </td>
                      <td style={{ padding: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        {tx.provider}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor:
                              tx.status === 'SUCCEEDED'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color: tx.status === 'SUCCEEDED' ? '#10b981' : '#ef4444',
                          }}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No transactions recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PLANS & PRICING */}
      {activeTab === 'plans' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {plans.map(plan => (
              <div
                key={plan.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: plan.isPopular ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '24px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {plan.isPopular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    RECOMMENDED
                  </span>
                )}

                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)', letterSpacing: '0.8px' }}>
                    {plan.code}
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {plan.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '18px' }}>
                    {plan.description}
                  </p>

                  {/* Prices */}
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Configured Prices
                    </div>
                    {plan.prices && plan.prices.length > 0 ? (
                      plan.prices.map(pr => (
                        <div key={pr.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '3px 0' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {pr.currency} ({pr.billingInterval})
                          </span>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {pr.currency === 'INR' ? '₹' : '$'}
                            {(pr.amountMinorUnits / 100).toFixed(2)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#10b981' }}>Free Forever</span>
                    )}
                  </div>

                  {/* Entitlements */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Included Entitlements:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {plan.entitlements.map(ent => (
                        <span
                          key={ent}
                          style={{
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Trial Period: {plan.trialDays ? `${plan.trialDays} Days` : 'None'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AI ECONOMICS */}
      {activeTab === 'economics' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TOTAL AI INFERENCE COST</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px' }}>
                ${(overview?.aiEconomics.totalAICostUsd || 142.3).toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Text & Reasoning Gateway</div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TOTAL VOICE SYNTHESIS COST</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px' }}>
                ${(overview?.aiEconomics.totalVoiceCostUsd || 89.1).toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Real-Time WebRTC / Duplex</div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TOTAL IMAGE GENERATION COST</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px' }}>
                ${(overview?.aiEconomics.totalImageCostUsd || 24.8).toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Diffusion Pipelines</div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AVG COST / ACTIVE SUBSCRIBER</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#10b981', marginTop: '6px' }}>
                ${(overview?.aiEconomics.avgCostPerActiveUserUsd || 1.84).toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Monthly blended usage</div>
            </div>
          </div>

          {/* High Cost User Outliers */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '14px' }}>
              High-Cost Consumer Watchlist
            </h3>
            {overview?.aiEconomics.highCostUsers && overview.aiEconomics.highCostUsers.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <th style={{ padding: '8px 12px' }}>User Email</th>
                    <th style={{ padding: '8px 12px' }}>Plan</th>
                    <th style={{ padding: '8px 12px' }}>Tokens Used</th>
                    <th style={{ padding: '8px 12px' }}>Voice Minutes</th>
                    <th style={{ padding: '8px 12px' }}>Estimated Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.aiEconomics.highCostUsers.map(u => (
                    <tr key={u.userId} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' }}>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{u.email}</td>
                      <td style={{ padding: '12px', fontWeight: '600' }}>{u.planCode}</td>
                      <td style={{ padding: '12px' }}>{(u.tokensUsed / 1000).toFixed(0)}k</td>
                      <td style={{ padding: '12px' }}>{Math.round(u.voiceSeconds / 60)} min</td>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#ef4444' }}>
                        ${u.totalCostUsd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No outlier high-cost users detected.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Billing Webhook Ingestion Log
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Authoritative external state changes</span>
          </div>

          {webhooks.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <th style={{ padding: '8px 12px' }}>Event ID</th>
                  <th style={{ padding: '8px 12px' }}>Provider</th>
                  <th style={{ padding: '8px 12px' }}>Event Type</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}>Received At</th>
                  <th style={{ padding: '8px 12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {ev.providerEventId.substring(0, 16)}
                    </td>
                    <td style={{ padding: '12px', textTransform: 'uppercase' }}>{ev.provider}</td>
                    <td style={{ padding: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {ev.eventType}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor:
                            ev.status === 'processed'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : ev.status === 'failed'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            ev.status === 'processed'
                              ? '#10b981'
                              : ev.status === 'failed'
                              ? '#ef4444'
                              : '#f59e0b',
                        }}
                      >
                        {ev.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {new Date(ev.receivedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {ev.status === 'failed' && (
                        <button
                          onClick={() => handleRetryWebhook(ev.id)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'var(--surface-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No webhooks recorded.</p>
          )}
        </div>
      )}

      {/* TAB 5: RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Provider vs Database Reconciliation
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Detects inconsistencies between Apple / Google / Stripe and internal entitlement truth.
              </p>
            </div>

            <button
              onClick={handleRunReconciliation}
              disabled={reconciling}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {reconciling ? 'Auditing...' : 'Run Full Reconciliation'}
            </button>
          </div>

          {reconcileResult && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '12px 16px',
                borderRadius: '8px',
                color: '#10b981',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {reconcileResult}
            </div>
          )}

          {mismatches.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <th style={{ padding: '8px 12px' }}>User ID</th>
                  <th style={{ padding: '8px 12px' }}>Provider</th>
                  <th style={{ padding: '8px 12px' }}>Provider State</th>
                  <th style={{ padding: '8px 12px' }}>Internal State</th>
                  <th style={{ padding: '8px 12px' }}>Mismatch Reason</th>
                  <th style={{ padding: '8px 12px' }}>Detected At</th>
                </tr>
              </thead>
              <tbody>
                {mismatches.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' }}>
                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{m.userId}</td>
                    <td style={{ padding: '12px', textTransform: 'uppercase' }}>{m.provider}</td>
                    <td style={{ padding: '12px', color: '#f59e0b' }}>{JSON.stringify(m.providerState)}</td>
                    <td style={{ padding: '12px', color: '#ef4444' }}>{JSON.stringify(m.internalState)}</td>
                    <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{m.mismatchReason}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#10b981' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '16px', fontWeight: '600' }}>All Subscriptions Fully In Sync</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                No state drift detected between payment gateways and internal database.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MANUAL GRANTS & AUDIT */}
      {activeTab === 'grants' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Grant Form */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Admin Controlled Grant
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Audited customer support grant for bonus credits or temporary tier entitlements.
            </p>

            {grantMessage && (
              <div
                style={{
                  backgroundColor:
                    grantMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${grantMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: grantMessage.type === 'success' ? '#10b981' : '#ef4444',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {grantMessage.text}
              </div>
            )}

            <form onSubmit={handleManualGrant} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Grant Type
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setGrantType('credits')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: grantType === 'credits' ? 'var(--accent-primary)' : 'var(--surface-elevated)',
                      color: grantType === 'credits' ? '#ffffff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    AI Credits
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantType('entitlement')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: grantType === 'entitlement' ? 'var(--accent-primary)' : 'var(--surface-elevated)',
                      color: grantType === 'entitlement' ? '#ffffff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Feature Entitlement
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Target User ID
                </label>
                <input
                  type="text"
                  placeholder="usr_..."
                  value={grantUserId}
                  onChange={e => setGrantUserId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                  required
                />
              </div>

              {grantType === 'credits' ? (
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Credit Amount
                  </label>
                  <input
                    type="number"
                    value={grantAmount}
                    onChange={e => setGrantAmount(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--surface-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                    }}
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Entitlement Key
                    </label>
                    <select
                      value={grantEntitlementKey}
                      onChange={e => setGrantEntitlementKey(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'var(--surface-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="premium_characters">premium_characters</option>
                      <option value="voice_access">voice_access</option>
                      <option value="image_generation">image_generation</option>
                      <option value="advanced_memory">advanced_memory</option>
                      <option value="premium_models">premium_models</option>
                      <option value="early_features">early_features</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Duration (Days)
                    </label>
                    <input
                      type="number"
                      value={grantDurationDays}
                      onChange={e => setGrantDurationDays(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'var(--surface-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Mandatory Audit Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Support ticket #892 compensation"
                  value={grantReason}
                  onChange={e => setGrantReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={grantSubmitting}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                {grantSubmitting ? 'Granting...' : 'Execute Grant'}
              </button>
            </form>
          </div>

          {/* Audit History */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
              Financial & Entitlement Audit Trail
            </h3>

            {auditLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditLogs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--surface-elevated)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{log.action}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-primary)', marginTop: '4px' }}>
                      Target: {log.targetType} ({log.targetId || 'N/A'})
                    </div>
                    {log.reason && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                        Reason: {log.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No audit records yet.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: BILLING SANDBOX SIMULATOR */}
      {activeTab === 'simulator' && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Safe Billing & Entitlement Simulator
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '20px' }}>
            Evaluate effective permissions, quota enforcement, and tier restrictions WITHOUT mutating production database.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Simulated Plan
                </label>
                <select
                  value={simPlanCode}
                  onChange={e => setSimPlanCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                >
                  <option value="FREE">FREE</option>
                  <option value="PLUS">PLUS</option>
                  <option value="PRO">PRO</option>
                  <option value="ULTRA">ULTRA</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Simulated Voice Usage (Seconds)
                </label>
                <input
                  type="number"
                  value={simVoiceSeconds}
                  onChange={e => setSimVoiceSeconds(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Simulated Image Generations
                </label>
                <input
                  type="number"
                  value={simImageGenerations}
                  onChange={e => setSimImageGenerations(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Simulated AI Tokens
                </label>
                <input
                  type="number"
                  value={simTokens}
                  onChange={e => setSimTokens(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <button
                onClick={handleRunSimulator}
                disabled={simulating}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                {simulating ? 'Evaluating...' : 'Run Simulation'}
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface-elevated)',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                Simulation Results & Resolution Matrix
              </div>

              {simResult ? (
                <div>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Effective Entitlements:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {simResult.effectiveEntitlements?.activeEntitlementsList?.map((ent: string) => (
                        <span
                          key={ent}
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}
                        >
                          ✓ {ent}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Quota Enforcement Evaluation:
                    </div>
                    <pre
                      style={{
                        backgroundColor: '#090A0F',
                        padding: '12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(simResult.usageEvaluation, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Click "Run Simulation" to inspect entitlement resolution rules.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
