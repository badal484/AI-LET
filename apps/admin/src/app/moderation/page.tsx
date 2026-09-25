'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  Eye,
  RefreshCw,
  Flag,
  UserCheck,
} from 'lucide-react';
import { AdminModerationApi } from '../../services/adminModerationApi';
import type { CharacterModerationQueueItem } from '@ai-companion/types';

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HIGH_RISK' | 'IN_REVIEW'>('PENDING');
  const [items, setItems] = useState<CharacterModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Decision Form State
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND'>('APPROVE');
  const [rejectionReason, setRejectionReason] = useState<string>('PROHIBITED_CONTENT');
  const [changeRequestDetails, setChangeRequestDetails] = useState('');
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, [activeTab]);

  const loadQueue = async () => {
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

      setToastMessage(`Successfully applied decision: ${decisionType}`);
      setTimeout(() => setToastMessage(null), 4000);
      setSelectedCase(null);
      await loadQueue();
    } catch (err: any) {
      alert('Error applying decision: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getRiskBadgeColor = (score: number) => {
    if (score >= 70) return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
    if (score >= 30) return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
    return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={28} color="#6366f1" /> Character Moderation & Review
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
            Review user-generated character submissions, evaluate automated safety scores, and enforce platform trust.
          </p>
        </div>
        <button
          onClick={loadQueue}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#e5e7eb',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '14px 20px',
            marginBottom: '20px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            borderRadius: '8px',
            color: '#10b981',
            fontWeight: '500',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #374151', marginBottom: '24px' }}>
        {[
          { key: 'PENDING', label: 'Pending Review' },
          { key: 'HIGH_RISK', label: 'High Risk / Flagged' },
          { key: 'IN_REVIEW', label: 'Under Active Review' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 20px',
              backgroundColor: activeTab === tab.key ? '#374151' : 'transparent',
              color: activeTab === tab.key ? '#ffffff' : '#9ca3af',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? '600' : '500',
              fontSize: '14px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table List */}
      <div style={{ backgroundColor: '#111827', borderRadius: '12px', border: '1px solid #1f2937', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading moderation queue...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
            <CheckCircle size={36} color="#10b981" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '16px', fontWeight: '500', color: '#e5e7eb' }}>Queue is Clear</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>No character submissions require action in this category.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937', backgroundColor: '#1f2937', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 20px' }}>Character</th>
                <th style={{ padding: '16px 20px' }}>Creator</th>
                <th style={{ padding: '16px 20px' }}>Risk Score</th>
                <th style={{ padding: '16px 20px' }}>Status</th>
                <th style={{ padding: '16px 20px' }}>Reports</th>
                <th style={{ padding: '16px 20px' }}>Submitted</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const risk = getRiskBadgeColor(item.riskScore);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '600',
                            color: '#6366f1',
                          }}
                        >
                          {item.character?.name?.[0] || 'C'}
                        </div>
                        <div>
                          <p style={{ fontWeight: '600', color: '#ffffff' }}>{item.character?.name}</p>
                          <p style={{ fontSize: '12px', color: '#9ca3af' }}>{item.character?.category || 'General'}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#e5e7eb', fontSize: '14px' }}>
                          @{item.creatorProfile?.username || 'unknown'}
                        </span>
                        {item.creatorProfile?.verificationStatus === 'VERIFIED' && (
                          <UserCheck size={14} color="#3b82f6" />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: risk.bg,
                          color: risk.text,
                          border: `1px solid ${risk.border}`,
                        }}
                      >
                        {item.riskScore.toFixed(0)} / 100
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          backgroundColor: '#374151',
                          color: '#e5e7eb',
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {item.reportsCount > 0 ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: '600', fontSize: '13px' }}>
                          <Flag size={14} /> {item.reportsCount}
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '13px' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '13px', color: '#9ca3af' }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenDetail(item.id)}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#6366f1',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Eye size={14} /> Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selectedCase && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#111827',
              borderRadius: '16px',
              border: '1px solid #374151',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '32px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151', paddingBottom: '16px', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
                  Review Character: {selectedCase.character?.name}
                </h2>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
                  Creator: @{selectedCase.creator?.username} • Case ID: {selectedCase.caseId}
                </p>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* Character Snapshot & Personality */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#6366f1', marginBottom: '10px' }}>Identity & Backstory</h4>
                <p style={{ fontSize: '13px', color: '#e5e7eb', marginBottom: '8px' }}>
                  <strong>Tagline:</strong> {selectedCase.character?.tagline}
                </p>
                <p style={{ fontSize: '13px', color: '#e5e7eb', marginBottom: '8px' }}>
                  <strong>Category:</strong> {selectedCase.character?.category}
                </p>
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                  {selectedCase.character?.changeRequestDetails || 'No change notes recorded.'}
                </p>
              </div>

              <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#6366f1', marginBottom: '10px' }}>Safety & Risk Analysis</h4>
                <p style={{ fontSize: '13px', color: '#e5e7eb', marginBottom: '8px' }}>
                  <strong>Risk Score:</strong> {selectedCase.riskScore} / 100
                </p>
                {selectedCase.automatedFlags && (
                  <div style={{ marginTop: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>Automated Flags:</p>
                    <pre style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px', overflowX: 'auto' }}>
                      {JSON.stringify(selectedCase.automatedFlags, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Decision Controls */}
            <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Select Moderation Action</h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                {[
                  { key: 'APPROVE', label: 'Approve & Publish', color: '#10b981' },
                  { key: 'REQUEST_CHANGES', label: 'Request Changes', color: '#f59e0b' },
                  { key: 'REJECT', label: 'Reject', color: '#ef4444' },
                  { key: 'SUSPEND', label: 'Suspend', color: '#dc2626' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDecisionType(opt.key as any)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: decisionType === opt.key ? opt.color : '#374151',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Conditional Inputs based on Decision */}
              {(decisionType === 'REJECT' || decisionType === 'SUSPEND') && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                    Rejection Reason Code
                  </label>
                  <select
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#ffffff',
                    }}
                  >
                    <option value="PROHIBITED_CONTENT">Prohibited Content / Safety Violation</option>
                    <option value="IMPERSONATION">Impersonation of Public Figure / Brand</option>
                    <option value="COPYRIGHT_CONCERN">Copyright or Intellectual Property</option>
                    <option value="SAFETY_CONFIGURATION">Inadequate Safety Guardrails</option>
                    <option value="MISLEADING_DESCRIPTION">Misleading / Inaccurate Metadata</option>
                    <option value="SEXUAL_CONTENT_POLICY">Sexual Content Policy Violation</option>
                    <option value="MINOR_SAFETY">Minor Protection / Safety Policy</option>
                    <option value="HARASSMENT">Harassment or Toxic Framing</option>
                    <option value="SPAM">Spam / Low Quality Duplicate</option>
                    <option value="OTHER">Other Platform Policy Violation</option>
                  </select>
                </div>
              )}

              {decisionType === 'REQUEST_CHANGES' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                    Specific Change Instructions for Creator
                  </label>
                  <textarea
                    rows={3}
                    value={changeRequestDetails}
                    onChange={e => setChangeRequestDetails(e.target.value)}
                    placeholder="Describe specific character fields or behaviors requiring creator adjustment..."
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#ffffff',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                  Internal Moderator Notes (Optional)
                </label>
                <input
                  type="text"
                  value={moderatorNotes}
                  onChange={e => setModeratorNotes(e.target.value)}
                  placeholder="Private internal notes for moderation audit log..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#ffffff',
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSelectedCase(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDecision}
                disabled={actionLoading}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#6366f1',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                {actionLoading ? 'Applying...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
