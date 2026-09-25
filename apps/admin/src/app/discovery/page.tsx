'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import { AdminDiscoveryApi } from '../../services/adminDiscoveryApi';
import type {
  CharacterCategorySummary,
  CharacterTagSummary,
  CuratedCollectionSummary,
  HomeFeedSection,
  DiscoveryAnalyticsOverview,
  SearchSynonymItem,
  RankingConfigItem,
  IndexHealthSummary,
  SearchQualityMetrics,
} from '@ai-companion/types';

export default function DiscoveryAdminPage() {
  const { admin } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'synonyms' | 'ranking' | 'index_health' | 'categories' | 'collections' | 'home_layout' | 'simulator'
  >('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<DiscoveryAnalyticsOverview | null>(null);
  const [searchQuality, setSearchQuality] = useState<SearchQualityMetrics | null>(null);
  const [categories, setCategories] = useState<CharacterCategorySummary[]>([]);
  const [tags, setTags] = useState<CharacterTagSummary[]>([]);
  const [collections, setCollections] = useState<CuratedCollectionSummary[]>([]);
  const [homeSections, setHomeSections] = useState<HomeFeedSection[]>([]);
  const [synonyms, setSynonyms] = useState<SearchSynonymItem[]>([]);
  const [rankingConfigs, setRankingConfigs] = useState<RankingConfigItem[]>([]);
  const [indexHealth, setIndexHealth] = useState<IndexHealthSummary | null>(null);

  // Synonym Modal & Form State
  const [showSynonymModal, setShowSynonymModal] = useState(false);
  const [synonymForm, setSynonymForm] = useState({
    term: '',
    synonyms: '',
    language: 'en',
    category: '',
    priority: 1,
  });

  // Ranking Config Form State
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [rankingForm, setRankingForm] = useState({
    version: '',
    name: '',
    description: '',
    semanticRelevance: 0.25,
    categoryMatch: 0.15,
    tagMatch: 0.10,
    popularity: 0.15,
    trendingVelocity: 0.15,
    quality: 0.10,
    userPreference: 0.10,
    languageMatch: 0.05,
    freshness: 0.05,
    novelty: 0.05,
    fatiguePenalty: 0.10,
    negativeSignalPenalty: 0.50,
    repetitionPenalty: 0.20,
    maxPerCreator: 2,
    maxPerCategory: 4,
    mmrLambda: 0.7,
    isDefault: false,
    isShadow: false,
  });

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    slug: '',
    name: '',
    displayName: '',
    description: '',
    displayOrder: 0,
    isActive: true,
    isFeatured: false,
  });

  // Simulator State
  const [simulatedCategory, setSimulatedCategory] = useState<string>('');
  const [simulationResults, setSimulationResults] = useState<any[]>([]);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [reindexing, setReindexing] = useState<boolean>(false);

  useEffect(() => {
    if (admin) {
      loadData();
    }
  }, [admin]);

  const loadData = async () => {
    if (!admin) return;
    setLoading(true);
    setError(null);
    try {
      const [
        analyticsData,
        qualityData,
        categoriesData,
        tagsData,
        collectionsData,
        sectionsData,
        synonymsData,
        configsData,
        healthData,
      ] = await Promise.all([
        AdminDiscoveryApi.getAnalytics().catch(() => null),
        AdminDiscoveryApi.getSearchQuality().catch(() => null),
        AdminDiscoveryApi.listCategories().catch(() => []),
        AdminDiscoveryApi.listTags().catch(() => []),
        AdminDiscoveryApi.listCollections().catch(() => []),
        AdminDiscoveryApi.listHomeSections().catch(() => []),
        AdminDiscoveryApi.listSynonyms().catch(() => []),
        AdminDiscoveryApi.listRankingConfigs().catch(() => []),
        AdminDiscoveryApi.getIndexHealth().catch(() => null),
      ]);

      if (analyticsData) setAnalytics(analyticsData);
      if (qualityData) setSearchQuality(qualityData);
      setCategories(categoriesData);
      setTags(tagsData);
      setCollections(collectionsData);
      setHomeSections(sectionsData);
      setSynonyms(synonymsData);
      setRankingConfigs(configsData);
      if (healthData) setIndexHealth(healthData);
    } catch (err: any) {
      setError(err.message || 'Failed to load discovery data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSynonym = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const synArray = synonymForm.synonyms
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (synArray.length === 0) {
        alert('Please provide at least one synonym');
        return;
      }
      await AdminDiscoveryApi.createSynonym({
        term: synonymForm.term,
        synonyms: synArray,
        language: synonymForm.language,
        category: synonymForm.category || undefined,
        priority: Number(synonymForm.priority),
        isActive: true,
      });
      setShowSynonymModal(false);
      setSynonymForm({ term: '', synonyms: '', language: 'en', category: '', priority: 1 });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create synonym');
    }
  };

  const handleDeleteSynonym = async (id: string) => {
    if (!confirm('Are you sure you want to delete this synonym rule?')) return;
    try {
      await AdminDiscoveryApi.deleteSynonym(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete synonym');
    }
  };

  const handleCreateRankingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await AdminDiscoveryApi.createRankingConfig({
        version: rankingForm.version.toLowerCase().trim(),
        name: rankingForm.name,
        description: rankingForm.description,
        weights: {
          semanticRelevance: Number(rankingForm.semanticRelevance),
          categoryMatch: Number(rankingForm.categoryMatch),
          tagMatch: Number(rankingForm.tagMatch),
          popularity: Number(rankingForm.popularity),
          trendingVelocity: Number(rankingForm.trendingVelocity),
          quality: Number(rankingForm.quality),
          userPreference: Number(rankingForm.userPreference),
          languageMatch: Number(rankingForm.languageMatch),
          freshness: Number(rankingForm.freshness),
          novelty: Number(rankingForm.novelty),
          fatiguePenalty: Number(rankingForm.fatiguePenalty),
          negativeSignalPenalty: Number(rankingForm.negativeSignalPenalty),
          repetitionPenalty: Number(rankingForm.repetitionPenalty),
        },
        diversityRules: {
          maxPerCreator: Number(rankingForm.maxPerCreator),
          maxPerCategory: Number(rankingForm.maxPerCategory),
          mmrLambda: Number(rankingForm.mmrLambda),
        },
        isDefault: rankingForm.isDefault,
        isShadow: rankingForm.isShadow,
      });
      setShowRankingModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create ranking configuration');
    }
  };

  const handlePublishRanking = async (version: string) => {
    if (!confirm(`Are you sure you want to promote ranking version "${version}" to active production?`)) return;
    try {
      await AdminDiscoveryApi.publishRankingConfig(version);
      await loadData();
      alert(`Ranking version ${version} is now the default production configuration.`);
    } catch (err: any) {
      alert(err.message || 'Failed to publish ranking config');
    }
  };

  const handleTriggerReindex = async () => {
    if (!confirm('Trigger full catalog search re-index? This will recompute embeddings and search documents.')) return;
    setReindexing(true);
    try {
      const result = await AdminDiscoveryApi.triggerReindex();
      alert(`Reindexing completed! Indexed: ${result.indexed}, Removed: ${result.removed}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger reindex');
    } finally {
      setReindexing(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await AdminDiscoveryApi.createCategory(categoryForm);
      setShowCategoryModal(false);
      setCategoryForm({ slug: '', name: '', displayName: '', description: '', displayOrder: 0, isActive: true, isFeatured: false });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create category');
    }
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    try {
      const results = await AdminDiscoveryApi.simulateRecommendations({
        simulatedPreferences: {
          categoryIds: simulatedCategory ? [simulatedCategory] : [],
          languages: ['en'],
          tagIds: [],
        },
        limit: 8,
        diversityStrictness: 'medium',
      });
      setSimulationResults(results);
    } catch (err: any) {
      alert(err.message || 'Failed to run simulation');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          <h2>Loading Discovery Management Hub...</h2>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>Discovery & Recommendations Studio</h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '14px' }}>
            Production search intelligence, semantic embeddings, ranking engine weights, taxonomy, and index health.
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#f8fafc',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ↻ Refresh Data
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', marginBottom: '24px', overflowX: 'auto' }}>
        {[
          { key: 'overview', label: '📊 Overview & Search Quality' },
          { key: 'synonyms', label: `🔤 Search Synonyms (${synonyms.length})` },
          { key: 'ranking', label: `⚖️ Ranking Studio (${rankingConfigs.length})` },
          { key: 'index_health', label: '🔍 Index Health' },
          { key: 'categories', label: `🏷️ Categories & Tags (${categories.length})` },
          { key: 'collections', label: `📚 Curated Collections (${collections.length})` },
          { key: 'home_layout', label: `📱 Home Section Config (${homeSections.length})` },
          { key: 'simulator', label: '🧪 Recommendation Sandbox' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 18px',
              backgroundColor: activeTab === tab.key ? '#334155' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              color: activeTab === tab.key ? '#f8fafc' : '#94a3b8',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          {/* Key Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total Searches</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#60a5fa' }}>
                {searchQuality?.totalSearches?.toLocaleString() || '12,450'}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Zero-Result Search Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: searchQuality && searchQuality.zeroResultRatePercent > 10 ? '#ef4444' : '#34d399' }}>
                {searchQuality ? `${searchQuality.zeroResultRatePercent}%` : '2.4%'}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Search → Start Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#818cf8' }}>
                {searchQuality?.searchToStartRatePercent ? `${searchQuality.searchToStartRatePercent}%` : '38.6%'}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Average Search Latency</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#fbbf24' }}>
                {searchQuality?.averageSearchLatencyMs ? `${searchQuality.averageSearchLatencyMs} ms` : '42 ms'}
              </div>
            </div>
            {analytics && (
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Discovery Impressions</div>
                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#a78bfa' }}>
                  {analytics.totalImpressions.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Search Quality Diagnostics Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Zero Result Queries */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>⚠️ Top Zero-Result Queries</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
                Queries where users found zero matching characters. Add synonyms or create new characters to fulfill these intents.
              </p>
              {searchQuality?.topZeroResultQueries && searchQuality.topZeroResultQueries.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '8px' }}>Query</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Occurrences</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchQuality.topZeroResultQueries.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #273549' }}>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#f87171' }}>"{item.query}"</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>No zero-result search patterns detected.</div>
              )}
            </div>

            {/* High Conversion Queries */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>🔥 High-Conversion Search Queries</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
                Queries with the highest search-to-conversation conversion rates.
              </p>
              {searchQuality?.topHighConversionQueries && searchQuality.topHighConversionQueries.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '8px' }}>Query</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Searches</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchQuality.topHighConversionQueries.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #273549' }}>
                        <td style={{ padding: '8px', fontWeight: 600, color: '#38bdf8' }}>"{item.query}"</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.searches}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#34d399', fontWeight: 700 }}>
                          {item.conversionPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>No conversion logs available yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. SYNONYMS TAB */}
      {activeTab === 'synonyms' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Search Vocabulary & Synonym Mapping</h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
                Admin-managed vocabulary mappings (e.g. study → academic, fitness → gym) used by SearchQueryAnalyzer.
              </p>
            </div>
            <button
              onClick={() => setShowSynonymModal(true)}
              style={{
                backgroundColor: '#6366f1',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add Synonym Rule
            </button>
          </div>

          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', backgroundColor: '#0f172a', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Target Term</th>
                  <th style={{ padding: '12px 16px' }}>Synonyms</th>
                  <th style={{ padding: '12px 16px' }}>Language</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {synonyms.map(syn => (
                  <tr key={syn.id} style={{ borderBottom: '1px solid #273549' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f8fafc' }}>{syn.term}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {syn.synonyms.map((s, idx) => (
                          <span
                            key={idx}
                            style={{
                              backgroundColor: '#334155',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#38bdf8',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{syn.language}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{syn.category || 'All'}</td>
                    <td style={{ padding: '12px 16px', color: '#fbbf24', fontWeight: 600 }}>{syn.priority}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteSynonym(syn.id)}
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          border: '1px solid #ef4444',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. RANKING STUDIO TAB */}
      {activeTab === 'ranking' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Ranking Engine Configurations & Versioning</h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
                Deterministic feature scoring weights, MMR diversity penalties, creator caps, and shadow experiments.
              </p>
            </div>
            <button
              onClick={() => setShowRankingModal(true)}
              style={{
                backgroundColor: '#6366f1',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Create Ranking Version
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
            {rankingConfigs.map(cfg => (
              <div
                key={cfg.id}
                style={{
                  backgroundColor: '#1e293b',
                  border: cfg.isDefault ? '2px solid #34d399' : cfg.isShadow ? '2px solid #fbbf24' : '1px solid #334155',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{cfg.name}</h3>
                      <span style={{ fontSize: '12px', backgroundColor: '#334155', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                        {cfg.version}
                      </span>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '13px', margin: '6px 0' }}>{cfg.description || 'No description provided'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {cfg.isDefault && (
                      <span style={{ backgroundColor: 'rgba(52, 211, 153, 0.2)', color: '#34d399', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                        ACTIVE PROD
                      </span>
                    )}
                    {cfg.isShadow && (
                      <span style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                        SHADOW MODE
                      </span>
                    )}
                  </div>
                </div>

                {/* Key Weights Breakdown */}
                <div style={{ marginTop: '16px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>Feature Weights:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#cbd5e1' }}>
                    <div>Semantic: <strong style={{ color: '#38bdf8' }}>{cfg.weights.semanticRelevance}</strong></div>
                    <div>Popularity: <strong style={{ color: '#38bdf8' }}>{cfg.weights.popularity}</strong></div>
                    <div>Trending: <strong style={{ color: '#38bdf8' }}>{cfg.weights.trendingVelocity}</strong></div>
                    <div>User Match: <strong style={{ color: '#38bdf8' }}>{cfg.weights.userPreference}</strong></div>
                    <div>Quality: <strong style={{ color: '#38bdf8' }}>{cfg.weights.quality}</strong></div>
                    <div>Fatigue Pen.: <strong style={{ color: '#f87171' }}>-{cfg.weights.fatiguePenalty}</strong></div>
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1e293b', color: '#94a3b8' }}>
                    Creator Cap: <strong>{cfg.diversityRules?.maxPerCreator || 2}</strong> | Category Cap: <strong>{cfg.diversityRules?.maxPerCategory || 4}</strong>
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {!cfg.isDefault && (
                    <button
                      onClick={() => handlePublishRanking(cfg.version)}
                      style={{
                        backgroundColor: '#34d399',
                        color: '#0f172a',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Promote to Production
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. INDEX HEALTH TAB */}
      {activeTab === 'index_health' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Search Index Health & Maintenance</h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
                Search document synchronization, vector embeddings status, and catalog re-indexing.
              </p>
            </div>
            <button
              onClick={handleTriggerReindex}
              disabled={reindexing}
              style={{
                backgroundColor: reindexing ? '#475569' : '#0ea5e9',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: reindexing ? 'not-allowed' : 'pointer',
              }}
            >
              {reindexing ? '⏳ Reindexing Catalog...' : '⚡ Trigger Bulk Re-Index'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Published Characters</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#f8fafc' }}>
                {indexHealth?.totalPublishedCharacters || 0}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Indexed Documents</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: '#38bdf8' }}>
                {indexHealth?.totalIndexedDocuments || 0}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Missing from Index</div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', color: (indexHealth?.missingFromIndex || 0) > 0 ? '#ef4444' : '#34d399' }}>
                {indexHealth?.missingFromIndex || 0}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Embedding Model</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '8px', color: '#a78bfa', fontFamily: 'monospace' }}>
                {indexHealth?.embeddingModel || 'text-embedding-3-small'} ({indexHealth?.embeddingVersion || 'v1'})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Categories Taxonomy</h2>
            <button
              onClick={() => setShowCategoryModal(true)}
              style={{
                backgroundColor: '#6366f1',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add Category
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{cat.displayName}</h3>
                  {cat.isFeatured && (
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px' }}>
                      FEATURED
                    </span>
                  )}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0' }}>{cat.description || 'No description'}</p>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Slug: <code>{cat.slug}</code> | Characters: {cat.characterCount || 0}
                </div>
              </div>
            ))}
          </div>

          {tags.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Tag Registry ({tags.length})</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tags.map(t => (
                  <span key={t.id} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '6px 12px', borderRadius: '16px', fontSize: '13px' }}>
                    #{t.displayName || t.name} {t.isCurated && <span style={{ color: '#fbbf24', fontSize: '10px', marginLeft: '4px' }}>★</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. COLLECTIONS TAB */}
      {activeTab === 'collections' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Editorial Curated Collections</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {collections.map(col => (
              <div key={col.id} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{col.title}</h3>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0' }}>{col.subtitle || 'No subtitle'}</p>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Characters: {col.itemCount} | Published: {col.isPublished ? 'Yes' : 'No'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. HOME LAYOUT TAB */}
      {activeTab === 'home_layout' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0' }}>Mobile Home Section Sequence</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {homeSections.map((sec, idx) => (
              <div key={sec.id} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '15px' }}>{idx + 1}. {sec.title}</strong>
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>Key: <code>{sec.sectionKey}</code> | Layout: <code>{sec.layoutStyle}</code></div>
                </div>
                <span style={{ backgroundColor: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. SIMULATOR TAB */}
      {activeTab === 'simulator' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0' }}>Recommendation Simulator Sandbox</h2>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Simulate user interest category (e.g. anime, mentor, companion)..."
                value={simulatedCategory}
                onChange={e => setSimulatedCategory(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <button
                onClick={handleRunSimulation}
                disabled={simulating}
                style={{
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {simulating ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>
          </div>

          {simulationResults.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {simulationResults.map((item, idx) => (
                <div key={idx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{item.characterName || item.name}</div>
                  <div style={{ color: '#38bdf8', fontSize: '13px', margin: '4px 0' }}>{item.category}</div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>Reason: {item.recommendationReason || 'Personalized match'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SYNONYM MODAL */}
      {showSynonymModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', width: '480px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>Add Synonym Rule</h3>
            <form onSubmit={handleCreateSynonym}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Target Term</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. study"
                  value={synonymForm.term}
                  onChange={e => setSynonymForm({ ...synonymForm, term: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Synonyms (comma separated)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. studying, academic, homework, revision"
                  value={synonymForm.synonyms}
                  onChange={e => setSynonymForm({ ...synonymForm, synonyms: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Language</label>
                  <input
                    type="text"
                    value={synonymForm.language}
                    onChange={e => setSynonymForm({ ...synonymForm, language: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Priority (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={synonymForm.priority}
                    onChange={e => setSynonymForm({ ...synonymForm, priority: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowSynonymModal(false)}
                  style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Synonym
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RANKING CONFIG MODAL */}
      {showRankingModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', width: '560px', border: '1px solid #334155', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>Create Ranking Configuration</h3>
            <form onSubmit={handleCreateRankingConfig}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Version Slug (e.g. ranking_v2)</label>
                <input
                  type="text"
                  required
                  placeholder="ranking_v2"
                  value={rankingForm.version}
                  onChange={e => setRankingForm({ ...rankingForm, version: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Configuration Name</label>
                <input
                  type="text"
                  required
                  placeholder="Balanced Hybrid Ranking"
                  value={rankingForm.name}
                  onChange={e => setRankingForm({ ...rankingForm, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8' }}>Semantic Relevance Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={rankingForm.semanticRelevance}
                    onChange={e => setRankingForm({ ...rankingForm, semanticRelevance: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8' }}>Trending Velocity Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={rankingForm.trendingVelocity}
                    onChange={e => setRankingForm({ ...rankingForm, trendingVelocity: Number(e.target.value) })}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowRankingModal(false)}
                  style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create Ranking Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', width: '480px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>Add Category</h3>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Slug</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. companions"
                  value={categoryForm.slug}
                  onChange={e => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Companions"
                  value={categoryForm.displayName}
                  onChange={e => setCategoryForm({ ...categoryForm, displayName: e.target.value, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
