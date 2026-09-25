'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AdminAuthService } from '../../services/adminAuth';
import { AuthGuard } from '../../components/AuthGuard';
import {
  Users,
  Search,
  Sparkles,
  ShieldCheck,
  Award,
  RefreshCw,
  MessageSquare,
  Heart,
  Layers,
} from 'lucide-react';

interface CreatorDirectoryItem {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'PARTNER';
  status: 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'BANNED' | 'CLOSED';
  publishedCharactersCount: number;
  totalFollowersCount: number;
  totalMessagesCount: number;
  createdAt: string;
}

export default function CreatorsAdminPage() {
  const [creators, setCreators] = useState<CreatorDirectoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerification, setFilterVerification] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminAuthService.listCreators({ limit: 100 });
      setCreators(data as CreatorDirectoryItem[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load creators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = creators.filter((c) => {
    const matchesSearch =
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVer = filterVerification === 'ALL' || c.verificationStatus === filterVerification;
    return matchesSearch && matchesVer;
  });

  const totalCreators = creators.length;
  const verifiedCount = creators.filter((c) => c.verificationStatus === 'VERIFIED' || c.verificationStatus === 'PARTNER').length;
  const totalCharacters = creators.reduce((acc, c) => acc + (c.publishedCharactersCount || 0), 0);
  const totalMessages = creators.reduce((acc, c) => acc + (c.totalMessagesCount || 0), 0);

  const handleToggleVerification = async (creatorId: string) => {
    const current = creators.find((c) => c.id === creatorId);
    if (!current) return;
    const nextStatus = current.verificationStatus === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED';
    setPendingId(creatorId);
    setError(null);
    try {
      const updated = await AdminAuthService.setCreatorVerification(
        creatorId,
        nextStatus,
        'Changed from admin creator directory'
      );
      setCreators((prev) =>
        prev.map((c) =>
          c.id === creatorId
            ? { ...c, verificationStatus: updated.verificationStatus as CreatorDirectoryItem['verificationStatus'] }
            : c
        )
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to update verification');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <AuthGuard>
      <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: '800',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Users size={28} style={{ color: 'var(--accent-primary)' }} />
              Creator Management & Directory
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Monitor creator accounts, manage verification badges, and inspect creator companion ecosystems.
            </p>
          </div>
          <button
            onClick={load}
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
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          <div className="admin-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Total Creators</span>
              <Users size={18} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {totalCreators.toLocaleString()}
            </div>
          </div>

          <div className="admin-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Verified / Partners</span>
              <Award size={18} style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#8b5cf6' }}>
              {verifiedCount.toLocaleString()}
            </div>
          </div>

          <div className="admin-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Creator Characters</span>
              <Layers size={18} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#38bdf8' }}>
              {totalCharacters.toLocaleString()}
            </div>
          </div>

          <div className="admin-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Messages Generated</span>
              <MessageSquare size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#10b981' }}>
              {totalMessages.toLocaleString()}
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: '20px',
              padding: '14px 18px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* Filters & Search */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by username or display name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 46px',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
          <select
            value={filterVerification}
            onChange={(e) => setFilterVerification(e.target.value)}
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Verification Statuses</option>
            <option value="VERIFIED">Verified Only</option>
            <option value="PARTNER">Partner Only</option>
            <option value="UNVERIFIED">Unverified Only</option>
          </select>
        </div>

        {/* Directory Table */}
        <div className="admin-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '16px 20px' }}>Creator</th>
                <th style={{ padding: '16px 20px' }}>Verification</th>
                <th style={{ padding: '16px 20px' }}>Published Characters</th>
                <th style={{ padding: '16px 20px' }}>Followers</th>
                <th style={{ padding: '16px 20px' }}>Total Messages</th>
                <th style={{ padding: '16px 20px' }}>Status</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading creator directory...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No creators match the current filter.
                  </td>
                </tr>
              )}
              {filtered.map((creator) => (
                <tr
                  key={creator.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          color: 'var(--accent-primary)',
                          fontSize: '16px',
                        }}
                      >
                        {creator.displayName ? creator.displayName[0].toUpperCase() : 'C'}
                      </div>
                      <div>
                        <p style={{ fontWeight: '700', color: 'var(--text-primary)', margin: 0, fontSize: '14px' }}>
                          {creator.displayName}
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                          @{creator.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        backgroundColor:
                          creator.verificationStatus === 'VERIFIED'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : creator.verificationStatus === 'PARTNER'
                            ? 'rgba(168, 85, 247, 0.15)'
                            : 'rgba(107, 114, 128, 0.15)',
                        color:
                          creator.verificationStatus === 'VERIFIED'
                            ? '#3b82f6'
                            : creator.verificationStatus === 'PARTNER'
                            ? '#a855f7'
                            : 'var(--text-muted)',
                      }}
                    >
                      {creator.verificationStatus}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {creator.publishedCharactersCount || 0}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {(creator.totalFollowersCount || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {(creator.totalMessagesCount || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: creator.status === 'ACTIVE' ? '#10b981' : '#f59e0b',
                        fontWeight: '700',
                      }}
                    >
                      ● {creator.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleVerification(creator.id)}
                      disabled={pendingId === creator.id}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: 'var(--surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Sparkles size={14} color="#eab308" />
                      {creator.verificationStatus === 'VERIFIED' ? 'Revoke Badge' : 'Verify Creator'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  );
}
