'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import { AdminCharacterApi } from '../../services/adminCharacterApi';
import {
  Bot,
  Plus,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  X,
  Sliders,
  Play,
  Globe,
  Lock,
  Layers,
} from 'lucide-react';

export default function CharactersDirectoryPage() {
  const { admin } = useAdminAuth();
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New character form state
  const [formData, setFormData] = useState({
    name: '',
    internalKey: '',
    slug: '',
    tagline: '',
    shortDescription: '',
    longDescription: '',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    category: 'Astrology & Wellness',
    archetype: 'Companion',
    age: 24,
    gender: 'Female',
    occupation: 'Companion',
    visibility: 'PUBLIC' as const,
  });

  const loadCharacters = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try {
      const res = await AdminCharacterApi.listCharacters({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setCharacters(res.characters || []);
    } catch (err: any) {
      console.error('Failed to load characters:', err);
    } finally {
      setLoading(false);
    }
  }, [admin, search, statusFilter]);

  useEffect(() => {
    if (admin) {
      loadCharacters();
    }
  }, [admin, loadCharacters]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const key = `char_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    setFormData(prev => ({ ...prev, name, slug, internalKey: key }));
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsSubmitting(true);
    try {
      const created = await AdminCharacterApi.createCharacter(formData);
      setIsCreateModalOpen(false);
      window.location.href = `/characters/${created.id}`;
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create character');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  color: '#C084FC',
                }}
              >
                COMPANION ENGINE
              </span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#FFFFFF', margin: '6px 0 2px 0', letterSpacing: '-0.02em' }}>
              AI Characters & Persona Directory
            </h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              Create, configure backstories, train vector memories, tune voices, and publish live companions.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={16} />
            <span>Create Companion</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            backgroundColor: '#0F121C',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: 1,
              minWidth: '260px',
              backgroundColor: '#080A10',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Search size={15} color="#A855F7" />
            <input
              type="text"
              placeholder="Search companions by name, slug, archetype, or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#FFFFFF',
                width: '100%',
                fontSize: '13px',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: '#64748B' }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: '#080A10',
                color: '#CBD5E1',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All Statuses</option>
              <option value="PUBLISHED">Published (Live)</option>
              <option value="DRAFT">Draft</option>
              <option value="REVIEW">In Review</option>
              <option value="UNPUBLISHED">Unpublished</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Characters Grid */}
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#64748B' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(168, 85, 247, 0.2)',
                borderTopColor: '#A855F7',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            <p style={{ fontSize: '13px' }}>Loading characters from engine...</p>
          </div>
        ) : characters.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              backgroundColor: '#0F121C',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <Bot size={40} style={{ color: '#475569', margin: '0 auto 12px', display: 'block' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 6px 0' }}>
              No Characters Found
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 18px 0', maxWidth: '400px', marginInline: 'auto' }}>
              Create your first companion persona to configure memory, proactivity, voices, and launch on mobile.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                padding: '9px 18px',
                background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                color: '#fff',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
              }}
            >
              + Create Character
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '18px',
            }}
          >
            {characters.map(char => (
              <div
                key={char.id}
                style={{
                  backgroundColor: '#0F121C',
                  border: char.status === 'PUBLISHED' ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px -10px rgba(0, 0, 0, 0.6)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = char.status === 'PUBLISHED' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.07)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Header Cover Banner */}
                <div
                  style={{
                    height: '70px',
                    backgroundImage: `url(${char.coverImageUrl || char.avatarUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to bottom, rgba(15, 18, 28, 0.2), rgba(15, 18, 28, 0.95))',
                    }}
                  />

                  {/* Status badge pill top right */}
                  <div style={{ position: 'absolute', top: '10px', right: '12px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        backgroundColor: char.status === 'PUBLISHED' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.85)',
                        color: '#FFFFFF',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {char.status === 'PUBLISHED' ? 'LIVE' : char.status}
                    </span>
                  </div>
                </div>

                {/* Body Content with Overlaid Avatar */}
                <div style={{ padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '-32px', marginBottom: '10px' }}>
                    <img
                      src={char.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                      alt={char.name}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        border: '3px solid #0F121C',
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#94A3B8',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: '600',
                      }}
                    >
                      v{char.currentVersionNumber || 1}
                    </span>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFFFFF', margin: '0 0 2px 0' }}>
                      {char.name}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                      @{char.slug} • {char.category || 'Companion'}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      lineHeight: 1.4,
                      margin: '0 0 16px 0',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1,
                    }}
                  >
                    {char.tagline || char.shortDescription || 'Authentic multi-turn companion persona.'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B' }}>
                      <Globe size={12} color="#10B981" />
                      <span>{char.visibility || 'Public'}</span>
                    </div>

                    <Link
                      href={`/characters/${char.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(168, 85, 247, 0.12)',
                        color: '#C084FC',
                        fontSize: '12px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#A855F7';
                        e.currentTarget.style.color = '#FFFFFF';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.12)';
                        e.currentTarget.style.color = '#C084FC';
                      }}
                    >
                      <span>Open Studio</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Character Modal */}
        {isCreateModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '540px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: '#0F121C',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#FFFFFF', margin: 0 }}>
                    Create New AI Companion
                  </h3>
                  <p style={{ fontSize: '12px', color: '#94A3B8', margin: '3px 0 0 0' }}>
                    Bootstrap identity and baseline version config.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {createError && (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateCharacter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '5px' }}>
                    Companion Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya, Marcus, Aria, Kabir"
                    value={formData.name}
                    onChange={handleNameChange}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '5px' }}>
                      Slug Identifier *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={e => setFormData({ ...formData, slug: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '5px' }}>
                      Category *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '5px' }}>
                    Tagline *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Empathetic Friend & Astrology Muse"
                    value={formData.tagline}
                    onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '5px' }}>
                    Short Summary *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="1-2 sentences capturing personality"
                    value={formData.shortDescription}
                    onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '5px' }}>
                    Backstory / Core Persona Lore *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe character origins, speaking tone, and backstory..."
                    value={formData.longDescription}
                    onChange={e => setFormData({ ...formData, longDescription: e.target.value })}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      color: '#94A3B8',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '8px 18px',
                      background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
                    }}
                  >
                    {isSubmitting ? 'Creating...' : 'Create & Open Studio'}
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
