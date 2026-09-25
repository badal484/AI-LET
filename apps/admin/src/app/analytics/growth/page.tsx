'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../../components/AuthGuard';
import { adminAnalyticsApi } from '../../../services/adminAnalyticsApi';
import type {
  OnboardingFunnelStep,
  AttributionChannelSummary,
  CohortRetentionItem,
} from '@ai-companion/types';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function GrowthAnalyticsPage() {
  const [funnel, setFunnel] = useState<OnboardingFunnelStep[]>([]);
  const [channels, setChannels] = useState<AttributionChannelSummary[]>([]);
  const [cohorts, setCohorts] = useState<CohortRetentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrowthData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAnalyticsApi.getGrowth();
      setFunnel(res.onboardingFunnel || []);
      setChannels(res.attributionChannels || []);
      setCohorts(res.cohortRetention || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to fetch growth data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrowthData();
  }, []);

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link href="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                <ArrowLeft size={16} />
              </Link>
              <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Growth Intelligence & Retention Funnels
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Multi-step onboarding conversion, channel attribution, and 30-day cohort retention matrix
            </p>
          </div>

          <button
            onClick={fetchGrowthData}
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

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '8px', color: '#F87171', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Onboarding Funnel */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            User Onboarding & Activation Funnel (Last 30 Days)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Conversion and drop-off rates through the primary mobile activation journey
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funnel.map((step, idx) => (
              <div key={step.stepName} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '180px', fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  {idx + 1}. {step.stepName}
                </div>

                <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', height: '26px', overflow: 'hidden', display: 'flex', position: 'relative' }}>
                  <div
                    style={{
                      width: `${Math.max(step.conversionRate, 2)}%`,
                      backgroundColor: idx === funnel.length - 1 ? '#4ADE80' : '#60A5FA',
                      height: '100%',
                      transition: 'width 0.3s ease',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    left: '10px',
                    top: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#FFFFFF',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                  }}>
                    {step.count.toLocaleString()} users ({step.conversionRate}%)
                  </span>
                </div>

                <div style={{ width: '100px', textAlign: 'right', fontSize: '12px', color: step.dropoffRate > 30 ? '#F87171' : 'var(--text-muted)' }}>
                  {idx > 0 ? `-${step.dropoffRate}% drop` : 'Baseline'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attribution Channels */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Acquisition Channel Attribution & Monetization Efficiency
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Breakdown of signups, activated users, and gross revenue by entry channel
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Channel / Source</th>
                  <th style={{ padding: '10px 12px' }}>Signups</th>
                  <th style={{ padding: '10px 12px' }}>Activated Users</th>
                  <th style={{ padding: '10px 12px' }}>Activation Rate</th>
                  <th style={{ padding: '10px 12px' }}>Paying Users</th>
                  <th style={{ padding: '10px 12px' }}>Gross Revenue</th>
                </tr>
              </thead>
              <tbody>
                {channels.map(ch => (
                  <tr key={ch.source} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', textTransform: 'capitalize' }}>{ch.source}</td>
                    <td style={{ padding: '10px 12px' }}>{ch.signups.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{ch.activated.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: ch.activationRate >= 40 ? '#4ADE80' : 'var(--text-primary)' }}>
                      {ch.activationRate}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>{ch.payingUsers.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#4ADE80', fontWeight: '600' }}>
                      ${ch.grossRevenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cohort Retention Matrix */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            Cohort Retention Matrix (D1 - D30)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Percentage of signup cohort returning to engage in meaningful conversations
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Signup Cohort</th>
                  <th style={{ padding: '10px 12px' }}>Cohort Size</th>
                  <th style={{ padding: '10px 12px' }}>Day 1</th>
                  <th style={{ padding: '10px 12px' }}>Day 3</th>
                  <th style={{ padding: '10px 12px' }}>Day 7</th>
                  <th style={{ padding: '10px 12px' }}>Day 14</th>
                  <th style={{ padding: '10px 12px' }}>Day 30</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map(c => (
                  <tr key={c.cohortDate} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>{c.cohortDate}</td>
                    <td style={{ padding: '10px 12px' }}>{c.cohortSize.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', backgroundColor: c.d1Rate >= 40 ? 'rgba(74, 222, 128, 0.15)' : 'transparent' }}>
                      {c.d1Rate > 0 ? `${c.d1Rate}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', backgroundColor: c.d3Rate >= 30 ? 'rgba(74, 222, 128, 0.15)' : 'transparent' }}>
                      {c.d3Rate > 0 ? `${c.d3Rate}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', backgroundColor: c.d7Rate >= 25 ? 'rgba(74, 222, 128, 0.15)' : 'transparent' }}>
                      {c.d7Rate > 0 ? `${c.d7Rate}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{c.d14Rate > 0 ? `${c.d14Rate}%` : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{c.d30Rate > 0 ? `${c.d30Rate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
