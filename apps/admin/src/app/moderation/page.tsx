'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import {
  ShieldAlert,
  CheckCircle,
  Eye,
  RefreshCw,
  Flag,
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Sparkles,
  SlidersHorizontal,
  X,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { AdminModerationApi } from '../../services/adminModerationApi';
import type { CharacterModerationQueueItem } from '@ai-companion/types';

export default function ModerationPage() {
  const { admin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HIGH_RISK' | 'IN_REVIEW'>('PENDING');
  const [items, setItems] = useState<CharacterModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Decision Form State
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND'>('APPROVE');
  const [rejectionReason, setRejectionReason] = useState<string>('PROHIBITED_CONTENT');
  const [changeRequestDetails, setChangeRequestDetails] = useState('');
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (admin) {
      loadQueue();
    }
  }, [admin, activeTab]);

  const loadQueue = async () => {
    if (!admin) return;
    try {
      setLoading(true);
      const riskLevel = activeTab === 'HIGH_RISK' ? 'HIGH' : undefined;
      const status = activeTab === 'HIGH_RISK' ? undefined : activeTab;
      const data = await AdminModerationApi.listQueue({ status, riskLevel });
      setItems(data || []);
    } catch (err: any) {
      console.error('Failed to load moderation queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (caseId: string) => {
    try {
      const detail = await AdminModerationApi.getCaseDetail(caseId);
      setSelectedCase(detail);
      setDecisionType('APPROVE');
      setChangeRequestDetails('');
      setModeratorNotes('');
    } catch (err: any) {
      alert('Failed to load case details: ' + err.message);
    }
  };

  const handleExecuteDecision = async () => {
    if (!selectedCase) return;
    try {
      setActionLoading(true);
      await AdminModerationApi.reviewCase(selectedCase.caseId, {
        decision: decisionType,
        rejectionReason: decisionType === 'REJECT' || decisionType === 'SUSPEND' ? (rejectionReason as any) : undefined,
        changeRequestDetails: decisionType === 'REQUEST_CHANGES' ? changeRequestDetails : undefined,
        moderatorNotes: moderatorNotes || undefined,
      });

      setToastMessage(`Decision applied successfully: ${decisionType}`);
      setTimeout(() => setToastMessage(null), 4000);
      setSelectedCase(null);
      await loadQueue();
    } catch (err: any) {
      alert('Error applying decision: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) {
      return {
        bg: 'rgba(239, 68, 68, 0.12)',
        text: '#F87171',
        border: 'rgba(239, 68, 68, 0.3)',
        label: 'High Risk',
      };
    }
    if (score >= 30) {
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        text: '#FBBF24',
        border: 'rgba(245, 158, 11, 0.3)',
        label: 'Moderate',
      };
    }
    return {
      bg: 'rgba(16, 185, 129, 0.12)',
      text: '#34D399',
      border: 'rgba(16, 185, 129, 0.3)',
      label: 'Low Risk',
    };
  };

  const filteredItems = items.filter(
    (item) =>
      !searchQuery ||
      item.character?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.creatorProfile?.username?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <AuthGuard>
      <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto', color: '#F8FAFC' }}>
        {/* Top Header & Telemetry */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#3B82F6',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Trust & Safety Studio
              </span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Character Moderation & Review
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '6px', margin: 0 }}>
              Evaluate UGC companion safety scores, review automated safety signals, and enforce platform trust.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={loadQueue}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#E2E8F0',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Sync Queue
            </button>
          </div>
        </div>

        {/* Telemetry Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>Pending Submissions</span>
              <Clock size={16} color="#A855F7" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#FFFFFF', marginTop: '8px' }}>
              {items.length}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              Awaiting safety verification
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>High-Risk Flags</span>
              <AlertTriangle size={16} color="#EF4444" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#F87171', marginTop: '8px' }}>
              {items.filter((i) => i.riskScore >= 70).length}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              Automated score ≥ 70
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>Avg Audit Latency</span>
              <Sparkles size={16} color="#10B981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#34D399', marginTop: '8px' }}>
              1.4 hrs
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              SLA target: &lt; 4.0 hrs
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>Auto-Guard Status</span>
              <ShieldCheck size={16} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#60A5FA', marginTop: '8px' }}>
              Active
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
              OmniGuard AI v4.2 Online
            </span>
          </div>
        </div>

        {toastMessage && (
          <div
            style={{
              padding: '14px 20px',
              marginBottom: '20px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              color: '#34D399',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <CheckCircle size={16} />
            {toastMessage}
          </div>
        )}

        {/* Tab Selection & Search Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            {[
              { key: 'PENDING', label: 'Pending Review' },
              { key: 'HIGH_RISK', label: 'High Risk / Escalated' },
              { key: 'IN_REVIEW', label: 'In Progress' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: activeTab === tab.key ? '#A855F7' : 'transparent',
                  color: activeTab === tab.key ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '320px' }}>
            <input
              type="text"
              placeholder="Search companion or creator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px',
                backgroundColor: '#0C1019',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Main Content Table Container */}
        <div
          style={{
            backgroundColor: '#0C1019',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
              <p style={{ margin: 0, fontSize: '14px' }}>Loading moderation queue items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '28px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                }}
              >
                <CheckCircle size={28} color="#10B981" />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
                Queue is Clear
              </h3>
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, maxWidth: '380px', marginInline: 'auto' }}>
                No companion submissions currently pending in this category. All systems operating normally.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    color: '#64748B',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '16px 20px' }}>Companion</th>
                  <th style={{ padding: '16px 20px' }}>Creator</th>
                  <th style={{ padding: '16px 20px' }}>Safety Score</th>
                  <th style={{ padding: '16px 20px' }}>Status</th>
                  <th style={{ padding: '16px 20px' }}>Reports</th>
                  <th style={{ padding: '16px 20px' }}>Submitted</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}>Audit</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const risk = getRiskBadge(item.riskScore);
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              color: '#FFFFFF',
                              fontSize: '14px',
                            }}
                          >
                            {item.character?.name?.[0] || 'C'}
                          </div>
                          <div>
                            <p style={{ fontWeight: '700', color: '#FFFFFF', margin: 0, fontSize: '14px' }}>
                              {item.character?.name}
                            </p>
                            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>
                              {item.character?.category || 'General'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: '500' }}>
                            @{item.creatorProfile?.username || 'unknown'}
                          </span>
                          {item.creatorProfile?.verificationStatus === 'VERIFIED' && (
                            <UserCheck size={14} color="#3B82F6" />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: '700',
                            backgroundColor: risk.bg,
                            color: risk.text,
                            border: `1px solid ${risk.border}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '3px',
                              backgroundColor: risk.text,
                            }}
                          />
                          {item.riskScore.toFixed(0)} / 100 ({risk.label})
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#CBD5E1',
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {item.reportsCount > 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#F87171',
                              fontWeight: '700',
                              fontSize: '13px',
                            }}
                          >
                            <Flag size={13} /> {item.reportsCount}
                          </span>
                        ) : (
                          <span style={{ color: '#64748B', fontSize: '13px' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '13px', color: '#94A3B8' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDetail(item.id)}
                          style={{
                            padding: '7px 14px',
                            backgroundColor: '#A855F7',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Eye size={13} /> Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detailed Inspection & Review Modal */}
        {selectedCase && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '24px',
            }}
          >
            <div
              style={{
                backgroundColor: '#0C1019',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                maxWidth: '960px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '18px',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#A855F7',
                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Audit Session
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Case #{selectedCase.caseId}</span>
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#FFFFFF', margin: 0 }}>
                    {selectedCase.character?.name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedCase(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '6px 10px',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Grid Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div
                  style={{
                    backgroundColor: '#131927',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#A855F7', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                    Persona & Lore Profile
                  </h4>
                  <p style={{ fontSize: '13px', color: '#E2E8F0', marginBottom: '8px' }}>
                    <strong style={{ color: '#94A3B8' }}>Tagline:</strong> {selectedCase.character?.tagline || 'None'}
                  </p>
                  <p style={{ fontSize: '13px', color: '#E2E8F0', marginBottom: '8px' }}>
                    <strong style={{ color: '#94A3B8' }}>Category:</strong> {selectedCase.character?.category || 'General'}
                  </p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
                    {selectedCase.character?.description || 'No detailed character bio provided.'}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: '#131927',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#3B82F6', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                    Safety Signals & Automated Telemetry
                  </h4>
                  <p style={{ fontSize: '13px', color: '#E2E8F0', marginBottom: '8px' }}>
                    <strong style={{ color: '#94A3B8' }}>Automated Risk Score:</strong>{' '}
                    <span style={{ fontWeight: '700', color: selectedCase.riskScore >= 50 ? '#EF4444' : '#10B981' }}>
                      {selectedCase.riskScore} / 100
                    </span>
                  </p>
                  {selectedCase.automatedFlags && (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 4px 0' }}>Triggered Policy Checks:</p>
                      <pre
                        style={{
                          fontSize: '11px',
                          color: '#FBBF24',
                          backgroundColor: '#07090E',
                          padding: '10px',
                          borderRadius: '8px',
                          overflowX: 'auto',
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(selectedCase.automatedFlags, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Decision Form */}
              <div
                style={{
                  backgroundColor: '#131927',
                  padding: '22px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  marginBottom: '24px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 14px 0', textTransform: 'uppercase' }}>
                  Select Moderation Verdict
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
                  {[
                    { key: 'APPROVE', label: 'Approve & Publish', bg: '#10B981' },
                    { key: 'REQUEST_CHANGES', label: 'Request Changes', bg: '#F59E0B' },
                    { key: 'REJECT', label: 'Reject Draft', bg: '#EF4444' },
                    { key: 'SUSPEND', label: 'Suspend Account', bg: '#DC2626' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDecisionType(opt.key as any)}
                      style={{
                        padding: '12px 10px',
                        backgroundColor: decisionType === opt.key ? opt.bg : 'rgba(255, 255, 255, 0.04)',
                        color: '#FFFFFF',
                        border: decisionType === opt.key ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '13px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {(decisionType === 'REJECT' || decisionType === 'SUSPEND') && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>
                      Rejection Policy Code
                    </label>
                    <select
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: '#07090E',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '13px',
                      }}
                    >
                      <option value="PROHIBITED_CONTENT">Prohibited Content / Safety Violation</option>
                      <option value="IMPERSONATION">Impersonation of Real Person / Celebrity</option>
                      <option value="COPYRIGHT_CONCERN">Copyright or IP Violation</option>
                      <option value="SAFETY_CONFIGURATION">Inadequate Safety Guardrails</option>
                      <option value="SEXUAL_CONTENT_POLICY">Sexual Content Policy Violation</option>
                      <option value="MINOR_SAFETY">Minor Safety Violation</option>
                      <option value="HARASSMENT">Harassment or Hate Speech</option>
                      <option value="OTHER">Other Policy Violation</option>
                    </select>
                  </div>
                )}

                {decisionType === 'REQUEST_CHANGES' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>
                      Feedback & Instructions for Creator
                    </label>
                    <textarea
                      rows={3}
                      value={changeRequestDetails}
                      onChange={(e) => setChangeRequestDetails(e.target.value)}
                      placeholder="Specify required edits before this companion can be verified..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: '#07090E',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>
                    Internal Moderator Notes (Private Audit Trail)
                  </label>
                  <input
                    type="text"
                    value={moderatorNotes}
                    onChange={(e) => setModeratorNotes(e.target.value)}
                    placeholder="Optional notes for compliance record..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#07090E',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              {/* Bottom Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => setSelectedCase(null)}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteDecision}
                  disabled={actionLoading}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#A855F7',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.35)',
                  }}
                >
                  {actionLoading ? 'Applying...' : 'Confirm Verdict'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

