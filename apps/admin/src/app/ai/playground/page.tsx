'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIModelData, AIPromptData, AIPlaygroundResult, ProductionReplayResult } from '@ai-companion/types';
import { AuthGuard } from '../../../components/AuthGuard';
import { Play, Sparkles, History, ArrowLeft, RefreshCw, Cpu, Sliders, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function PlaygroundPage() {
  const [models, setModels] = useState<AIModelData[]>([]);
  const [prompts, setPrompts] = useState<AIPromptData[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedPromptVersionId, setSelectedPromptVersionId] = useState('');
  const [userMessage, setUserMessage] = useState('Hey! Can you explain quantum computing in simple Hinglish?');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [mockMemories, setMockMemories] = useState('User likes physics and tea.\nUser speaks Hindi & English.');
  const [playgroundResult, setPlaygroundResult] = useState<AIPlaygroundResult | null>(null);

  // Replay
  const [traceId, setTraceId] = useState('');
  const [replayResult, setReplayResult] = useState<ProductionReplayResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [mList, pList] = await Promise.all([adminAIApi.listModels(), adminAIApi.listPrompts()]);
        setModels(mList);
        setPrompts(pList);
        if (mList.length > 0) setSelectedModelId(mList[0].id);
        if (pList.length > 0 && pList[0]?.versions && pList[0].versions.length > 0) {
          setSelectedPromptVersionId(pList[0].versions[0].id);
        }
      } catch (err: any) {
        setError(err.message);
      }
    };
    init();
  }, []);

  const handleRunPlayground = async () => {
    if (!selectedModelId || !userMessage) return;
    setLoading(true);
    setError(null);
    try {
      const memories = mockMemories.split('\n').filter((m) => m.trim().length > 0);
      const res = await adminAIApi.runPlayground({
        modelId: selectedModelId,
        promptVersionId: selectedPromptVersionId || undefined,
        userMessage,
        temperature,
        maxTokens,
        mockContext: {
          memories,
        },
      });
      setPlaygroundResult(res);
    } catch (err: any) {
      setError(err.message || 'Playground execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRunReplay = async () => {
    if (!traceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminAIApi.replayGeneration({ traceId });
      setReplayResult(res);
    } catch (err: any) {
      setError(err.message || 'Production replay failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <Link
              href="/ai"
              style={{
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
              }}
            >
              <ArrowLeft size={14} /> Back to AI Hub
            </Link>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: 0,
              }}
            >
              <Play size={28} style={{ color: 'var(--accent-primary)' }} />
              AI Model Playground & Production Replay
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Isolated sandbox for multi-model inference testing, prompt permutation, and exact production replay.
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '14px 18px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left: Playground Controls */}
          <div className="admin-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} style={{ color: 'var(--accent-primary)' }} /> Sandbox Test Generation
            </h2>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Select AI Model
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.provider}) - {m.latencyClass}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Prompt Template Version
              </label>
              <select
                value={selectedPromptVersionId}
                onChange={(e) => setSelectedPromptVersionId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                {prompts.flatMap((p) =>
                  (p.versions || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {p.name} (V{v.versionNumber} - {v.status})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                User Test Message
              </label>
              <textarea
                rows={3}
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Mock Context Memories (one per line)
              </label>
              <textarea
                rows={2}
                value={mockMemories}
                onChange={(e) => setMockMemories(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Max Output Tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleRunPlayground}
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '12px 20px',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} />
              {loading ? 'Running Inference...' : 'Run Playground Sandbox'}
            </button>
          </div>

          {/* Right: Results & Production Replay */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Playground Output */}
            {playgroundResult && (
              <div className="admin-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Playground Output</h3>
                  <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '12px' }}>
                    ⚡ {playgroundResult.latencyMs} ms
                  </span>
                </div>
                <div
                  style={{
                    background: 'var(--surface-subtle)',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-primary)',
                  }}
                >
                  {playgroundResult.outputContent}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginTop: '14px' }}>
                  <div>Tokens: <strong style={{ color: 'var(--text-primary)' }}>{playgroundResult.totalTokens}</strong> (In: {playgroundResult.promptTokens} / Out: {playgroundResult.completionTokens})</div>
                  <div>Est Cost: <strong style={{ color: 'var(--text-primary)' }}>${playgroundResult.estimatedCostUsd?.toFixed(6) || '0.000000'}</strong></div>
                  <div style={{ gridColumn: 'span 2', fontFamily: 'monospace', fontSize: '12px' }}>Context Hash: {playgroundResult.contextHash}</div>
                </div>
              </div>
            )}

            {/* Production Replay Box */}
            <div className="admin-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} style={{ color: 'var(--accent-primary)' }} /> Production Generation Replay
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px 0' }}>
                Input a production request ID or trace ID to reproduce generation settings and compare outputs.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={traceId}
                  onChange={(e) => setTraceId(e.target.value)}
                  placeholder="Enter traceId or requestId..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleRunReplay}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Replay
                </button>
              </div>

              {replayResult && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', background: 'var(--surface-subtle)', fontSize: '13px' }}>
                  <div style={{ fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Replay Status: {replayResult.matchAssessment.divergenceNotes}
                  </div>
                  <div style={{ marginTop: '10px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                    <strong>Replay Output:</strong> {replayResult.replayOutput}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    Latency: {replayResult.replayLatencyMs} ms | Original Latency: {replayResult.originalMetadata.latencyMs} ms
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
