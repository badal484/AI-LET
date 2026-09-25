'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIPromptData, AIPromptVersionData } from '@ai-companion/types';
import { AuthGuard } from '../../../components/AuthGuard';
import { FileText, ArrowLeft, RefreshCw, Plus, CheckCircle2, History } from 'lucide-react';
import Link from 'next/link';

export default function PromptRegistryPage() {
  const [prompts, setPrompts] = useState<AIPromptData[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPromptData | null>(null);
  const [newTemplate, setNewTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await adminAIApi.listPrompts();
      setPrompts(data);
      if (data.length > 0 && !selectedPrompt) {
        setSelectedPrompt(data[0]);
      } else if (selectedPrompt) {
        const updated = data.find((p) => p.id === selectedPrompt.id);
        if (updated) setSelectedPrompt(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load prompt registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateVersion = async () => {
    if (!selectedPrompt || !newTemplate) return;
    try {
      await adminAIApi.createPromptVersion(selectedPrompt.id, {
        templateContent: newTemplate,
      });
      setStatusMessage('Draft prompt version created successfully!');
      setNewTemplate('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePublishVersion = async (version: AIPromptVersionData) => {
    try {
      await adminAIApi.publishPromptVersion(version.id);
      setStatusMessage(`Published version V${version.versionNumber}!`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <AuthGuard>
      <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
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
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText size={28} style={{ color: 'var(--accent-primary)' }} />
              Prompt Registry & Immutable Versioning
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Parameterized system prompts, hash verification, version locking, and hot-swappable production templates.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {statusMessage && (
          <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
            {statusMessage}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading prompt registry...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
            {/* Prompts Sidebar */}
            <div className="admin-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Registered Prompts</h2>
              {prompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPrompt(p)}
                  style={{
                    textAlign: 'left',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: selectedPrompt?.id === p.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    background: selectedPrompt?.id === p.id ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-elevated)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>slug: {p.slug}</div>
                  <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: 600 }}>{p.category}</div>
                </button>
              ))}
            </div>

            {/* Prompt Details & Version List */}
            {selectedPrompt && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="admin-card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{selectedPrompt.name}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 16px 0' }}>{selectedPrompt.description}</p>

                  {/* Create New Version */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Create New Prompt Version</h3>
                    <textarea
                      rows={4}
                      value={newTemplate}
                      onChange={(e) => setNewTemplate(e.target.value)}
                      placeholder="Enter template text with {{variables}}..."
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleCreateVersion}
                      style={{
                        marginTop: '12px',
                        padding: '10px 20px',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={16} /> Save Draft Version
                    </button>
                  </div>
                </div>

                {/* Version History */}
                <div className="admin-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} style={{ color: 'var(--accent-primary)' }} /> Version History & Immutability
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(selectedPrompt.versions || []).map((v) => (
                      <div key={v.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', background: 'var(--surface-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>Version {v.versionNumber}</span>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: v.status === 'PUBLISHED' ? 'rgba(16, 185, 129, 0.15)' : v.status === 'DRAFT' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                                color: v.status === 'PUBLISHED' ? '#10b981' : v.status === 'DRAFT' ? '#eab308' : 'var(--text-muted)',
                              }}
                            >
                              {v.status}
                            </span>
                          </div>
                          {v.status !== 'PUBLISHED' && (
                            <button
                              onClick={() => handlePublishVersion(v)}
                              style={{ padding: '6px 14px', fontSize: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Publish to Production
                            </button>
                          )}
                        </div>
                        <pre style={{ background: '#090d16', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '13px', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-primary)' }}>
                          {v.templateContent}
                        </pre>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                          <span>Hash: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{v.hash.substring(0, 12)}...</strong></span>
                          <span>Est. Tokens: <strong style={{ color: 'var(--text-secondary)' }}>{v.tokenEstimate}</strong></span>
                          <span>Created: {new Date(v.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
