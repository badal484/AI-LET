import { prisma } from '../../infrastructure/database/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

/**
 * Settings changed from the admin console without a release. Read on hot paths (every message), so
 * cached for 20 s per process; a change takes effect everywhere within that time.
 */
export const SETTINGS = {
  'limits.enforce': { label: 'Message limits on', type: 'boolean', default: () => process.env['BILLING_ENFORCE_LIMITS'] === 'true' },
  'limits.freeDaily': { label: 'Free messages per day', type: 'number', default: () => Number(process.env['FREE_DAILY_MESSAGES'] ?? 5) },
  'limits.premiumDaily': { label: 'Premium messages per day (fair use)', type: 'number', default: () => Number(process.env['PREMIUM_DAILY_MESSAGES'] ?? 150) },
  'maintenance.enabled': { label: 'Maintenance mode (app shows a message, chat paused)', type: 'boolean', default: () => false },
  'maintenance.message': { label: 'Maintenance message', type: 'string', default: () => 'We are making Lovira better. Back in a few minutes 💜' },
  'announcement.enabled': { label: 'Show an announcement in the app', type: 'boolean', default: () => false },
  'announcement.text': { label: 'Announcement', type: 'string', default: () => '' },
  'app.minVersion': { label: 'Minimum app version (older apps must update)', type: 'string', default: () => '' },
  'ai.dailyBudget': { label: 'AI budget per day (₹, 0 = no alert)', type: 'number', default: () => 0 },
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
  const before = await getSetting(key as SettingKey);
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: value as never, updatedBy: adminId }, update: { value: value as never, updatedBy: adminId } });
  cache = null;
  await AuditService.log({ actorType: 'ADMIN', actorId: adminId, action: 'console.setting.changed', resourceType: 'SETTING', resourceId: key, metadata: { before, after: value } });
  return { key, value };
}
