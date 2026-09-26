'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MetricCard } from '../components/MetricCard';
import { AuthGuard, useAdminAuth } from '../components/AuthGuard';
import { adminAnalyticsApi } from '../services/adminAnalyticsApi';
import { AdminCharacterApi } from '../services/adminCharacterApi';
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
  ChevronRight,
  Sliders,
  Cpu,
  Radio,
} from 'lucide-react';

export default function AdminCommandCenterPage() {
  const { admin } = useAdminAuth();
  const [data, setData] = useState<AdminAnalyticsOverviewData | null>(null);
  const [topCharacters, setTopCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overview, charRes] = await Promise.all([
        adminAnalyticsApi.getOverview().catch(() => null),
        AdminCharacterApi.listCharacters({ limit: 6 }).catch(() => ({ characters: [] })),
      ]);
      setData(overview);
      setTopCharacters(charRes.characters || []);
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* 🌟 Elegant Hero Operations Banner */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(99, 102, 241, 0.08) 50%, rgba(236, 72, 153, 0.04) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '16px',
            padding: '28px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px',
            boxShadow: '0 8px 32px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
          }}
        >
          {/* Subtle background glow circle */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '240px',
              height: '240px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  color: '#D8B4FE',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                }}
              >
                Operational Command
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34D399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <Activity size={12} /> All Systems Nominal
              </span>
            </div>

            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              AI Companion Control Center
            </h1>
            <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
              Live engine monitoring for multi-modal dialogue, voice latency, discovery curation, and user engagement.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
            <button
              onClick={handleTriggerAggregation}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#F1F5F9',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!refreshing) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={e => {
                if (!refreshing) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ color: '#A855F7' }} />
              {refreshing ? 'Aggregating...' : 'Refresh Telemetry'}
            </button>

            <Link
              href="/characters"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '600',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4)',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.94')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
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
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* ⚡ SMART ACTION SHORTCUTS */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="#A855F7" />
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9', margin: 0 }}>
                Core Engine Studios
              </h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {/* Card 1: Character Studio */}
            <Link
              href="/characters"
              style={{
                padding: '20px',
                backgroundColor: '#0F121C',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.35)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(168, 85, 247, 0.12)',
                    color: '#C084FC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <Bot size={18} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 4px 0' }}>
                  Character Studio
                </h3>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                  Draft backstories, emotional policy engines, and live version releases.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '14px', fontSize: '12px', fontWeight: '600', color: '#A855F7' }}>
                <span>Launch Studio</span>
                <ChevronRight size={13} />
              </div>
            </Link>

            {/* Card 2: Knowledge RAG */}
            <Link
              href="/ai/knowledge"
              style={{
                padding: '20px',
                backgroundColor: '#0F121C',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    color: '#60A5FA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <BookOpen size={18} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 4px 0' }}>
                  Knowledge & Vector RAG
                </h3>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                  Embed documents, memories, and domain guides with hybrid retrieval.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '14px', fontSize: '12px', fontWeight: '600', color: '#60A5FA' }}>
                <span>Manage Collections</span>
                <ChevronRight size={13} />
              </div>
            </Link>

            {/* Card 3: Discovery Feed */}
            <Link
              href="/discovery"
              style={{
                padding: '20px',
                backgroundColor: '#0F121C',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    color: '#FBBF24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <Compass size={18} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 4px 0' }}>
                  Discovery & Home Feed
                </h3>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                  Curate banners, rank trending categories, and tune discovery algorithms.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '14px', fontSize: '12px', fontWeight: '600', color: '#FBBF24' }}>
                <span>Configure Feeds</span>
                <ChevronRight size={13} />
              </div>
            </Link>

            {/* Card 4: Voice Telemetry */}
            <Link
              href="/voice"
              style={{
                padding: '20px',
                backgroundColor: '#0F121C',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.35)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#34D399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <Mic size={18} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 4px 0' }}>
                  Voice & Telemetry
                </h3>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                  ElevenLabs/Cartesia bindings, TTFT latency tracking, and speech models.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '14px', fontSize: '12px', fontWeight: '600', color: '#34D399' }}>
                <span>Monitor Voice</span>
                <ChevronRight size={13} />
              </div>
            </Link>
          </div>
        </div>

        {/* 📊 Live KPI Overview Grid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <TrendingUp size={16} color="#60A5FA" />
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9', margin: 0 }}>
              Live Platform Telemetry
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <MetricCard
              title="Daily Active Users"
              value={loading ? '...' : (data?.dau ?? 0).toLocaleString()}
              change={`WAU: ${(data?.wau ?? 0).toLocaleString()}`}
              isPositive={true}
              icon={Users}
              iconColor="#A855F7"
              iconBg="rgba(168, 85, 247, 0.12)"
              badge="Growth"
            />
            <MetricCard
              title="New Users Today"
              value={loading ? '...' : (data?.newUsersToday ?? 0).toLocaleString()}
              change={`Activation: ${data?.activationRate ?? 0}%`}
              isPositive={(data?.activationRate ?? 0) >= 30}
              icon={Sparkles}
              iconColor="#3B82F6"
              iconBg="rgba(59, 130, 246, 0.12)"
              badge="Acquisition"
            />
            <MetricCard
              title="Active Conversations"
              value={loading ? '...' : `${data?.activeConversations ?? 0} chats`}
              change={`${data?.totalMessagesToday ?? 0} msgs today`}
              isPositive={true}
              icon={Bot}
              iconColor="#10B981"
              iconBg="rgba(16, 185, 129, 0.12)"
              badge="Realtime"
            />
            <MetricCard
              title="Daily Revenue"
              value={loading ? '...' : `$${(data?.dailyRevenue ?? 0).toFixed(2)}`}
              change="Credits & VIP"
              isPositive={true}
              icon={DollarSign}
              iconColor="#F59E0B"
              iconBg="rgba(245, 158, 11, 0.12)"
              badge="Billing"
            />
            <MetricCard
              title="Daily AI Compute"
              value={loading ? '...' : `$${(data?.dailyAICost ?? 0).toFixed(4)}`}
              change="LLM inference"
              isPositive={(data?.dailyAICost ?? 0) < 50}
              icon={Cpu}
              iconColor="#EC4899"
              iconBg="rgba(236, 72, 153, 0.12)"
              badge="Cost"
            />
            <MetricCard
              title="Gross Margin"
              value={loading ? '...' : `$${(data?.estimatedGrossMargin ?? 0).toFixed(2)}`}
              change="Net Profit"
              isPositive={(data?.estimatedGrossMargin ?? 0) >= 0}
              icon={CreditCard}
              iconColor="#8B5CF6"
              iconBg="rgba(139, 92, 246, 0.12)"
              badge="Margin"
            />
          </div>
        </div>

        {/* 🎭 Top Performing Companions Showcase */}
        <div
          style={{
            backgroundColor: '#0F121C',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '14px',
            padding: '22px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: 0 }}>
                Active Production Companions
              </h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '3px 0 0 0' }}>
                Companions currently published and active on the mobile application feed.
              </p>
            </div>
            <Link
              href="/characters"
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#A855F7',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>View All Directory</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {topCharacters.slice(0, 4).map((char: any) => (
              <div
                key={char.id}
                style={{
                  backgroundColor: '#131826',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <img
                  src={char.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                  alt={char.name}
                  style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#FFFFFF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {char.name}
                    </h4>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: char.status === 'PUBLISHED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: char.status === 'PUBLISHED' ? '#34D399' : '#FBBF24',
                        fontWeight: '700',
                      }}
                    >
                      {char.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {char.tagline || char.category || 'AI Companion'}
                  </p>
                </div>
                <Link
                  href={`/characters/${char.id}`}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#C084FC',
                    fontSize: '11px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Tune
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* 🛡️ Operational Alerts & Health Sentinel */}
        <div
          style={{
            backgroundColor: '#0F121C',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '14px',
            padding: '22px 24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF', margin: 0 }}>
                <AlertTriangle size={16} style={{ color: '#F59E0B' }} /> Operational Signals & Cluster Health
              </h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '3px 0 0 0' }}>
                Continuous monitoring for LLM latency, cost spikes, and safety flags.
              </p>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#4ADE80',
              }}
            >
              {data?.activeAlerts?.length ?? 0} Incidents
            </span>
          </div>

          {!data?.activeAlerts || data.activeAlerts.length === 0 ? (
            <div style={{ padding: '22px', textAlign: 'center', backgroundColor: '#090B10', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
              <CheckCircle2 size={24} style={{ color: '#10B981', margin: '0 auto 6px' }} />
              <p style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: '600', margin: '0 0 2px 0' }}>
                All Platform Systems Operational
              </p>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>
                Zero active cost anomalies, security violations, or infrastructure errors detected across cluster.
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
                      padding: '5px 12px',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#E2E8F0',
                      fontSize: '11px',
                      fontWeight: '600',
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
