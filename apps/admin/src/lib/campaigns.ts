/** Admin notification campaigns (server: apps/api/src/modules/console/campaigns.service.ts). */

export type Surface = 'push' | 'inbox' | 'banner' | 'popup';
export type CampaignKind = 'news' | 'offer' | 'account';
export type Plan = 'free' | 'trial' | 'premium' | 'trouble';

export interface Audience {
  plans: Plan[];
  joinedWithinDays: number | null;
  inactiveForDays: number | null;
  activeWithinDays: number | null;
  characterIds: string[];
  categoryIds: string[];
  appVersionBelow: string | null;
  emails: string[];
}

export interface CampaignDraft {
  name: string;
  kind: CampaignKind;
  title: string;
  body: string;
  imageUrl: string | null;
  senderCharacterId: string | null;
  postInChat: boolean;
  link: string | null;
  buttons: Array<{ label: string; link: string }>;
  surfaces: Surface[];
  sound: boolean;
  audience: Audience;
  schedule: { mode: 'now' | 'at' | 'local'; at?: string | null; localHour?: number | null };
  respectQuietHours: boolean;
  skipRecentDays: number;
  expiresInDays: number | null;
  isTemplate?: boolean;
}

export interface Campaign extends Omit<CampaignDraft, 'expiresInDays'> {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELLED' | string;
  expiresAt: string | null;
  isTemplate: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  stats: {
    audience: number;
    waiting: number;
    sent: number;
    phones: number;
    opened: number;
    clicked: number;
    dismissed: number;
    skipped: number;
    failed: number;
    deadPhones: number;
    openRate: number | null;
  };
  skipReasons?: Array<{ reason: string; n: number }>;
}

export interface ComposerOptions {
  characters: Array<{ id: string; name: string; avatarUrl: string | null; categoryId: string | null }>;
  categories: Array<{ id: string; name: string }>;
}

export interface AudienceSize {
  matched: number;
  willReceive: number;
  phoneNotifications: number;
  optedOut: number;
  skippedRecent: number;
}

export const emptyDraft = (): CampaignDraft => ({
  name: '',
  kind: 'news',
  title: '',
  body: '',
  imageUrl: null,
  senderCharacterId: null,
  postInChat: false,
  link: 'companion://home',
  buttons: [],
  surfaces: ['push', 'inbox'],
  sound: true,
  audience: { plans: [], joinedWithinDays: null, inactiveForDays: null, activeWithinDays: null, characterIds: [], categoryIds: [], appVersionBelow: null, emails: [] },
  schedule: { mode: 'now' },
  respectQuietHours: true,
  skipRecentDays: 2,
  expiresInDays: 7,
});

export const KIND: Record<CampaignKind, { label: string; hint: string }> = {
  news: { label: 'News & updates', hint: 'New characters, features, tips. On for everyone unless they switch it off.' },
  offer: { label: 'Offer', hint: 'Discounts and deals. Only reaches people who turned on "Offers" in the app.' },
  account: { label: 'Account notice', hint: 'Important things about their account. Use rarely.' },
};

export const SURFACE: Record<Surface, { label: string; hint: string }> = {
  push: { label: 'Phone notification', hint: 'Shows on the lock screen, with the big picture when opened' },
  inbox: { label: 'Inbox in the app', hint: 'Stays under the bell until read' },
  popup: { label: 'Popup in the app', hint: 'A card with picture and buttons, next time they open the app' },
  banner: { label: 'Banner in the app', hint: 'A small strip above the tabs until closed' },
};

export const PLAN: Record<Plan, string> = { free: 'Free', trial: 'In ₹1 trial', premium: 'Premium', trouble: 'Payment trouble' };

export const STATUS: Record<string, { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SCHEDULED: { label: 'Scheduled', tone: 'accent' },
  SENDING: { label: 'Sending', tone: 'warn' },
  COMPLETED: { label: 'Sent', tone: 'good' },
  CANCELLED: { label: 'Stopped', tone: 'bad' },
};

export const SKIP_REASON: Record<string, string> = {
  opted_out: 'Switched this kind off',
  expired: 'Expired before it could go out',
  missed_their_hour: 'Their hour didn’t come in time',
  stopped: 'You stopped the campaign',
  dead_phone: 'App uninstalled',
  error: 'Error while sending',
};

/** Links the composer offers (the app understands these; anything https:// opens the browser). */
export const LINKS: Array<{ label: string; value: string }> = [
  { label: 'Home', value: 'companion://home' },
  { label: 'Chats list', value: 'companion://messages' },
  { label: 'Premium (paywall)', value: 'companion://paywall' },
  { label: 'Inbox', value: 'companion://notifications' },
  { label: 'Profile', value: 'companion://profile' },
];

/** Fills {name} and {character} the way the server does, for the preview. */
export const personalize = (text: string, character: string | undefined) =>
  text.replace(/\{name\}/gi, 'Priya').replace(/\{character\}/gi, character?.split(' ')[0] ?? 'Lovira');
