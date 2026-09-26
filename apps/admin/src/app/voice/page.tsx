'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import { AdminVoiceApi } from '../../services/adminVoiceApi';
import { Mic, Activity, DollarSign, Radio, Play, RefreshCw, Volume2, Sparkles, Layers, Sliders } from 'lucide-react';
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
      <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto', color: '#F8FAFC' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Audio Engine & TTS
              </span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Voice Infrastructure & Telemetry
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '6px', margin: 0 }}>
              Monitor real-time voice latency, STT/TTS telemetry, barge-in interruptions, and pipeline economics.
            </p>
          </div>

          <button
            onClick={loadData}
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
            Refresh Telemetry
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            marginBottom: '24px',
            width: 'fit-content',
          }}
        >
          {[
            { key: 'overview', label: 'Performance & Cost Overview' },
            { key: 'preview', label: 'Voice Studio Synthesis Sandbox' },
            { key: 'sessions', label: 'Live & Historical Sessions' },
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Loading voice telemetry streams...</p>
          </div>
        ) : activeTab === 'overview' ? (
          <div>
            {/* Latency Metric Cards */}
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
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '20px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  Avg Turn-Around Latency
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#34D399', marginTop: '6px' }}>
                  {metrics?.avgTotalTurnLatencyMs ?? 0} ms
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Mic stop to first audio packet</div>
              </div>

              <div
                style={{
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '20px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  Avg STT Transcription
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#60A5FA', marginTop: '6px' }}>
                  {metrics?.avgSttLatencyMs ?? 0} ms
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Speech Recognition & text extraction</div>
              </div>

              <div
                style={{
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '20px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  Model LLM TTFT
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#C084FC', marginTop: '6px' }}>
                  {metrics?.avgLlmTtftMs ?? 0} ms
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Time to first streaming token</div>
              </div>

              <div
                style={{
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '20px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  TTS First Chunk Audio
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#FBBF24', marginTop: '6px' }}>
                  {metrics?.avgTtsLatencyMs ?? 0} ms
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Speech synthesis stream delay</div>
              </div>

              <div
                style={{
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '20px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  Barge-In Interrupt Rate
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#F472B6', marginTop: '6px' }}>
                  {((metrics?.interruptionRate ?? 0) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>User cut-in interruptions</div>
              </div>

              <div
                style={{
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '20px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  Total Voice Minutes
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#FFFFFF', marginTop: '6px' }}>
                  {metrics?.totalVoiceMinutes ?? 0} mins
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Active sessions: {metrics?.activeSessionsCount ?? 0}</div>
              </div>
            </div>

            {/* Cost Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div
                style={{
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '24px',
                  borderRadius: '16px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginTop: 0, marginBottom: '18px', color: '#FFFFFF' }}>
                  Cost Breakdown by Pipeline Component
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: '#94A3B8' }}>STT Audio Transcription</span>
                      <span style={{ fontWeight: '700', color: '#FFFFFF' }}>${costOverview?.sttCostUsd?.toFixed(4) ?? '0.0000'}</span>
                    </div>
                    <div style={{ height: '6px', background: '#131927', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '25%', height: '100%', background: '#60A5FA' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: '#94A3B8' }}>LLM Conversational Tokens</span>
                      <span style={{ fontWeight: '700', color: '#FFFFFF' }}>${costOverview?.llmCostUsd?.toFixed(4) ?? '0.0000'}</span>
                    </div>
                    <div style={{ height: '6px', background: '#131927', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '20%', height: '100%', background: '#C084FC' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: '#94A3B8' }}>TTS Speech Synthesis</span>
                      <span style={{ fontWeight: '700', color: '#FFFFFF' }}>${costOverview?.ttsCostUsd?.toFixed(4) ?? '0.0000'}</span>
                    </div>
                    <div style={{ height: '6px', background: '#131927', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '55%', height: '100%', background: '#34D399' }} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.07)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: '#E2E8F0' }}>Total Voice Compute Cost</span>
                    <span style={{ fontWeight: '800', color: '#34D399', fontSize: '18px' }}>
                      ${costOverview?.totalCostUsd?.toFixed(4) ?? '0.0000'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#0C1019',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  padding: '24px',
                  borderRadius: '16px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginTop: 0, marginBottom: '18px', color: '#FFFFFF' }}>
                  Usage Distribution by Provider
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(costOverview?.costByProvider || { elevenlabs: 0.05, openai: 0.02, mock: 0.001 }).map(([provider, cost]) => (
                    <div
                      key={provider}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: '#131927',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      <span style={{ textTransform: 'capitalize', fontWeight: '600', color: '#E2E8F0' }}>{provider}</span>
                      <span style={{ color: '#34D399', fontWeight: '700', fontSize: '14px' }}>${Number(cost).toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'preview' ? (
          <div
            style={{
              background: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '32px',
              borderRadius: '20px',
              maxWidth: '720px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginTop: 0, marginBottom: '6px', color: '#FFFFFF' }}>
              Voice Studio Synthesis Sandbox
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '13px', margin: '0 0 20px 0' }}>
              Generate test speech chunks, adjust pitch and velocity, and test latency with live models.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: '700' }}>
                  Provider
                </label>
                <select
                  value={previewProvider}
                  onChange={(e) => setPreviewProvider(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#131927',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#FFF',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="elevenlabs">ElevenLabs (Turbo v2.5)</option>
                  <option value="openai">OpenAI TTS-1</option>
                  <option value="mock">Mock Provider (Local Simulation)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: '700' }}>
                  Voice ID / Key
                </label>
                <input
                  type="text"
                  value={previewVoiceId}
                  onChange={(e) => setPreviewVoiceId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#131927',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#FFF',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: '700' }}>
                  Sample Text
                </label>
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#131927',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#FFF',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: '700' }}>
                    Speed: {previewSpeed}x
                  </label>
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
                  <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px', fontWeight: '700' }}>
                    Pitch Adjustment: {previewPitch}
                  </label>
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
                  padding: '13px 20px',
                  background: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#FFF',
                  fontWeight: '700',
                  cursor: previewLoading ? 'not-allowed' : 'pointer',
                  opacity: previewLoading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
                }}
              >
                {previewLoading ? (
                  'Synthesizing Speech...'
                ) : (
                  <>
                    <Play size={15} fill="#FFF" />
                    Synthesize & Play Preview
                  </>
                )}
              </button>

              {previewAudioUrl && (
                <div
                  style={{
                    marginTop: '18px',
                    padding: '18px',
                    background: '#131927',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', color: '#94A3B8' }}>
                    <span style={{ fontWeight: '600', color: '#34D399' }}>✓ Audio Synthesized</span>
                    <span>Synthesis Latency: {previewLatencyMs} ms</span>
                  </div>
                  <audio controls src={previewAudioUrl} style={{ width: '100%' }} autoPlay />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#0C1019',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    color: '#64748B',
                    background: 'rgba(255, 255, 255, 0.02)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '16px 20px' }}>Session ID</th>
                  <th style={{ padding: '16px 20px' }}>Companion</th>
                  <th style={{ padding: '16px 20px' }}>Member</th>
                  <th style={{ padding: '16px 20px' }}>Status</th>
                  <th style={{ padding: '16px 20px' }}>Mode</th>
                  <th style={{ padding: '16px 20px' }}>Duration</th>
                  <th style={{ padding: '16px 20px' }}>Turns</th>
                  <th style={{ padding: '16px 20px' }}>Cost</th>
                  <th style={{ padding: '16px 20px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                      No live voice sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#C084FC' }}>
                        {s.id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: '700', color: '#FFFFFF' }}>{s.characterName}</td>
                      <td style={{ padding: '16px 20px', color: '#94A3B8' }}>{s.userEmail || s.userId.substring(0, 8)}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            background:
                              s.status === 'active' || s.status === 'connected'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(255, 255, 255, 0.05)',
                            color: s.status === 'active' || s.status === 'connected' ? '#34D399' : '#CBD5E1',
                          }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#94A3B8', textTransform: 'capitalize' }}>{s.voiceMode}</td>
                      <td style={{ padding: '16px 20px', color: '#E2E8F0' }}>{s.totalDurationSeconds}s</td>
                      <td style={{ padding: '16px 20px', color: '#E2E8F0' }}>{s.turnsCount}</td>
                      <td style={{ padding: '16px 20px', color: '#34D399', fontWeight: '700' }}>
                        ${s.totalCostUsd?.toFixed(4) || '0.0000'}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#64748B' }}>{new Date(s.createdAt).toLocaleTimeString()}</td>
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

