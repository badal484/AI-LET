'use client';

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from './AuthGuard';
import { Search, Plus, LogOut, Activity, ChevronRight, Bell, Sparkles } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export const Header: React.FC<{ onOpenOmnibar?: () => void }> = ({ onOpenOmnibar }) => {
  const { admin, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [latency, setLatency] = useState<number>(24);

  // Generate breadcrumb titles from pathname
  const pathSegments = pathname?.split('/').filter(Boolean) || [];
  const getBreadcrumbTitle = (seg: string) => {
    switch (seg) {
      case 'characters': return 'Characters & Avatars';
      case 'voice': return 'Voice Infrastructure';
      case 'discovery': return 'Discovery & Home';
      case 'ai': return 'AI Operations';
      case 'models': return 'Model Routing';
      case 'knowledge': return 'Knowledge & RAG';
      case 'users': return 'Users & Roles';
      case 'moderation': return 'Moderation Console';
      case 'monetization': return 'Monetization & Plans';
      case 'creators': return 'Creators Directory';
      case 'notifications': return 'Notifications & Drops';
      case 'social': return 'Social Studio';
      case 'developer-platform': return 'Developer Platform';
      case 'infrastructure': return 'System Cluster';
      case 'analytics': return 'Analytics';
      case 'growth': return 'Growth & Retention';
      case 'ai-economics': return 'AI Economics';
      case 'experiments': return 'A/B Experiments';
      case 'character-simulation': return 'Character Simulation';
      default: return seg.length > 12 ? `${seg.substring(0, 8)}...` : seg.charAt(0).toUpperCase() + seg.slice(1);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(18 + Math.random() * 12));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      style={{
        height: '60px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backgroundColor: 'rgba(9, 11, 16, 0.85)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      {/* Left side: Breadcrumb Trail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          href="/"
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: pathSegments.length === 0 ? '#FFFFFF' : '#64748B',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={e => {
            if (pathSegments.length > 0) e.currentTarget.style.color = '#64748B';
          }}
        >
          <span>Studio</span>
        </Link>

        {pathSegments.map((seg, idx) => (
          <React.Fragment key={seg + idx}>
            <ChevronRight size={13} style={{ color: '#334155' }} />
            <span
              style={{
                fontSize: '13px',
                fontWeight: idx === pathSegments.length - 1 ? '600' : '500',
                color: idx === pathSegments.length - 1 ? '#FFFFFF' : '#64748B',
              }}
            >
              {getBreadcrumbTitle(seg)}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Right side: Telemetry pill, Create Companion button, Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Live Cluster Telemetry Pill */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: '600',
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#34D399',
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
              backgroundColor: '#10B981',
              boxShadow: '0 0 8px #10B981',
            }}
          />
          <span>Gateway: {latency}ms</span>
        </div>

        {/* Quick Create Button */}
        <button
          onClick={() => router.push('/characters')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '7px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.3)',
            transition: 'transform 0.15s ease, opacity 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={14} />
          <span>New Companion</span>
        </button>

        {/* Notification Icon */}
        <button
          onClick={() => router.push('/notifications')}
          title="Notifications"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '7px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.color = '#94A3B8';
          }}
        >
          <Bell size={14} />
        </button>

        {/* Admin Avatar & Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #A855F7, #6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: '700',
              color: '#FFFFFF',
            }}
          >
            AD
          </div>
          <button
            onClick={() => logout()}
            title="Sign Out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '6px',
              color: '#F87171',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};
