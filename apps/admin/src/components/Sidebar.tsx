'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Bot,
  BrainCircuit,
  CreditCard,
  Bell,
  ShieldCheck,
  Settings,
  Mic,
  Compass,
  TrendingUp,
  DollarSign,
  FlaskConical,
  MessagesSquare,
  BookOpen,
  Sparkles,
  Code2,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkle,
} from 'lucide-react';
import { useAdminAuth } from './AuthGuard';

interface NavSection {
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  items: {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
    badgeColor?: string;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Command Center', href: '/', icon: LayoutDashboard },
      { label: 'Growth & Retention', href: '/analytics/growth', icon: TrendingUp },
      { label: 'AI Economics', href: '/analytics/ai-economics', icon: DollarSign },
    ],
  },
  {
    title: 'Companion Studio',
    items: [
      { label: 'Characters & Avatars', href: '/characters', icon: Bot, badge: 'Core', badgeColor: '#A855F7' },
      { label: 'Knowledge & RAG', href: '/ai/knowledge', icon: BookOpen },
      { label: 'Voice & Speech', href: '/voice', icon: Mic, badge: 'Live', badgeColor: '#10B981' },
      { label: 'Simulation & Sandbox', href: '/character-simulation', icon: Sparkles },
      { label: 'AI Routing & Models', href: '/ai', icon: BrainCircuit },
    ],
  },
  {
    title: 'Mobile Experience',
    items: [
      { label: 'Discovery & Home', href: '/discovery', icon: Compass },
      { label: 'Notifications & Drops', href: '/notifications', icon: Bell },
      { label: 'Social Stories & Feed', href: '/social', icon: MessagesSquare },
    ],
  },
  {
    title: 'Trust & Monetization',
    items: [
      { label: 'Users & Accounts', href: '/users', icon: Users },
      { label: 'Moderation & Safety', href: '/moderation', icon: ShieldCheck, badge: 'Auto', badgeColor: '#3B82F6' },
      { label: 'Monetization & Plans', href: '/monetization', icon: CreditCard },
      { label: 'Creators & UGC', href: '/creators', icon: Users },
    ],
  },
  {
    title: 'Advanced Platform',
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: 'A/B Experiments', href: '/analytics/experiments', icon: FlaskConical },
      { label: 'Developer Platform', href: '/developer-platform', icon: Code2 },
      { label: 'System & Cluster', href: '/infrastructure', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<{ onOpenOmnibar?: () => void }> = ({ onOpenOmnibar }) => {
  const pathname = usePathname();
  const { admin } = useAdminAuth();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Advanced Platform': false,
  });

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside
      style={{
        width: '264px',
        backgroundColor: '#090B10',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '18px 16px 14px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(168, 85, 247, 0.45)',
              }}
            >
              <Sparkle size={16} color="#FFFFFF" fill="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  COMPANION
                </span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#A855F7', backgroundColor: 'rgba(168, 85, 247, 0.15)', padding: '1px 5px', borderRadius: '4px' }}>
                  PRO
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>Operations Console</span>
            </div>
          </Link>
        </div>

        {/* Quick Omnibar search trigger */}
        <button
          onClick={onOpenOmnibar}
          style={{
            marginTop: '14px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 11px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '8px',
            color: '#94A3B8',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={13} color="#A855F7" />
            <span style={{ color: '#64748B', fontSize: '12px' }}>Search or jump to...</span>
          </div>
          <kbd
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              backgroundColor: '#0F131D',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: '#94A3B8',
              fontFamily: 'inherit',
              fontWeight: '600',
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {navSections.map(section => {
          const isCollapsible = section.collapsible;
          const isOpen = !isCollapsible || openSections[section.title];

          return (
            <div key={section.title}>
              {/* Section Header */}
              <div
                onClick={() => isCollapsible && toggleSection(section.title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#475569',
                  cursor: isCollapsible ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
              >
                <span>{section.title}</span>
                {isCollapsible && (
                  <span style={{ color: '#475569' }}>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                )}
              </div>

              {/* Section Items */}
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px' }}>
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: isActive ? '600' : '500',
                          backgroundColor: isActive ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                          color: isActive ? '#FFFFFF' : '#94A3B8',
                          position: 'relative',
                          transition: 'all 0.15s ease',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                            e.currentTarget.style.color = '#F1F5F9';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#94A3B8';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <Icon
                            size={16}
                            style={{
                              color: isActive ? '#C084FC' : '#64748B',
                              transition: 'color 0.15s ease',
                            }}
                          />
                          <span>{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: `rgba(${item.badgeColor === '#10B981' ? '16, 185, 129' : item.badgeColor === '#3B82F6' ? '59, 130, 246' : '168, 85, 247'}, 0.15)`,
                              color: item.badgeColor || '#C084FC',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}

                        {isActive && (
                          <span
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '20%',
                              bottom: '20%',
                              width: '3px',
                              borderRadius: '0 2px 2px 0',
                              backgroundColor: '#A855F7',
                              boxShadow: '0 0 8px #A855F7',
                            }}
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Profile Pill */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#F8FAFC', lineHeight: 1.2 }}>
              {admin?.email ? admin.email.split('@')[0] : 'Super Admin'}
            </span>
            <span style={{ fontSize: '10px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Active Session
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
