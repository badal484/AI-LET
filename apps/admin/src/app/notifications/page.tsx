'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Send,
  Sparkles,
  Users,
  Activity,
  Play,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { AdminNotificationApi, type ProactiveActionItem } from '../../services/adminNotificationApi';
import type {
  NotificationAnalyticsOverview,
  NotificationCampaignData,
  CampaignDryRunResult,
  ProactiveSimulationResult,
} from '@ai-companion/types';

export default function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'simulator' | 'campaigns' | 'actions' | 'test'>('analytics');
  const [analytics, setAnalytics] = useState<NotificationAnalyticsOverview | null>(null);
  const [campaigns, setCampaigns] = useState<NotificationCampaignData[]>([]);
  const [actions, setActions] = useState<ProactiveActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Proactive Simulator States
  const [simCharId, setSimCharId] = useState('char-1111-1111');
  const [simTimezone, setSimTimezone] = useState('America/New_York');
  const [simContext, setSimContext] = useState('User mentioned they have a big job interview tomorrow morning.');
  const [simHours, setSimHours] = useState(18);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<ProactiveSimulationResult | null>(null);

  // Campaign Form States
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignAudience, setCampaignAudience] = useState<'ALL' | 'NEW_USERS' | 'INACTIVE_USERS' | 'PREMIUM_USERS'>('INACTIVE_USERS');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [deepLink, setDeepLink] = useState('ai-companion://home');
  const [dryRunResult, setDryRunResult] = useState<CampaignDryRunResult | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  // Test Push States
  const [testPushTitle, setTestPushTitle] = useState('Elena Vance');
  const [testPushBody, setTestPushBody] = useState('Hey! Just found an interesting book excerpt you might like.');
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [analyticsData, campaignList, actionsData] = await Promise.all([
        AdminNotificationApi.getAnalytics().catch(() => null),
        AdminNotificationApi.listCampaigns().catch(() => []),
        AdminNotificationApi.listActions({ limit: 15 }).catch(() => ({ items: [], total: 0, page: 1, totalPages: 1 })),
      ]);

      if (analyticsData) setAnalytics(analyticsData);
      setCampaigns(campaignList);
      setActions(actionsData.items || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    try {
      const result = await AdminNotificationApi.simulateProactivity({
        characterId: simCharId,
        userTimezone: simTimezone,
        simulateRecentInteractionHours: simHours,
        userMessageContext: simContext,
      });
      setSimResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown simulation error';
      alert(`Simulation failed: ${message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleDryRunCampaign = async () => {
    setDryRunning(true);
    try {
      const result = await AdminNotificationApi.dryRunCampaign({
        targetAudience: campaignAudience,
      });
      setDryRunResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown dry-run error';
      alert(`Dry run failed: ${message}`);
    } finally {
      setDryRunning(false);
    }
  };

  const handleCreateAndSendCampaign = async () => {
    if (!campaignTitle || !msgTitle || !msgBody) {
      alert('Please fill in campaign title, message title, and message body.');
      return;
    }
    setDispatching(true);
    try {
      const campaign = await AdminNotificationApi.createCampaign({
        title: campaignTitle,
        targetAudience: campaignAudience,
        messageTitle: msgTitle,
        messageBody: msgBody,
        deepLink,
        status: 'APPROVED',
      });

      const dispatchResult = await AdminNotificationApi.dispatchCampaign(campaign.id);
      alert(`Campaign broadcast complete! Sent: ${dispatchResult.sentCount}, Failed: ${dispatchResult.failedCount}`);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown dispatch error';
      alert(`Dispatch failed: ${message}`);
    } finally {
      setDispatching(false);
    }
  };

  const handleSendTestPush = async () => {
    setSendingTest(true);
    setTestPushStatus(null);
    try {
      const res = await AdminNotificationApi.sendTestPush({
        title: testPushTitle,
        body: testPushBody,
        category: 'character_message',
      });
      setTestPushStatus(`Success! Test push dispatched. Result: ${JSON.stringify(res)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown push error';
      setTestPushStatus(`Error: ${message}`);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell style={{ color: 'var(--accent-primary)' }} /> Notifications & Re-engagement Hub
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Production proactive message intelligence, user quiet hours, delivery infrastructure, and campaigns
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '28px' }}>
        {[
          { key: 'analytics' as const, label: '📊 Delivery Analytics', icon: Activity },
          { key: 'simulator' as const, label: '🧪 Proactive Simulator', icon: Sparkles },
          { key: 'campaigns' as const, label: '📢 Re-engagement Campaigns', icon: Users },
          { key: 'actions' as const, label: '⏰ Action Stream', icon: Clock },
          { key: 'test' as const, label: '🔔 Test Push Console', icon: Send },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? '700' : '500',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Loading notifications hub data...
        </div>
      )}

      {/* TAB 1: Analytics */}
      {!loading && activeTab === 'analytics' && analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Active Push Devices</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{(analytics.activePushDevicesCount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: 'var(--accent-primary)', marginTop: '4px' }}>Registered push tokens</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Delivered Notifications</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{(analytics.totalDelivered || 0).toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: '#10B981', marginTop: '4px' }}>Sent: {(analytics.totalSent || 0).toLocaleString()}</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Notification Open Rate</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{(analytics.openRatePercent || 0).toFixed(1)}%</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{(analytics.totalOpened || 0).toLocaleString()} opens</div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Proactive Message Volume</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>{(analytics.proactiveGeneratedCount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: '#F59E0B', marginTop: '4px' }}>Cancelled: {(analytics.proactiveCancelledCount || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Delivery Category Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>📱 Re-engagement & Reminders</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>User Reminders Triggered</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>{analytics.remindersTriggeredCount || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>Admin Campaigns Dispatched</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>{analytics.campaignsDispatchedCount || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>Global Push Opt-out Rate</span>
                  <span style={{ fontWeight: '700', color: '#F59E0B' }}>{(analytics.globalOptOutPercent || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>🛡️ Provider Health & Hygiene</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>Provider Status ({analytics.providerHealth?.providerName || 'APNs/FCM'})</span>
                  <span style={{ fontWeight: '700', color: analytics.providerHealth?.status === 'HEALTHY' ? '#10B981' : '#EF4444' }}>
                    {analytics.providerHealth?.status || 'HEALTHY'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>Delivery Rate</span>
                  <span style={{ fontWeight: '700', color: '#10B981' }}>{(analytics.deliveryRatePercent || 99.2).toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>Invalid / Dead Tokens Cleaned</span>
                  <span style={{ fontWeight: '700' }}>{analytics.invalidTokensCount || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>Failed Deliveries</span>
                  <span style={{ fontWeight: '700', color: '#EF4444' }}>{analytics.totalFailed || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Proactive Simulator */}
      {!loading && activeTab === 'simulator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Controls */}
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>🧪 Simulation Parameters</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Character ID</label>
              <input
                type="text"
                value={simCharId}
                onChange={e => setSimCharId(e.target.value)}
                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>User Timezone (IANA)</label>
              <input
                type="text"
                value={simTimezone}
                onChange={e => setSimTimezone(e.target.value)}
                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Simulated Inactivity Period (Hours)</label>
              <input
                type="number"
                value={simHours}
                onChange={e => setSimHours(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Recent Conversation Seed</label>
              <textarea
                rows={4}
                value={simContext}
                onChange={e => setSimContext(e.target.value)}
                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
              />
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={simulating}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--accent-primary)',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Play size={16} /> {simulating ? 'Evaluating Candidate...' : 'Run Proactive Simulation'}
            </button>
          </div>

          {/* Results */}
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>📊 Decision & Evaluation Trace</h3>

            {simResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Engine Decision:</span>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: '800',
                      fontSize: '12px',
                      backgroundColor:
                        simResult.decision.decision === 'SEND'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : simResult.decision.decision === 'WAIT'
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                      color:
                        simResult.decision.decision === 'SEND'
                          ? '#10B981'
                          : simResult.decision.decision === 'WAIT'
                          ? '#F59E0B'
                          : '#EF4444',
                    }}
                  >
                    {simResult.decision.decision}
                  </span>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Decision Reason</div>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{simResult.decision.reason}</div>
                  {simResult.decision.skipReason && (
                    <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>
                      Skip Code: {simResult.decision.skipReason}
                    </div>
                  )}
                </div>

                {simResult.generatedMessagePreview && (
                  <div style={{ padding: '16px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} /> Generated Companion Message
                    </div>
                    <div style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: '1.5' }}>
                      &ldquo;{simResult.generatedMessagePreview}&rdquo;
                    </div>
                  </div>
                )}

                {simResult.notificationPreview && (
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Push Notification Preview</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{simResult.notificationPreview.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{simResult.notificationPreview.body}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                Click &ldquo;Run Proactive Simulation&rdquo; to test decision logic and prompt generation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Campaigns */}
      {!loading && activeTab === 'campaigns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>📢 Create Re-engagement Campaign</h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Campaign Title (Internal)</label>
                <input
                  type="text"
                  value={campaignTitle}
                  placeholder="e.g. D7 Inactive User Reconnect"
                  onChange={e => setCampaignTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Audience Segment</label>
                <select
                  value={campaignAudience}
                  onChange={e => setCampaignAudience(e.target.value as 'ALL' | 'NEW_USERS' | 'INACTIVE_USERS' | 'PREMIUM_USERS')}
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                >
                  <option value="INACTIVE_USERS">Inactive Users (&gt; 3 days idle)</option>
                  <option value="NEW_USERS">New Users (Last 7 days)</option>
                  <option value="PREMIUM_USERS">Premium Subscribers</option>
                  <option value="ALL">All Opted-In Users</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Push Title</label>
                <input
                  type="text"
                  value={msgTitle}
                  placeholder="e.g. New Companions Await"
                  onChange={e => setMsgTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Push Body</label>
                <textarea
                  rows={3}
                  value={msgBody}
                  placeholder="e.g. Marcus and Elena have new conversation topics ready for you."
                  onChange={e => setMsgBody(e.target.value)}
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Deep Link Target</label>
                <input
                  type="text"
                  value={deepLink}
                  placeholder="ai-companion://home"
                  onChange={e => setDeepLink(e.target.value)}
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleDryRunCampaign}
                  disabled={dryRunning}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {dryRunning ? 'Calculating...' : 'Run Audience Dry Run'}
                </button>

                <button
                  onClick={handleCreateAndSendCampaign}
                  disabled={dispatching}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {dispatching ? 'Broadcasting...' : 'Approve & Send Campaign'}
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>👥 Audience Dry-Run Breakdown</h3>

              {dryRunResult ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Matched Users</div>
                      <div style={{ fontSize: '20px', fontWeight: '700' }}>{dryRunResult.totalMatchedUsers}</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#10B981' }}>Eligible Push Deliveries</div>
                      <div style={{ fontSize: '20px', fontWeight: '700', color: '#10B981' }}>{dryRunResult.eligiblePushUsers}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Excluded (Quiet Hours): <strong>{dryRunResult.ineligibleQuietHoursCount}</strong> | Excluded (Opt-outs): <strong>{dryRunResult.ineligibleOptOutCount}</strong>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Sample Matched Recipients:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dryRunResult.sampleRecipients.map((r, idx) => (
                      <div key={idx} style={{ fontSize: '12px', padding: '6px 10px', backgroundColor: 'var(--bg-base)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{r.displayName}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{r.timezone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  Click &ldquo;Run Audience Dry Run&rdquo; to view audience estimation and quiet hour exclusions.
                </div>
              )}
            </div>
          </div>

          {/* Past Campaigns Table */}
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>📜 Campaign History</h3>
            {campaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No campaigns recorded yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>Title</th>
                    <th style={{ padding: '10px' }}>Audience</th>
                    <th style={{ padding: '10px' }}>Status</th>
                    <th style={{ padding: '10px' }}>Sent</th>
                    <th style={{ padding: '10px' }}>Delivered</th>
                    <th style={{ padding: '10px' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(camp => (
                    <tr key={camp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px', fontWeight: '600' }}>{camp.title}</td>
                      <td style={{ padding: '10px' }}>{camp.targetAudience}</td>
                      <td style={{ padding: '10px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor:
                              camp.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: camp.status === 'COMPLETED' ? '#10B981' : '#F59E0B',
                          }}
                        >
                          {camp.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{camp.sentCount || 0}</td>
                      <td style={{ padding: '10px' }}>{camp.deliveredCount || 0}</td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Action Log */}
      {!loading && activeTab === 'actions' && (
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>⏰ Proactive Actions Lifecycle Stream</h3>

          {actions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No proactive actions recorded yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>Character</th>
                  <th style={{ padding: '10px' }}>Intent</th>
                  <th style={{ padding: '10px' }}>Reason</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {actions.map(action => (
                  <tr key={action.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px', fontWeight: '600' }}>{action.character?.name || 'Companion'}</td>
                    <td style={{ padding: '10px' }}>{action.intentType}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{action.reason}</td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor:
                            action.status === 'SENT' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: action.status === 'SENT' ? '#10B981' : '#EF4444',
                        }}
                      >
                        {action.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{new Date(action.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 5: Test Push Console */}
      {!loading && activeTab === 'test' && (
        <div style={{ maxWidth: '600px', backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>🔔 Send Test Notification</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Directly test push delivery to your currently authenticated admin test devices.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notification Title</label>
            <input
              type="text"
              value={testPushTitle}
              onChange={e => setTestPushTitle(e.target.value)}
              style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notification Body</label>
            <textarea
              rows={3}
              value={testPushBody}
              onChange={e => setTestPushBody(e.target.value)}
              style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
            />
          </div>

          <button
            onClick={handleSendTestPush}
            disabled={sendingTest}
            style={{
              padding: '12px 24px',
              backgroundColor: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Send size={16} /> {sendingTest ? 'Sending...' : 'Dispatch Test Push'}
          </button>

          {testPushStatus && (
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-base)', fontSize: '13px' }}>
              {testPushStatus}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
