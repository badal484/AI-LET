import React from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

const navItems = [
  { label: 'Command Center', href: '/', icon: LayoutDashboard },
  { label: 'Developer Platform', href: '/developer-platform', icon: Code2 },
  { label: 'Growth & Retention', href: '/analytics/growth', icon: TrendingUp },
  { label: 'AI Economics', href: '/analytics/ai-economics', icon: DollarSign },
  { label: 'A/B Experiments', href: '/analytics/experiments', icon: FlaskConical },
  { label: 'Characters', href: '/characters', icon: Bot },
  { label: 'Simulation & Goals', href: '/character-simulation', icon: Sparkles },
  { label: 'Discovery & Home', href: '/discovery', icon: Compass },
  { label: 'Voice Infrastructure', href: '/voice', icon: Mic },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'AI Routing & Models', href: '/ai', icon: BrainCircuit },
  { label: 'Knowledge & RAG', href: '/ai/knowledge', icon: BookOpen },
  { label: 'Monetization', href: '/monetization', icon: CreditCard },
  { label: 'Creators', href: '/creators', icon: Users },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Moderation', href: '/moderation', icon: ShieldCheck },
  { label: 'Social Studio', href: '/social', icon: MessagesSquare },
  { label: 'System & Infrastructure', href: '/infrastructure', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="admin-sidebar">
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: 'var(--accent-primary)' }}>✦</span> AI Operations
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Companion Admin Console
        </p>
      </div>

      <nav
        style={{
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flex: 1,
        }}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Icon size={18} style={{ color: 'var(--text-muted)' }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        v0.1.0 • Production Ready
      </div>
    </aside>
  );
};
