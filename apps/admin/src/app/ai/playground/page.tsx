'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIModelData, AIPromptData, AIPlaygroundResult, ProductionReplayResult } from '@ai-companion/types';
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
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link href="/ai" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            ← Back to AI Hub
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0 0 0', color: '#111827' }}>AI Model Playground & Production Replay</h1>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left: Playground Controls */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Sandbox Test Generation</h2>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' }}>Select Model</label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.provider}) - {m.latencyClass}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' }}>Prompt Template Version</label>
            <select
              value={selectedPromptVersionId}
              onChange={(e) => setSelectedPromptVersionId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
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
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' }}>User Test Message</label>
            <textarea
              rows={3}
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' }}>Mock Memories (one per line)</label>
            <textarea
              rows={2}
              value={mockMemories}
              onChange={(e) => setMockMemories(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.8125rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' }}>Temperature: {temperature}</label>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.3rem' }}>Max Output Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>
          </div>

          <button
            onClick={handleRunPlayground}
            disabled={loading}
            style={{
              padding: '0.6rem 1rem',
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Running Playground...' : 'Run Playground Sandbox'}
          </button>
        </div>

        {/* Right: Results & Production Replay */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Playground Output */}
          {playgroundResult && (
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Playground Output</h3>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>{playgroundResult.latencyMs} ms</span>
              </div>
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                {playgroundResult.outputContent}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem' }}>
                <div>Tokens: {playgroundResult.totalTokens} (In: {playgroundResult.promptTokens} / Out: {playgroundResult.completionTokens})</div>
                <div>Est Cost: ${playgroundResult.estimatedCostUsd?.toFixed(6) || '0.000000'}</div>
                <div style={{ gridColumn: 'span 2' }}>Context Hash: {playgroundResult.contextHash}</div>
              </div>
            </div>
          )}

          {/* Production Replay Box */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Production Generation Replay</h3>
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', margin: '0 0 0.75rem 0' }}>
              Input a production request ID or trace ID to reproduce generation settings and compare outputs.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={traceId}
                onChange={(e) => setTraceId(e.target.value)}
                placeholder="Enter traceId or requestId..."
                style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.8125rem' }}
              />
              <button
                onClick={handleRunReplay}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}
              >
                Replay
              </button>
            </div>

            {replayResult && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.75rem', background: '#f9fafb', fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 600, color: '#166534' }}>Replay Status: {replayResult.matchAssessment.divergenceNotes}</div>
                <div style={{ marginTop: '0.5rem', color: '#374151' }}>
                  <strong>Replay Output:</strong> {replayResult.replayOutput}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Latency: {replayResult.replayLatencyMs} ms | Original Latency: {replayResult.originalMetadata.latencyMs} ms
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
