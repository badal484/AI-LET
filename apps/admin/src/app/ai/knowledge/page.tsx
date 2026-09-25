'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminAIApi } from '../../../services/adminAIApi';

interface DocItem {
  id: string;
  title: string;
  mimeType: string;
  totalChunks: number;
  totalTokens: number;
  status: string;
  visibility: string;
  createdAt: string;
}

interface ColItem {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  documentCount: number;
  createdAt: string;
}

export default function KnowledgeStudioPage() {
  const [activeTab, setActiveTab] = useState<'documents' | 'collections' | 'search' | 'research' | 'groundedness'>('documents');
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [collections, setCollections] = useState<ColItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search Debugger
  const [searchQuery, setSearchQuery] = useState('quantum computing error correction');
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Web Research
  const [researchQuery, setResearchQuery] = useState('Latest Mars rover discoveries 2026');
  const [researchResult, setResearchResult] = useState<any | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'documents') {
        const data = await adminAIApi.listKnowledgeDocuments().catch(() => []);
        setDocuments(data);
      } else if (activeTab === 'collections') {
        const data = await adminAIApi.listKnowledgeCollections().catch(() => []);
        setCollections(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults(null);
    try {
      const res = await adminAIApi.testHybridSearch({
        query: searchQuery.trim(),
        maxCandidates: 5,
      });
      setSearchResults(res);
    } catch (err: any) {
      setError(err.message || 'Hybrid search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResearch = async () => {
    if (!researchQuery.trim()) return;
    setResearchLoading(true);
    setResearchResult(null);
    try {
      const res = await adminAIApi.testWebResearch({
        query: researchQuery.trim(),
        maxSources: 4,
      });
      setResearchResult(res);
    } catch (err: any) {
      setError(err.message || 'Web research failed');
    } finally {
      setResearchLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link href="/ai" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
            ← Back to AI Overview
          </Link>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0.25rem 0 0 0', color: '#111827' }}>
            Production Knowledge & Retrieval Studio
          </h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>
            Phase 26: Hybrid Retrieval (Semantic + Lexical), Document Pipelines, Web Research & Grounded Citations
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        {[
          { key: 'documents', label: 'Document Registry' },
          { key: 'collections', label: 'Knowledge Collections' },
          { key: 'search', label: 'Hybrid Search Debugger' },
          { key: 'research', label: 'Web Research Console' },
          { key: 'groundedness', label: 'Grounded Citation Validator' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9375rem',
              color: activeTab === tab.key ? '#3b82f6' : '#6b7280',
              borderBottom: activeTab === tab.key ? '3px solid #3b82f6' : '3px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Indexed Knowledge Documents</h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                Multi-format documents with structural section preservation and pgvector embeddings.
              </p>
            </div>
            <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>SSRF & Prompt Injection Filters: ACTIVE</span>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading documents...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Title</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>MIME Type</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Chunks</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Est. Tokens</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Visibility</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.length > 0 ? (
                  documents.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{d.title}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{d.mimeType}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{d.totalChunks}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{d.totalTokens.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{d.visibility}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#10b981' }}>{d.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No user or character documents indexed yet. Ingestion pipeline ready.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Collections */}
      {activeTab === 'collections' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Knowledge Collections</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            Personal and collaborative knowledge binders with scoped character accessibility.
          </p>

          {collections.length === 0 && (
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>No knowledge collections yet.</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {collections.map((col) => (
              <div key={col.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem', background: '#f9fafb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>{col.visibility}</span>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{col.documentCount} docs</span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.5rem 0 0.25rem 0' }}>{col.name}</h3>
                <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0 }}>Created {new Date(col.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Hybrid Search Debugger */}
      {activeTab === 'search' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Hybrid Search Tester & Rank Fusion</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            Inspect Reciprocal Rank Fusion (RRF) combining semantic cosine similarity with lexical full-text search.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter search query..."
              style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {searchLoading ? 'Searching...' : 'Run Hybrid Search'}
            </button>
          </div>

          {searchResults && (
            <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Search Candidates & RRF Scoring</h3>
              <pre style={{ margin: 0, padding: '1rem', background: '#111827', color: '#38bdf8', borderRadius: '6px', fontSize: '0.8125rem', overflowX: 'auto' }}>
                {JSON.stringify(searchResults, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Tab: Web Research Console */}
      {activeTab === 'research' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Safe Web Research Console</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem 0' }}>
            Execute multi-step search subqueries, fetch verified external sources with SSRF defense, and synthesize findings.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              placeholder="Enter topic to research..."
              style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
            />
            <button
              onClick={handleResearch}
              disabled={researchLoading}
              style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {researchLoading ? 'Researching...' : 'Start Research'}
            </button>
          </div>

          {researchResult && (
            <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Verified Research Synthesis</h3>
              <pre style={{ margin: 0, padding: '1rem', background: '#111827', color: '#4ade80', borderRadius: '6px', fontSize: '0.8125rem', overflowX: 'auto' }}>
                {JSON.stringify(researchResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Tab: Grounded Citation Validator */}
      {activeTab === 'groundedness' && (
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Grounded Citation Validator</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1rem 0' }}>
            Verifies that all citations ([1], [2]) correspond to real retrieved sources. Any fabricated citations are blocked.
          </p>

          <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '6px', fontSize: '0.875rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Citation Invariants:</div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#374151' }}>
              <li>Every citation must map to an active `document_id`, `chunk_id`, or `web_source_id`.</li>
              <li>Fabricated citations ([99] when only 2 sources exist) are eliminated.</li>
              <li>Insufficient evidence declarations trigger `UNKNOWN` groundedness rather than hallucination.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
