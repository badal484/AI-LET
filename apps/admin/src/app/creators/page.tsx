'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AdminAuthService } from '../../services/adminAuth';
import {
  Users,
  Search,
  Sparkles,
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
      setCreators((await AdminAuthService.listCreators({ limit: 100 })) as CreatorDirectoryItem[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load creators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = creators.filter(c => {
    const matchesSearch =
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVer = filterVerification === 'ALL' || c.verificationStatus === filterVerification;
    return matchesSearch && matchesVer;
  });

  const handleToggleVerification = async (creatorId: string) => {
    const current = creators.find(c => c.id === creatorId);
    if (!current) return;
    const nextStatus = current.verificationStatus === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED';
    setPendingId(creatorId);
    setError(null);
    try {
      const updated = await AdminAuthService.setCreatorVerification(creatorId, nextStatus, 'Changed from admin creator directory');
      setCreators(prev => prev.map(c => (c.id === creatorId ? { ...c, verificationStatus: updated.verificationStatus as CreatorDirectoryItem['verificationStatus'] } : c)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update verification');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', color: '#f3f4f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} color="#6366f1" /> Creator Management & Directory
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
            Monitor creator accounts, manage verification status badges, and inspect creator character portfolios.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '14px', top: '12px' }} />
          <input
            type="text"
            placeholder="Search by username or display name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '14px',
            }}
          />
        </div>
        <select
          value={filterVerification}
          onChange={e => setFilterVerification(e.target.value)}
          style={{
            padding: '10px 16px',
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
          }}
        >
          <option value="ALL">All Verification Statuses</option>
          <option value="VERIFIED">Verified Only</option>
          <option value="PARTNER">Partner Only</option>
          <option value="UNVERIFIED">Unverified Only</option>
        </select>
      </div>

      {/* Directory Table */}
      <div style={{ backgroundColor: '#111827', borderRadius: '12px', border: '1px solid #1f2937', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1f2937', backgroundColor: '#1f2937', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase' }}>
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
                <td colSpan={99} style={{ padding: '24px 20px', color: '#9ca3af' }}>Loading creators…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={99} style={{ padding: '24px 20px', color: '#9ca3af' }}>No creators match.</td>
              </tr>
            )}
            {filtered.map(creator => (
              <tr key={creator.id} style={{ borderBottom: '1px solid #1f2937' }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        color: '#6366f1',
                      }}
                    >
                      {creator.displayName[0]}
                    </div>
                    <div>
                      <p style={{ fontWeight: '600', color: '#ffffff' }}>{creator.displayName}</p>
                      <p style={{ fontSize: '12px', color: '#9ca3af' }}>@{creator.username}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
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
                          : '#9ca3af',
                    }}
                  >
                    {creator.verificationStatus}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: '500' }}>
                  {creator.publishedCharactersCount}
                </td>
                <td style={{ padding: '16px 20px', fontSize: '14px', color: '#e5e7eb' }}>
                  {creator.totalFollowersCount.toLocaleString()}
                </td>
                <td style={{ padding: '16px 20px', fontSize: '14px', color: '#e5e7eb' }}>
                  {creator.totalMessagesCount.toLocaleString()}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
                    {creator.status}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleToggleVerification(creator.id)}
                    disabled={pendingId === creator.id}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={13} color="#eab308" />
                    {creator.verificationStatus === 'VERIFIED' ? 'Revoke Badge' : 'Verify Creator'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
