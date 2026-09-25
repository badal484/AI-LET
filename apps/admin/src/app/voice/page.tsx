'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import { AdminVoiceApi } from '../../services/adminVoiceApi';
import type { VoiceQualityMetrics, VoiceCostOverview } from '@ai-companion/types';

export default function VoiceDashboardPage() {
  const { admin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'preview' | 'sessions'>('overview');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<VoiceQualityMetrics | null>(null);
  const [costOverview, setCostOverview] = useState<VoiceCostOverview | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  // Voice Preview State
  const [previewProvider, setPreviewProvider] = useState('elevenlabs');
  const [previewVoiceId, setPreviewVoiceId] = useState('21m00Tcm4TlvDq8ikWAM');
  const [previewText, setPreviewText] = useState('Hello there! It is wonderful to speak with you today.');
  const [previewSpeed, setPreviewSpeed] = useState(1.0);
  const [previewPitch, setPreviewPitch] = useState(0.0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewLatencyMs, setPreviewLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    if (admin) {
      loadData();
    }
  }, [admin]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [analyticsData, costData, sessionsData] = await Promise.all([
        AdminVoiceApi.getAnalytics().catch(() => null),
        AdminVoiceApi.getCost().catch(() => null),
        AdminVoiceApi.listSessions({ limit: 15 }).catch(() => ({ items: [] })),
      ]);

      setMetrics(analyticsData);
      setCostOverview(costData);
      setSessions(sessionsData.items || []);
    } catch (err) {
      console.error('Failed to load voice dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    try {
      setPreviewLoading(true);
      setPreviewAudioUrl(null);
      const res = await AdminVoiceApi.generatePreview({
        provider: previewProvider,
        voiceId: previewVoiceId,
        text: previewText,
        speed: previewSpeed,
        pitch: previewPitch,
      });

      if (res.audioBase64) {
        setPreviewAudioUrl(`data:audio/mp3;base64,${res.audioBase64}`);
      }
      setPreviewLatencyMs(res.latencyMs);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto', color: '#F3F4F6' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', margin: '0 0 6px 0' }}>Voice Infrastructure & Quality</h1>
          <p style={{ margin: 0, color: '#9CA3AF', fontSize: '14px' }}>
            Monitor real-time voice latency, STT/TTS telemetry, barge-in interruptions, and costs.
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            background: '#1F2937',
            border: '1px solid #374151',
            color: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '13px',
          }}
        >
          ↻ Refresh Telemetry
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #374151', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid #3B82F6' : '2px solid transparent',
            color: activeTab === 'overview' ? '#60A5FA' : '#9CA3AF',
            padding: '10px 18px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Performance & Cost Overview
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'preview' ? '2px solid #3B82F6' : '2px solid transparent',
            color: activeTab === 'preview' ? '#60A5FA' : '#9CA3AF',
            padding: '10px 18px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Voice Studio Preview Sandbox
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'sessions' ? '2px solid #3B82F6' : '2px solid transparent',
            color: activeTab === 'sessions' ? '#60A5FA' : '#9CA3AF',
            padding: '10px 18px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Active & Historical Sessions
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Loading telemetry data...</div>
      ) : activeTab === 'overview' ? (
        <div>
          {/* Latency Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '18px', borderRadius: '12px' }}>
              <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Avg Total Turn Latency</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10B981', marginTop: '6px' }}>
                {metrics?.avgTotalTurnLatencyMs ?? 0} ms
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Mic end to first audio packet</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '18px', borderRadius: '12px' }}>
              <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Avg STT Latency</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#60A5FA', marginTop: '6px' }}>
                {metrics?.avgSttLatencyMs ?? 0} ms
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Speech Recognition & transcript</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '18px', borderRadius: '12px' }}>
              <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Avg LLM TTFT</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#A78BFA', marginTop: '6px' }}>
                {metrics?.avgLlmTtftMs ?? 0} ms
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Model Time-to-First-Token</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '18px', borderRadius: '12px' }}>
              <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Avg TTS First Audio</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#F59E0B', marginTop: '6px' }}>
                {metrics?.avgTtsLatencyMs ?? 0} ms
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Speech synthesis chunk delay</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '18px', borderRadius: '12px' }}>
              <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Barge-In Interrupt Rate</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#EC4899', marginTop: '6px' }}>
                {((metrics?.interruptionRate ?? 0) * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>User interruptions while AI speaks</div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '18px', borderRadius: '12px' }}>
              <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Total Voice Minutes</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#FFFFFF', marginTop: '6px' }}>
                {metrics?.totalVoiceMinutes ?? 0} mins
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>Active sessions: {metrics?.activeSessionsCount ?? 0}</div>
            </div>
          </div>

          {/* Cost Overview Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '22px', borderRadius: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginTop: 0, marginBottom: '16px' }}>Cost Breakdown by Pipeline Component</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                    <span style={{ color: '#9CA3AF' }}>STT Audio Transcription</span>
                    <span style={{ fontWeight: '600' }}>${costOverview?.sttCostUsd?.toFixed(4) ?? '0.0000'}</span>
                  </div>
                  <div style={{ height: '6px', background: '#1F2937', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '25%', height: '100%', background: '#60A5FA' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                    <span style={{ color: '#9CA3AF' }}>LLM Conversational Tokens</span>
                    <span style={{ fontWeight: '600' }}>${costOverview?.llmCostUsd?.toFixed(4) ?? '0.0000'}</span>
                  </div>
                  <div style={{ height: '6px', background: '#1F2937', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '20%', height: '100%', background: '#A78BFA' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                    <span style={{ color: '#9CA3AF' }}>TTS Speech Synthesis</span>
                    <span style={{ fontWeight: '600' }}>${costOverview?.ttsCostUsd?.toFixed(4) ?? '0.0000'}</span>
                  </div>
                  <div style={{ height: '6px', background: '#1F2937', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '55%', height: '100%', background: '#10B981' }} />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #1F2937', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700' }}>Total Voice Cost</span>
                  <span style={{ fontWeight: '700', color: '#10B981', fontSize: '16px' }}>
                    ${costOverview?.totalCostUsd?.toFixed(4) ?? '0.0000'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '22px', borderRadius: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginTop: 0, marginBottom: '16px' }}>Cost by Provider</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(costOverview?.costByProvider || { elevenlabs: 0.05, openai: 0.02, mock: 0.001 }).map(([provider, cost]) => (
                  <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#1F2937', borderRadius: '8px' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{provider}</span>
                    <span style={{ color: '#10B981', fontWeight: '700' }}>${Number(cost).toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'preview' ? (
        <div style={{ background: '#111827', border: '1px solid #1F2937', padding: '28px', borderRadius: '14px', maxWidth: '700px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginTop: 0, marginBottom: '16px' }}>Voice Synthesis Preview Sandbox</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px', fontWeight: '600' }}>Provider</label>
              <select
                value={previewProvider}
                onChange={(e) => setPreviewProvider(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#FFF' }}
              >
                <option value="elevenlabs">ElevenLabs (Turbo v2.5)</option>
                <option value="openai">OpenAI TTS-1</option>
                <option value="mock">Mock Provider (Test/Simulation)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px', fontWeight: '600' }}>Voice ID</label>
              <input
                type="text"
                value={previewVoiceId}
                onChange={(e) => setPreviewVoiceId(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#FFF' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px', fontWeight: '600' }}>Sample Text</label>
              <textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#FFF', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px', fontWeight: '600' }}>Speed: {previewSpeed}x</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={previewSpeed}
                  onChange={(e) => setPreviewSpeed(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', marginBottom: '6px', fontWeight: '600' }}>Pitch: {previewPitch}</label>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="1"
                  value={previewPitch}
                  onChange={(e) => setPreviewPitch(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <button
              onClick={handleGeneratePreview}
              disabled={previewLoading}
              style={{
                marginTop: '10px',
                padding: '12px',
                background: '#3B82F6',
                border: 'none',
                borderRadius: '8px',
                color: '#FFF',
                fontWeight: '700',
                cursor: previewLoading ? 'not-allowed' : 'pointer',
                opacity: previewLoading ? 0.6 : 1,
              }}
            >
              {previewLoading ? 'Synthesizing Speech...' : '▶ Synthesize & Play Preview'}
            </button>

            {previewAudioUrl && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#1F2937', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#9CA3AF' }}>
                  <span>Generated Audio</span>
                  <span>Latency: {previewLatencyMs} ms</span>
                </div>
                <audio controls src={previewAudioUrl} style={{ width: '100%' }} autoPlay />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1F2937', color: '#9CA3AF', background: '#1A2234' }}>
                <th style={{ padding: '14px 18px' }}>Session ID</th>
                <th style={{ padding: '14px 18px' }}>Character</th>
                <th style={{ padding: '14px 18px' }}>User</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px' }}>Mode</th>
                <th style={{ padding: '14px 18px' }}>Duration</th>
                <th style={{ padding: '14px 18px' }}>Turns</th>
                <th style={{ padding: '14px 18px' }}>Cost</th>
                <th style={{ padding: '14px 18px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#6B7280' }}>No voice sessions recorded yet.</td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #1F2937' }}>
                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#60A5FA' }}>{s.id.substring(0, 8)}...</td>
                    <td style={{ padding: '14px 18px', fontWeight: '600' }}>{s.characterName}</td>
                    <td style={{ padding: '14px 18px', color: '#9CA3AF' }}>{s.userEmail || s.userId.substring(0, 8)}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        background: s.status === 'active' || s.status === 'connected' ? '#065F46' : '#374151',
                        color: s.status === 'active' || s.status === 'connected' ? '#34D399' : '#D1D5DB',
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#9CA3AF', textTransform: 'capitalize' }}>{s.voiceMode}</td>
                    <td style={{ padding: '14px 18px' }}>{s.totalDurationSeconds}s</td>
                    <td style={{ padding: '14px 18px' }}>{s.turnsCount}</td>
                    <td style={{ padding: '14px 18px', color: '#10B981', fontWeight: '600' }}>${s.totalCostUsd?.toFixed(4) || '0.0000'}</td>
                    <td style={{ padding: '14px 18px', color: '#6B7280' }}>{new Date(s.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </AuthGuard>
  );
}
