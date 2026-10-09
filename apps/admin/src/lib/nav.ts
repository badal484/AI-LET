import { Activity, Bot, Coins, HeartPulse, LayoutDashboard, LifeBuoy, Settings, ShieldAlert, Users, type LucideIcon } from 'lucide-react';

/** The 9 screens. `permission` hides a screen from admins who can't use it. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  blurb: string;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, permission: 'analytics.read', blurb: 'Today at a glance' },
  { href: '/users', label: 'Users', icon: Users, permission: 'users.read', blurb: 'Find a user, see their plan and help them' },
  { href: '/characters', label: 'Characters', icon: Bot, permission: 'characters.read', blurb: 'All characters: on/off, featured, how they do' },
  { href: '/money', label: 'Money', icon: Coins, permission: 'billing.read', blurb: 'Revenue, subscribers, trials and limits' },
  { href: '/ai-cost', label: 'AI cost', icon: Activity, permission: 'ai.cost.read', blurb: 'What the AI costs, per message and per character' },
  { href: '/safety', label: 'Safety', icon: ShieldAlert, permission: 'moderation.read', blurb: 'Crisis moments, reports and blocked messages' },
  { href: '/support', label: 'Support', icon: LifeBuoy, permission: 'support.read', blurb: 'Messages from users' },
  { href: '/system', label: 'System', icon: HeartPulse, permission: 'settings.read', blurb: 'Health, errors and alerts' },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings.read', blurb: 'Switches, promo codes, team and audit log' },
];

export interface AdminMe {
  adminId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export const can = (me: AdminMe | undefined, permission: string) =>
  Boolean(me && (me.roles.includes('super_admin') || me.permissions.includes(permission)));
