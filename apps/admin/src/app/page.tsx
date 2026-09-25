'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MetricCard } from '../components/MetricCard';
import { AuthGuard, useAdminAuth } from '../components/AuthGuard';
import { adminAnalyticsApi } from '../services/adminAnalyticsApi';
import type { AdminAnalyticsOverviewData } from '@ai-companion/types';
import {
  TrendingUp,
  DollarSign,
  FlaskConical,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react';

export default function AdminCommandCenterPage() {
  const { admin, logout } = useAdminAuth();
  const [data, setData] = useState<AdminAnalyticsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const overview = await adminAnalyticsApi.getOverview();
      setData(overview);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load command center data');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAggregation = async () => {
    try {
      setRefreshing(true);
      await adminAnalyticsApi.triggerAggregation();
      await fetchOverview();
    } catch (err: any) {
      alert(`Aggregation trigger failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await adminAnalyticsApi.acknowledgeAlert(alertId);
      setData(prev => prev ? {
        ...prev,
        activeAlerts: prev.activeAlerts.filter(a => a.id !== alertId),
      } : null);
    } catch (err: any) {
      alert(`Failed to acknowledge alert: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Command Center & Growth Intelligence
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#4ADE80',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Activity size={12} /> Live Ops
              </span>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Authenticated as <strong style={{ color: 'var(--accent-primary)' }}>{admin?.email}</strong> ({admin?.roles.join(', ')})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleTriggerAggregation}
              disabled={refreshing}
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
                fontWeight: '500',
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Aggregating...' : 'Refresh Metrics'}
            </button>

            <button
              onClick={logout}
              style={{
                padding: '8px 14px',
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#F87171',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '8px', color: '#F87171', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Executive KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <MetricCard
            title="DAU (Daily Active Users)"
            value={loading ? '...' : (data?.dau ?? 0).toLocaleString()}
            change={`WAU: ${(data?.wau ?? 0).toLocaleString()}`}
            isPositive={true}
          />
          <MetricCard
            title="New Users Today"
            value={loading ? '...' : (data?.newUsersToday ?? 0).toLocaleString()}
            change={`Activation: ${data?.activationRate ?? 0}%`}
            isPositive={(data?.activationRate ?? 0) >= 30}
          />
          <MetricCard
            title="D1 / D7 Retention"
            value={loading ? '...' : `${data?.d1RetentionRate ?? 0}% / ${data?.d7RetentionRate ?? 0}%`}
            change="Active cohort"
            isPositive={(data?.d1RetentionRate ?? 0) >= 40}
          />
          <MetricCard
            title="Daily Revenue"
            value={loading ? '...' : `$${(data?.dailyRevenue ?? 0).toFixed(2)}`}
            change="Gross purchases"
            isPositive={true}
          />
          <MetricCard
            title="Daily AI Token Cost"
            value={loading ? '...' : `$${(data?.dailyAICost ?? 0).toFixed(2)}`}
            change="Estimated cost"
            isPositive={(data?.dailyAICost ?? 0) < 50}
          />
          <MetricCard
            title="Estimated Gross Margin"
            value={loading ? '...' : `$${(data?.estimatedGrossMargin ?? 0).toFixed(2)}`}
            change="Revenue - AI"
            isPositive={(data?.estimatedGrossMargin ?? 0) >= 0}
          />
        </div>

        {/* Quick Domain Navigator */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <Link
            href="/analytics/growth"
            style={{
              padding: '16px',
              backgroundColor: 'var(--surface-primary)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px' }}>
                <TrendingUp size={18} style={{ color: '#60A5FA' }} /> Growth & Funnels
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Onboarding drop-off, acquisition attribution & retention matrix
              </p>
            </div>
            <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>→</span>
          </Link>

          <Link
            href="/analytics/ai-economics"
            style={{
              padding: '16px',
              backgroundColor: 'var(--surface-primary)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px' }}>
                <DollarSign size={18} style={{ color: '#4ADE80' }} /> AI Economics Ledger
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Cost per conversation, model pricing & token spend breakdown
              </p>
            </div>
            <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>→</span>
          </Link>

          <Link
            href="/analytics/experiments"
            style={{
              padding: '16px',
              backgroundColor: 'var(--surface-primary)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px' }}>
                <FlaskConical size={18} style={{ color: '#C084FC' }} /> A/B Experiments
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Deterministic traffic allocation, conversion uplift & guardrails
              </p>
            </div>
            <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>→</span>
          </Link>
        </div>

        {/* Live Alerts & Anomalies */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#F59E0B' }} /> Active Operational Alerts & Anomaly Signals
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Automated detection for AI cost spikes, safety thresholds, and infrastructure health
              </p>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {data?.activeAlerts?.length ?? 0} open incidents
            </span>
          </div>

          {(!data?.activeAlerts || data.activeAlerts.length === 0) ? (
            <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <CheckCircle2 size={24} style={{ color: '#4ADE80', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>All Operational Signals Healthy</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                No active cost anomalies, security spikes, or infrastructure backlog detected
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.activeAlerts.map(alert => (
                <div
                  key={alert.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: alert.severity === 'CRITICAL' ? '#EF4444' : '#F59E0B',
                        color: '#FFFFFF',
                      }}>
                        {alert.severity}
                      </span>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{alert.title}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>• {alert.category}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {alert.message}
                    </p>
                  </div>

                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--surface-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7-Day Performance History Table */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
            7-Day Platform Performance & Unit Economics History
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Daily snapshot aggregated across product metrics, conversational volume, and variable costs
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>DAU</th>
                  <th style={{ padding: '10px 12px' }}>New Users</th>
                  <th style={{ padding: '10px 12px' }}>Activated</th>
                  <th style={{ padding: '10px 12px' }}>Conversations</th>
                  <th style={{ padding: '10px 12px' }}>Messages</th>
                  <th style={{ padding: '10px 12px' }}>Revenue</th>
                  <th style={{ padding: '10px 12px' }}>AI Cost</th>
                  <th style={{ padding: '10px 12px' }}>Gross Margin</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.recentDailyMetrics || data.recentDailyMetrics.length === 0) ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No daily aggregation records available yet. Click &quot;Refresh Metrics&quot; to compute initial metrics.
                    </td>
                  </tr>
                ) : (
                  data.recentDailyMetrics.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>{row.date}</td>
                      <td style={{ padding: '10px 12px' }}>{row.dau.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>{row.newUsers.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>{row.activatedUsers.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>{row.conversations.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>{row.messages.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#4ADE80' }}>${row.revenue.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', color: '#F87171' }}>${row.aiCost.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: row.grossMargin >= 0 ? '#4ADE80' : '#F87171' }}>
                        ${row.grossMargin.toFixed(2)}
                      </td>
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
