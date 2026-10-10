import { prisma } from '../../infrastructure/database/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { Realtime } from '../../infrastructure/realtime/realtime.js';

/**
 * Settings changed from the admin console without a release. Read on hot paths (every message), so
 * cached for 20 s per process; a change takes effect everywhere within that time.
 */
export const SETTINGS = {
  'limits.enforce': { label: 'Message limits on', type: 'boolean', default: () => process.env['BILLING_ENFORCE_LIMITS'] === 'true' },
  'limits.freeDaily': { label: 'Free messages per day', type: 'number', default: () => Number(process.env['FREE_DAILY_MESSAGES'] ?? 5) },
  'limits.premiumDaily': { label: 'Premium messages per day (fair use)', type: 'number', default: () => Number(process.env['PREMIUM_DAILY_MESSAGES'] ?? 150) },
  'maintenance.enabled': { label: 'Maintenance mode (app shows a message, chat paused)', type: 'boolean', default: () => false },
  'maintenance.title': { label: 'Title', type: 'string', default: () => 'Lovira is getting better' },
  'maintenance.message': { label: 'Message', type: 'string', default: () => 'We are making Lovira better. Back in a few minutes 💜' },
  'maintenance.emoji': { label: 'Emoji at the top', type: 'string', default: () => '💜' },
  'maintenance.imageUrl': { label: 'Picture (optional, https link)', type: 'string', default: () => '' },
  'maintenance.until': { label: 'Back by (optional)', type: 'string', default: () => '' },
  'maintenance.linkLabel': { label: 'Button text (optional)', type: 'string', default: () => '' },
  'maintenance.linkUrl': { label: 'Button link (optional, https)', type: 'string', default: () => '' },
  'announcement.enabled': { label: 'Show an announcement in the app', type: 'boolean', default: () => false },
  'announcement.text': { label: 'Announcement', type: 'string', default: () => '' },
  'app.minVersion': { label: 'Minimum app version (older apps must update)', type: 'string', default: () => '' },
  'ai.dailyBudget': { label: 'AI budget per day (₹, 0 = no alert)', type: 'number', default: () => 0 },
  // Characters texting first (notifications/services/proactiveRound.service.ts). Off until the admin turns it on.
  'proactive.enabled': { label: 'Characters text first', type: 'boolean', default: () => false },
  'proactive.dailyBudget': { label: 'Most messages a person gets per day (all characters)', type: 'number', default: () => 2 },
  'proactive.startHour': { label: 'Earliest hour (their time, 0–23)', type: 'number', default: () => 9 },
  'proactive.endHour': { label: 'Latest hour (their time, 0–23)', type: 'number', default: () => 21 },
} as const;

export type SettingKey = keyof typeof SETTINGS;
type Value<K extends SettingKey> = ReturnType<(typeof SETTINGS)[K]['default']>;

let cache: { at: number; values: Map<string, unknown> } | null = null;

async function load(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.at < 20_000) return cache.values;
  const rows = await prisma.appSetting.findMany().catch(() => []);
  cache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.value])) };
  return cache.values;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Value<K>> {
  const values = await load();
  return (values.has(key) ? values.get(key) : SETTINGS[key].default()) as Value<K>;
}

export async function allSettings() {
  const values = await load();
  return (Object.keys(SETTINGS) as SettingKey[]).map((key) => ({
    key,
    label: SETTINGS[key].label,
    type: SETTINGS[key].type,
    value: values.has(key) ? values.get(key) : SETTINGS[key].default(),
    isDefault: !values.has(key),
  }));
}

export async function setSetting(adminId: string, key: string, value: unknown) {
  if (!(key in SETTINGS)) throw new BadRequestError(`Unknown setting ${key}`);
  const def = SETTINGS[key as SettingKey];
  const ok =
    (def.type === 'boolean' && typeof value === 'boolean') ||
    (def.type === 'number' && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100_000) ||
    (def.type === 'string' && typeof value === 'string' && value.length <= 300);
  if (!ok) throw new BadRequestError(`Invalid value for ${def.label}`);
  if (key === 'app.minVersion' && value !== '' && !/^\d+(\.\d+){0,2}$/.test(String(value))) throw new BadRequestError('Write the version like 1.4.0 (or leave it empty).');
  if ((key === 'maintenance.imageUrl' || key === 'maintenance.linkUrl') && value !== '' && !/^https:\/\/\S+$/.test(String(value))) {
    throw new BadRequestError('Use a full https:// link (or leave it empty).');
  }
  if (key === 'maintenance.until' && value !== '' && Number.isNaN(Date.parse(String(value)))) throw new BadRequestError('Pick a date and time (or leave it empty).');
  const before = await getSetting(key as SettingKey);
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: value as never, updatedBy: adminId }, update: { value: value as never, updatedBy: adminId } });
  cache = null;
  await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: 'console.setting.changed', resourceType: 'SETTING', resourceId: key, metadata: { before, after: value } });
  if (/^(maintenance|announcement|app)\./.test(key)) Realtime.broadcast({ type: 'settings.updated', keys: [key] });
  return { key, value };
}

/** What the app shows while maintenance is on (also sent with every blocked request). Null when off. */
export async function maintenanceInfo() {
  if (!(await getSetting('maintenance.enabled').catch(() => false))) return null;
  const [title, message, emoji, imageUrl, until, linkLabel, linkUrl] = await Promise.all([
    getSetting('maintenance.title'),
    getSetting('maintenance.message'),
    getSetting('maintenance.emoji'),
    getSetting('maintenance.imageUrl'),
    getSetting('maintenance.until'),
    getSetting('maintenance.linkLabel'),
    getSetting('maintenance.linkUrl'),
  ]);
  const back = until && Date.parse(until) > Date.now() ? new Date(until).toISOString() : null;
  return {
    title: title.trim() || 'Lovira is getting better',
    message: message.trim(),
    emoji: emoji.trim() || null,
    imageUrl: imageUrl.trim() || null,
    until: back,
    link: linkLabel.trim() && linkUrl.trim() ? { label: linkLabel.trim(), url: linkUrl.trim() } : null,
  };
}
