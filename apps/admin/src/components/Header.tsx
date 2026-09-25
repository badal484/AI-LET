'use client';

import React from 'react';
import { useAdminAuth } from './AuthGuard';
import { Search, Plus, LogOut, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const Header: React.FC<{ onOpenOmnibar?: () => void }> = ({ onOpenOmnibar }) => {
  const { admin, logout } = useAdminAuth();
  const router = useRouter();

  return (
    <header className="admin-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '64px' }}>
      {/* Left side: Search / Omnibar quick trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onOpenOmnibar}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#161B26',
            border: '1px solid #1E293B',
            borderRadius: '10px',
            padding: '8px 16px',
            color: '#94A3B8',
            fontSize: '13px',
            cursor: 'pointer',
            minWidth: '280px',
            justifyContent: 'space-between',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={15} color="#A855F7" />
            <span>Search or type a command...</span>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              backgroundColor: '#0F131D',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#64748B',
              fontWeight: '600',
            }}
          >
            ⌘K
          </span>
        </button>
      </div>

      {/* Right side: Quick CTA, Cluster status & Admin account */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Quick Create Companion Button */}
        <button
          onClick={() => router.push('/characters')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            backgroundColor: '#9333EA',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
        >
          <Plus size={15} />
          <span>+ Companion</span>
        </button>

        {/* Live Cluster Pill */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: '600',
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            color: '#4ADE80',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#4ADE80',
            }}
          />
          Live Cluster
        </span>

        {/* Admin Account & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #A855F7, #6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '700',
              color: '#FFFFFF',
            }}
          >
            AD
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {admin?.email ? admin.email.split('@')[0] : 'Admin'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Super Admin</span>
          </div>
          <button
            onClick={() => logout()}
            title="Sign Out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              color: '#F87171',
              cursor: 'pointer',
              marginLeft: '4px',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
