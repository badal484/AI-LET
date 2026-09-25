'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard, useAdminAuth } from '../../components/AuthGuard';
import { AdminCharacterApi } from '../../services/adminCharacterApi';
import { Bot, Plus, Search, Filter, Sparkles, ArrowRight, X } from 'lucide-react';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bot size={26} style={{ color: 'var(--accent-primary)' }} />
              Character Studio & Engine
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Create, configure, test, version, and publish production AI personas
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: 'var(--accent-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <Plus size={18} />
            Create Character
          </button>
        </div>

        {/* Filters */}
        <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px', backgroundColor: 'var(--bg-secondary)', padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name, slug, tagline..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="REVIEW">In Review</option>
              <option value="UNPUBLISHED">Unpublished</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Characters Grid */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading characters from engine...
          </div>
        ) : characters.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <Bot size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No Characters Found</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Create your first AI character to begin configuring personality, behavior, and testing.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Create Character
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '20px',
            }}
          >
            {characters.map(char => (
              <div
                key={char.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  border: char.status === 'PUBLISHED' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <img
                    src={char.avatarUrl}
                    alt={char.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {char.name}
                      </h3>
                      <span
                        className={`badge ${
                          char.status === 'PUBLISHED'
                            ? 'badge-success'
                            : char.status === 'DRAFT'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                      >
                        {char.status}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      @{char.slug} • {char.category}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {char.tagline}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span>Version v{char.currentVersionNumber}</span>
                  </div>

                  <Link
                    href={`/characters/${char.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--accent-primary)',
                      fontWeight: '600',
                      textDecoration: 'none',
                    }}
                  >
                    Open Studio <ArrowRight size={14} />
                  </Link>
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
              backgroundColor: 'rgba(0,0,0,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '540px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Create New AI Character
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {createError && (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateCharacter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Character Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Luna, Marcus, Aria"
                    value={formData.name}
                    onChange={handleNameChange}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Slug *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={e => setFormData({ ...formData, slug: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Category *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Tagline *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Empathetic Astrologer & Celestial Muse"
                    value={formData.tagline}
                    onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Short Description *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="1-2 sentences summarizing character essence"
                    value={formData.shortDescription}
                    onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Backstory / Core Context *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detailed backstory, origins, life world..."
                    value={formData.longDescription}
                    onChange={e => setFormData({ ...formData, longDescription: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: '#fff', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    style={{ padding: '8px 16px', backgroundColor: '#1E293B', color: '#94A3B8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ padding: '8px 18px', backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
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
