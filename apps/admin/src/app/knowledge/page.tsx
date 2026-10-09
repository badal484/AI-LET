'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard } from '../../components/AuthGuard';
import { adminAIApi } from '../../services/adminAIApi';
import {
  BookOpen,
  Search,
  Database,
  Globe,
  Plus,
  RefreshCw,
  FileText,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<'documents' | 'collections' | 'search' | 'research'>('documents');
  const [documents, setDocuments] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Research State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const [researchQuery, setResearchQuery] = useState('');
  const [researchResults, setResearchResults] = useState<any>(null);
  const [researching, setResearching] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docs, cols] = await Promise.all([
        adminAIApi.listKnowledgeDocuments().catch(() => []),
        adminAIApi.listKnowledgeCollections().catch(() => []),
      ]);
      setDocuments(docs || []);
      setCollections(cols || []);
    } catch (err) {
      console.error('Failed to load knowledge base data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await adminAIApi.testHybridSearch({ query: searchQuery, maxCandidates: 10 });
      setSearchResults(res);
    } catch (err: any) {
      alert(`Hybrid search failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleTestResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchQuery.trim()) return;
    setResearching(true);
    try {
      const res = await adminAIApi.testWebResearch({ query: researchQuery, maxSources: 5 });
      setResearchResults(res);
    } catch (err: any) {
      alert(`Web research test failed: ${err.message}`);
    } finally {
      setResearching(false);
    }
  };

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={20} color="#C084FC" />
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                RAG Knowledge & Lore Base
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
              Manage companion backstory lore, vector embeddings, hybrid search benchmarks, and web research sources.
            </p>
          </div>

          <button onClick={loadData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Knowledge Base
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
          {[
            { id: 'documents', label: 'Lore Documents', icon: FileText, count: documents.length },
            { id: 'collections', label: 'Vector Collections', icon: Layers, count: collections.length },
            { id: 'search', label: 'Hybrid Search Sandbox', icon: Search },
            { id: 'research', label: 'Web Research Lab', icon: Globe },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  backgroundColor: isActive ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#94A3B8',
                  border: isActive ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} color={isActive ? '#C084FC' : '#64748B'} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#CBD5E1' }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'documents' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC' }}>Lore & Knowledge Documents</h3>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>{documents.length} Total Registered Documents</span>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Loading lore documents...</div>
            ) : documents.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <BookOpen size={32} color="#64748B" style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '14px', color: '#94A3B8' }}>No knowledge documents registered yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {documents.map((doc: any, i: number) => (
                  <div key={doc.id || i} className="card" style={{ backgroundColor: '#131822', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <FileText size={18} color="#A855F7" />
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>{doc.title || doc.name || `Document #${doc.id?.slice(0, 6)}`}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '12px', lineHeight: 1.4 }}>
                      {doc.description || doc.contentSnippet || 'Companion background lore context document.'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748B' }}>
                      <span>Chunks: {doc.chunkCount || 12}</span>
                      <span className="badge badge-purple">{doc.status || 'ACTIVE'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC' }}>Vector Collections & Memory Spaces</h3>
            {collections.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                <Layers size={32} color="#64748B" style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '14px', color: '#94A3B8' }}>No vector collections configured.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {collections.map((col: any, i: number) => (
                  <div key={col.id || i} className="card" style={{ backgroundColor: '#131822', padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>{col.name}</h4>
                    <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>{col.description || 'Vector embedding collection'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC' }}>Hybrid Vector & Keyword Search Sandbox</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                Test similarity vector lookup combined with keyword reranking on live lore documents.
              </p>
            </div>

            <form onSubmit={handleTestSearch} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter query (e.g. 'What is Riya favorite cafe in Delhi?')"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" disabled={searching}>
                {searching ? 'Searching...' : 'Run Hybrid Search'}
              </button>
            </form>

            {searchResults && (
              <div style={{ backgroundColor: '#090B10', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#A855F7', marginBottom: '12px' }}>
                  Search Results ({searchResults.candidates?.length || 0} Chunks Found)
                </h4>
                <pre style={{ fontSize: '12px', color: '#CBD5E1', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(searchResults, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'research' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC' }}>Web Research & Real-Time Context Fetcher</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                Simulate real-time external web source retrieval used by companions for up-to-date topic conversations.
              </p>
            </div>

            <form onSubmit={handleTestResearch} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter topic query (e.g. 'Latest developments in AI companions 2026')"
                value={researchQuery}
                onChange={e => setResearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" disabled={researching}>
                {researching ? 'Researching...' : 'Fetch Web Sources'}
              </button>
            </form>

            {researchResults && (
              <div style={{ backgroundColor: '#090B10', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#06B6D4', marginBottom: '12px' }}>
                  Retrieved Research Sources
                </h4>
                <pre style={{ fontSize: '12px', color: '#CBD5E1', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(researchResults, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
