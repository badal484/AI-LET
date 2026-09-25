'use client';

import React, { useEffect, useState } from 'react';
import { adminAIApi } from '../../../services/adminAIApi';
import { AIPromptData, AIPromptVersionData } from '@ai-companion/types';
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
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link href="/ai" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            ← Back to AI Hub
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0 0 0', color: '#111827' }}>Prompt Registry & Versioning</h1>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '0.75rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '1rem' }}>
          {statusMessage}
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading prompt registry...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
          {/* Prompts Sidebar */}
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Registered Prompts</h2>
            {prompts.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPrompt(p)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: selectedPrompt?.id === p.id ? '#3b82f6' : '#e5e7eb',
                  background: selectedPrompt?.id === p.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>slug: {p.slug}</div>
                <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.2rem' }}>{p.category}</div>
              </button>
            ))}
          </div>

          {/* Prompt Details & Version List */}
          {selectedPrompt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{selectedPrompt.name}</h2>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 1rem 0' }}>{selectedPrompt.description}</p>

                {/* Create New Version */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Create New Prompt Version</h3>
                  <textarea
                    rows={4}
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    placeholder="Enter template text with {{variables}}..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: '0.8125rem' }}
                  />
                  <button
                    onClick={handleCreateVersion}
                    style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    Save Draft Version
                  </button>
                </div>
              </div>

              {/* Version History */}
              <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Version History & Immutability</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(selectedPrompt.versions || []).map((v) => (
                    <div key={v.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', background: '#f9fafb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Version {v.versionNumber}</span>
                          <span
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: v.status === 'PUBLISHED' ? '#dcfce7' : v.status === 'DRAFT' ? '#fef3c7' : '#f3f4f6',
                              color: v.status === 'PUBLISHED' ? '#166534' : v.status === 'DRAFT' ? '#92400e' : '#6b7280',
                            }}
                          >
                            {v.status}
                          </span>
                        </div>
                        {v.status !== 'PUBLISHED' && (
                          <button
                            onClick={() => handlePublishVersion(v)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Publish
                          </button>
                        )}
                      </div>
                      <pre style={{ background: '#fff', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '0.8125rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                        {v.templateContent}
                      </pre>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                        <span>Hash: {v.hash.substring(0, 12)}...</span>
                        <span>Est. Tokens: {v.tokenEstimate}</span>
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
  );
}
