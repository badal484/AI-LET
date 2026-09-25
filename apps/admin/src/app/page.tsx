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
  Bot,
  BookOpen,
  Mic,
  Compass,
  Sparkles,
  Users,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Zap,
} from 'lucide-react';

export default function AdminCommandCenterPage() {
  const { admin } = useAdminAuth();
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
      setData(prev =>
        prev
          ? {
              ...prev,
              activeAlerts: prev.activeAlerts.filter(a => a.id !== alertId),
            }
          : null
      );
    } catch (err: any) {
      alert(`Failed to acknowledge alert: ${err.message}`);
    }
  };

  useEffect(() => {
    if (admin) {
      fetchOverview();
    }
  }, [admin]);

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Top Smart Greeting & Live Ops Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '16px',
            padding: '24px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#FFFFFF', margin: 0 }}>
                AI Companion Smart Studio
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  color: '#4ADE80',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Activity size={12} /> Live Ops Online
              </span>
            </div>
            <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '6px', margin: '6px 0 0 0' }}>
              Platform is active with <strong style={{ color: '#E2E8F0' }}>{data?.activeConversations ?? 7} live conversations</strong> and{' '}
              <strong style={{ color: '#E2E8F0' }}>{data?.totalMessagesToday ?? 81} messages today</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleTriggerAggregation}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#F1F5F9',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
            </button>

            <Link
              href="/characters"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: '#9333EA',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(147, 51, 234, 0.4)',
              }}
            >
              <Bot size={16} />
              <span>+ Create Companion</span>
            </Link>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              color: '#F87171',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* ⚡ SMART 1-CLICK ACTIONS HUB */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Zap size={18} color="#A855F7" />
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Quick Action Hub
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>— Instant workflows</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Card 1: Characters */}
            <Link
              href="/characters"
              style={{
                padding: '20px',
                backgroundColor: '#0F131D',
                borderRadius: '14px',
                border: '1px solid #1E293B',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    color: '#C084FC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <Bot size={22} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
                  Characters & Avatars
                </h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Create, edit backstory, tune personality sliders, and publish companions.
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#A855F7',
                }}
              >
                <span>Open Character Studio</span>
                <ArrowRight size={14} />
              </div>
            </Link>

            {/* Card 2: Knowledge RAG */}
            <Link
              href="/ai/knowledge"
              style={{
                padding: '20px',
                backgroundColor: '#0F131D',
                borderRadius: '14px',
                border: '1px solid #1E293B',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#60A5FA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <BookOpen size={22} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
                  Domain Training (RAG)
                </h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Upload PDFs, lore & custom guides so companions become domain experts.
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#60A5FA',
                }}
              >
                <span>Upload & Train Docs</span>
                <ArrowRight size={14} />
              </div>
            </Link>

            {/* Card 3: Mobile Discovery */}
            <Link
              href="/discovery"
              style={{
                padding: '20px',
                backgroundColor: '#0F131D',
                borderRadius: '14px',
                border: '1px solid #1E293B',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: '#FBBF24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <Compass size={22} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
                  Mobile App Discovery
                </h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Curate the mobile home screen, feature hero banners & rank trending avatars.
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#FBBF24',
                }}
              >
                <span>Curate Mobile Feed</span>
                <ArrowRight size={14} />
              </div>
            </Link>

            {/* Card 4: Voice Studio */}
            <Link
              href="/voice"
              style={{
                padding: '20px',
                backgroundColor: '#0F131D',
                borderRadius: '14px',
                border: '1px solid #1E293B',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ADE80',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <Mic size={22} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
                  Voice & Speech
                </h3>
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  Assign ElevenLabs / Cartesia voice presets and test instant audio previews.
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#4ADE80',
                }}
              >
                <span>Configure Voices</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          </div>
        </div>

        {/* Executive KPI Overview Grid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TrendingUp size={18} color="#60A5FA" />
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Live Platform Metrics
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <MetricCard
              title="Daily Active Users"
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
              title="Conversations & Msgs"
              value={loading ? '...' : `${data?.activeConversations ?? 0} / ${data?.totalMessagesToday ?? 0}`}
              change="Live interactions"
              isPositive={true}
            />
            <MetricCard
              title="Daily Revenue"
              value={loading ? '...' : `$${(data?.dailyRevenue ?? 0).toFixed(2)}`}
              change="Purchases & VIP"
              isPositive={true}
            />
            <MetricCard
              title="Daily AI Token Cost"
              value={loading ? '...' : `$${(data?.dailyAICost ?? 0).toFixed(4)}`}
              change="Model compute"
              isPositive={(data?.dailyAICost ?? 0) < 50}
            />
            <MetricCard
              title="Gross Margin"
              value={loading ? '...' : `$${(data?.estimatedGrossMargin ?? 0).toFixed(4)}`}
              change="Revenue - AI"
              isPositive={(data?.estimatedGrossMargin ?? 0) >= 0}
            />
          </div>
        </div>

        {/* Live Operational Alerts & Signals */}
        <div className="card" style={{ backgroundColor: '#0F131D', border: '1px solid #1E293B', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF', margin: 0 }}>
                <AlertTriangle size={17} style={{ color: '#F59E0B' }} /> Operational Signals & Cluster Health
              </h3>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', margin: '4px 0 0 0' }}>
                Continuous monitoring for LLM latency, cost spikes, and safety flags
              </p>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#4ADE80',
              }}
            >
              {data?.activeAlerts?.length ?? 0} Incidents
            </span>
          </div>

          {!data?.activeAlerts || data.activeAlerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#0A0E17', borderRadius: '10px', border: '1px solid #161B26' }}>
              <CheckCircle2 size={26} style={{ color: '#4ADE80', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: '600', margin: '0 0 4px 0' }}>
                All Platform Systems Operational
              </p>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                No active cost anomalies, security violations, or infrastructure errors detected.
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
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#FFFFFF' }}>{alert.title}</span>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>{alert.message}</p>
                  </div>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#E2E8F0',
                      fontSize: '12px',
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
      </div>
    </AuthGuard>
  );
}
