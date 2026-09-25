'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard, useAdminAuth } from '../../../components/AuthGuard';
import { adminAIApi } from '../../../services/adminAIApi';
import {
  BookOpen,
  Search,
  Globe,
  CheckCircle,
  FileText,
  FolderPlus,
  Upload,
  ArrowLeft,
  Sparkles,
  Layers,
  ShieldCheck,
} from 'lucide-react';

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
  const { admin } = useAdminAuth();
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

  const loadData = async () => {
    if (!admin) return;
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

  useEffect(() => {
    if (admin) {
      loadData();
    }
  }, [admin, activeTab]);

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
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Link href="/characters" style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '13px' }}>
                <ArrowLeft size={14} /> Back to Studio
              </Link>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <BookOpen size={24} color="#A855F7" />
              Domain Knowledge & RAG Brain
            </h1>
            <p style={{ fontSize: '14px', color: '#94A3B8', marginTop: '4px' }}>
              Upload PDFs, guides, and domain lore with vector embeddings & semantic retrieval
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={14} /> pgvector RAG Active
            </span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid #EF4444', borderRadius: '8px', color: '#F87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Tab Pills */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1E293B', paddingBottom: '12px', overflowX: 'auto' }}>
          {[
            { key: 'documents', label: 'Indexed Documents', icon: FileText },
            { key: 'collections', label: 'Domain Collections', icon: Layers },
            { key: 'search', label: 'Hybrid Search Tester', icon: Search },
            { key: 'research', label: 'Web Research Console', icon: Globe },
            { key: 'groundedness', label: 'Citation Validator', icon: CheckCircle },
          ].map(tab => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: isCurrent ? '1px solid #A855F7' : '1px solid #1E293B',
                  backgroundColor: isCurrent ? 'rgba(168, 85, 247, 0.15)' : '#0F131D',
                  color: isCurrent ? '#FFFFFF' : '#94A3B8',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={15} color={isCurrent ? '#C084FC' : '#64748B'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Documents */}
        {activeTab === 'documents' && (
          <div style={{ backgroundColor: '#0F131D', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: 0 }}>
                  Indexed Knowledge Documents
                </h2>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
                  Parsed into semantic chunk vectors stored in pgvector.
                </p>
              </div>

              <button
                onClick={() => alert('To upload documents, use Character Studio -> Knowledge tab or drag files here.')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#9333EA',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <Upload size={14} />
                <span>+ Upload Document</span>
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Loading documents...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E293B', color: '#64748B' }}>
                      <th style={{ padding: '12px 14px' }}>Document Title</th>
                      <th style={{ padding: '12px 14px' }}>MIME Type</th>
                      <th style={{ padding: '12px 14px' }}>Chunks</th>
                      <th style={{ padding: '12px 14px' }}>Est. Tokens</th>
                      <th style={{ padding: '12px 14px' }}>Visibility</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length > 0 ? (
                      documents.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid #161B26' }}>
                          <td style={{ padding: '14px', fontWeight: '600', color: '#FFFFFF' }}>{d.title}</td>
                          <td style={{ padding: '14px', fontFamily: 'monospace', color: '#94A3B8' }}>{d.mimeType}</td>
                          <td style={{ padding: '14px', color: '#CBD5E1' }}>{d.totalChunks}</td>
                          <td style={{ padding: '14px', color: '#CBD5E1' }}>{d.totalTokens.toLocaleString()}</td>
                          <td style={{ padding: '14px', color: '#94A3B8' }}>{d.visibility}</td>
                          <td style={{ padding: '14px' }}>
                            <span className="badge badge-success">{d.status}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                          <BookOpen size={36} color="#334155" style={{ margin: '0 auto 12px' }} />
                          <p style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '600', margin: '0 0 4px 0' }}>
                            No Domain Documents Uploaded Yet
                          </p>
                          <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                            Upload PDF manuals, character lore, or expert guidelines to ground your AI companions.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Collections */}
        {activeTab === 'collections' && (
          <div style={{ backgroundColor: '#0F131D', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>Knowledge Collections</h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 20px 0' }}>
              Scoped knowledge binders linked to specific AI personas (e.g. Astrology Lore, Fitness Guides).
            </p>

            {collections.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                <p style={{ fontSize: '14px', color: '#94A3B8' }}>No custom collections created yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {collections.map(col => (
                  <div key={col.id} style={{ border: '1px solid #1E293B', borderRadius: '10px', padding: '16px', backgroundColor: '#161B26' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#A855F7' }}>{col.visibility}</span>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>{col.documentCount} docs</span>
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF', margin: '10px 0 4px 0' }}>{col.name}</h3>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Created {new Date(col.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Hybrid Search Debugger */}
        {activeTab === 'search' && (
          <div style={{ backgroundColor: '#0F131D', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
              Hybrid Search Tester & Rank Fusion
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 20px 0' }}>
              Test vector semantic embeddings combined with full-text keyword matching in real time.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Enter query to test RAG retrieval..."
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  backgroundColor: '#161B26',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#9333EA',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {searchLoading ? 'Searching...' : 'Run Search'}
              </button>
            </div>

            {searchResults && (
              <pre
                style={{
                  backgroundColor: '#07090E',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #1E293B',
                  color: '#A855F7',
                  fontSize: '12px',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(searchResults, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Tab 4: Web Research Console */}
        {activeTab === 'research' && (
          <div style={{ backgroundColor: '#0F131D', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
              Autonomous Web Research Console
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 20px 0' }}>
              Test real-time web search and citation generation for companion intelligence.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                value={researchQuery}
                onChange={e => setResearchQuery(e.target.value)}
                placeholder="Enter research topic..."
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  backgroundColor: '#161B26',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleResearch}
                disabled={researchLoading}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {researchLoading ? 'Researching...' : 'Run Research'}
              </button>
            </div>

            {researchResult && (
              <pre
                style={{
                  backgroundColor: '#07090E',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #1E293B',
                  color: '#60A5FA',
                  fontSize: '12px',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(researchResult, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Tab 5: Groundedness */}
        {activeTab === 'groundedness' && (
          <div style={{ backgroundColor: '#0F131D', border: '1px solid #1E293B', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
              Grounded Citation Validator
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 20px 0' }}>
              Verifies that companion responses cite verbatim source material without hallucinations.
            </p>
            <div style={{ padding: '20px', backgroundColor: '#161B26', borderRadius: '10px', border: '1px solid #1E293B' }}>
              <p style={{ fontSize: '14px', color: '#34D399', fontWeight: '600', margin: '0 0 4px 0' }}>
                ✓ Hallucination Guardrail: Active
              </p>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
                Responses are cross-checked against the ingested vector knowledge chunks with a minimum cosine similarity threshold of 0.82.
              </p>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
