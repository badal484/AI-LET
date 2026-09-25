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
  Plus,
} from 'lucide-react';

interface NavSection {
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  items: {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'Executive Overview',
    items: [
      { label: 'Command Center', href: '/', icon: LayoutDashboard },
      { label: 'Growth & Retention', href: '/analytics/growth', icon: TrendingUp },
      { label: 'AI Economics', href: '/analytics/ai-economics', icon: DollarSign },
    ],
  },
  {
    title: 'AI Companion Studio',
    items: [
      { label: 'Characters & Avatars', href: '/characters', icon: Bot, badge: 'Core' },
      { label: 'Knowledge & RAG', href: '/ai/knowledge', icon: BookOpen },
      { label: 'Voice & Speech', href: '/voice', icon: Mic },
      { label: 'Simulation & Sandbox', href: '/character-simulation', icon: Sparkles },
      { label: 'AI Routing & Models', href: '/ai', icon: BrainCircuit },
    ],
  },
  {
    title: 'Mobile Experience',
    items: [
      { label: 'Discovery & Home', href: '/discovery', icon: Compass },
      { label: 'Notifications & Check-ins', href: '/notifications', icon: Bell },
      { label: 'Social Stories & Feed', href: '/social', icon: MessagesSquare },
    ],
  },
  {
    title: 'Trust & Monetization',
    items: [
      { label: 'Users & Accounts', href: '/users', icon: Users },
      { label: 'Moderation & Safety', href: '/moderation', icon: ShieldCheck },
      { label: 'Monetization & Plans', href: '/monetization', icon: CreditCard },
      { label: 'Creators & UGC', href: '/creators', icon: Users },
    ],
  },
  {
    title: 'Advanced Engineering',
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Advanced Engineering': false,
  });

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="admin-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
      {/* Brand Header */}
      <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                color: '#FFFFFF',
              }}
            >
              ✦
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                Companion Studio
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Admin Console</span>
            </div>
          </div>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              color: '#4ADE80',
              fontWeight: '600',
            }}
          >
            Live
          </span>
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
            padding: '8px 12px',
            backgroundColor: '#161B26',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            color: '#94A3B8',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="#A855F7" />
            <span>Smart Search...</span>
          </div>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 5px',
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

      {/* Navigation Sections */}
      <nav
        style={{
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
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
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isCollapsible ? '#94A3B8' : '#64748B',
                  cursor: isCollapsible ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
              >
                <span>{section.title}</span>
                {isCollapsible && (
                  <span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                )}
              </div>

              {/* Section Items */}
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: isActive ? '600' : '400',
                          backgroundColor: isActive ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                          color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                          borderLeft: isActive ? '3px solid #A855F7' : '3px solid transparent',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Icon
                            size={16}
                            style={{
                              color: isActive ? '#C084FC' : 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(168, 85, 247, 0.2)',
                              color: '#C084FC',
                            }}
                          >
                            {item.badge}
                          </span>
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

      {/* Footer / Status */}
      <div
        style={{
          padding: '14px 18px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text-muted)',
          backgroundColor: '#090D15',
        }}
      >
        <span>v0.1.0 • Smart Studio</span>
        <span style={{ color: '#A855F7', fontWeight: '600' }}>Ready</span>
      </div>
    </aside>
  );
};
