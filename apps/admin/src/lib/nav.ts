import { Activity, Bell, Bot, Coins, HeartPulse, LayoutDashboard, LifeBuoy, Settings, ShieldAlert, Users, type LucideIcon } from 'lucide-react';

/** The screens. `permission` hides a screen from admins who can't use it. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  blurb: string;
  /** Used less often: listed under "More" in the menu. */
  more?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, permission: 'analytics.read', blurb: 'Today at a glance' },
  { href: '/users', label: 'Users', icon: Users, permission: 'users.read', blurb: 'Find a user, see their plan and help them' },
  { href: '/characters', label: 'Characters', icon: Bot, permission: 'characters.read', blurb: 'All characters: on/off, featured, how they do' },
  { href: '/money', label: 'Money', icon: Coins, permission: 'billing.read', blurb: 'Revenue, subscribers, trials and limits' },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings.read', blurb: 'Switches, promo codes, team and audit log' },
  { more: true, href: '/ai-cost', label: 'AI cost', icon: Activity, permission: 'ai.cost.read', blurb: 'What the AI costs, per message and per character' },
  { more: true, href: '/safety', label: 'Safety', icon: ShieldAlert, permission: 'moderation.read', blurb: 'Crisis moments, reports and blocked messages' },
  { more: true, href: '/support', label: 'Support', icon: LifeBuoy, permission: 'support.read', blurb: 'Messages from users' },
  { more: true, href: '/notifications', label: 'Notifications', icon: Bell, permission: 'notifications.read', blurb: 'Send pushes, popups and banners to users' },
  { more: true, href: '/system', label: 'System', icon: HeartPulse, permission: 'settings.read', blurb: 'Health, errors and alerts' },
];

export interface AdminMe {
  adminId: string;
  email: string;
  roles: string[];
  permissions: string[];
  mfaEnabled?: boolean;
  /** Two-step sign-in is required but not set up: show the setup screen only. */
  mfaSetupOnly?: boolean;
}

export const can = (me: AdminMe | undefined, permission: string) =>
  Boolean(me && (me.roles.includes('super_admin') || me.permissions.includes(permission)));
