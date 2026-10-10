import { randomBytes } from 'node:crypto';
import { prisma } from '../../infrastructure/database/prisma.js';
import { redis } from '../../infrastructure/redis/redis.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../../security/password.js';
import { AuditService } from '../audit/audit.service.js';
import { attentionCounts, istMidnight, REAL_USERS } from './overview.service.js';
import { jobStatus, recentErrors } from './health.js';
import { Realtime } from '../../infrastructure/realtime/realtime.js';

/** Safety, Support, System, promo codes, team and audit log for the admin console. */

const audit = (adminId: string, action: string, resourceType: string, resourceId: string | null, metadata: Record<string, unknown> = {}) =>
  AuditService.log({ actorType: 'ADMIN', actorId: adminId, action, resourceType, resourceId, metadata });

// ── Safety ───────────────────────────────────────────────────────────────────

export async function getSafety() {
  const [counts, moments, reports, disliked] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ kind: string; last24h: number; week: number; open: number }>>(
      `SELECT kind, count(*) FILTER (WHERE created_at >= now() - interval '1 day')::int "last24h",
              count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int week,
              count(*) FILTER (WHERE resolved_at IS NULL)::int open
         FROM safety_moments GROUP BY kind`,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT sm.id, sm.kind, sm.helpline_shown "helplineShown", sm.resolved_at "resolvedAt", sm.note,
              to_char(sm.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') at, u.id "userId", u.email, pr.display_name name, ch.name "character"
         FROM safety_moments sm JOIN users u ON u.id = sm.user_id LEFT JOIN user_profiles pr ON pr.user_id = u.id
         LEFT JOIN characters ch ON ch.id = sm.character_id
        WHERE ${REAL_USERS} ORDER BY sm.resolved_at IS NULL DESC, sm.created_at DESC LIMIT 60`,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT r.id, r.reason_code::text reason, r.details, r.status, to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') at,
              u.id "userId", u.email, ch.name "character"
         FROM character_reports r JOIN users u ON u.id = r.reporter_user_id JOIN characters ch ON ch.id = r.character_id
        ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 40`,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT f.id, f.message_id "messageId", f.feedback_text "text", f.reason_category reason, to_char(f.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') at,
              u.id "userId", u.email, ch.name "character"
         FROM message_feedback f JOIN users u ON u.id = f.user_id JOIN messages m ON m.id = f.message_id
         JOIN conversations c ON c.id = m.conversation_id JOIN characters ch ON ch.id = c.character_id
        WHERE f.rating = 'THUMBS_DOWN' AND ${REAL_USERS} ORDER BY f.created_at DESC LIMIT 40`,
    ),
  ]);
  return { counts, moments, reports, disliked };
}

export async function resolveMoment(adminId: string, id: string, note: string) {
  const m = await prisma.safetyMoment.update({ where: { id }, data: { resolvedAt: new Date(), resolvedBy: adminId, note: note.slice(0, 500) } }).catch(() => null);
  if (!m) throw new NotFoundError('Safety moment not found');
  await audit(adminId, 'console.safety.resolved', 'SAFETY_MOMENT', id, { note });
  return { ok: true };
}

/** "Mark all reviewed": every open moment (optionally of one kind) at once — after reading them, not instead. */
export async function resolveAllMoments(adminId: string, kind: string | null, note: string) {
  const res = await prisma.safetyMoment.updateMany({
    where: { resolvedAt: null, ...(kind && { kind }) },
    data: { resolvedAt: new Date(), resolvedBy: adminId, note: note.slice(0, 500) || 'Marked reviewed in bulk' },
  });
  await audit(adminId, 'console.safety.resolved_all', 'SAFETY_MOMENT', null, { kind, count: res.count, note });
  return { ok: true, count: res.count };
}

export async function setReportStatus(adminId: string, id: string, status: string) {
  if (!['open', 'reviewed', 'dismissed', 'actioned'].includes(status)) throw new BadRequestError('Unknown status');
  await prisma.characterReport.update({ where: { id }, data: { status } }).catch(() => {
    throw new NotFoundError('Report not found');
  });
  await audit(adminId, 'console.report.status', 'CHARACTER_REPORT', id, { status });
  return { ok: true };
}

/**
 * Opens a chat for a safety review: only the few messages around one moment, report or rating, and
 * every opening is written to the audit log (chats are private by default).
 */
export async function reviewChat(adminId: string, params: { messageId?: string; momentId?: string }, reason: string) {
  let conversationId: string | null = null;
  let around: Date | null = null;
  if (params.momentId) {
    const m = await prisma.safetyMoment.findUnique({ where: { id: params.momentId } });
    conversationId = m?.conversationId ?? null;
    around = m?.createdAt ?? null;
  } else if (params.messageId) {
    const msg = await prisma.message.findUnique({ where: { id: params.messageId }, select: { conversationId: true, createdAt: true } });
    conversationId = msg?.conversationId ?? null;
    around = msg?.createdAt ?? null;
  }
  if (!conversationId || !around) throw new NotFoundError('Nothing to review');
  const [before, after] = await Promise.all([
    prisma.message.findMany({ where: { conversationId, createdAt: { lte: around } }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, role: true, content: true, createdAt: true } }),
    prisma.message.findMany({ where: { conversationId, createdAt: { gt: around } }, orderBy: { createdAt: 'asc' }, take: 6, select: { id: true, role: true, content: true, createdAt: true } }),
  ]);
  await audit(adminId, 'console.safety.chat_viewed', 'CONVERSATION', conversationId, { ...params, reason });
  return { messages: [...before.reverse(), ...after] };
}

// ── Support ──────────────────────────────────────────────────────────────────

export async function listSupport(status: string, search = '') {
  const q = search.trim() ? `%${search.trim().toLowerCase()}%` : null;
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT s.id, s.topic, s.message, s.status, s.reply, to_char(s.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') at,
            to_char(s.replied_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') "repliedAt", u.id "userId", u.email, pr.display_name name
       FROM support_requests s JOIN users u ON u.id = s.user_id LEFT JOIN user_profiles pr ON pr.user_id = u.id
      WHERE ($1 = 'all' OR s.status = $1)
        AND ($2::text IS NULL OR lower(s.message) LIKE $2 OR lower(u.email) LIKE $2 OR lower(coalesce(pr.display_name, '')) LIKE $2 OR lower(coalesce(s.reply, '')) LIKE $2)
      ORDER BY (s.status = 'open') DESC, s.created_at DESC LIMIT 100`,
    status || 'open',
    q,
  );
}

export async function replySupport(adminId: string, id: string, reply: string, close: boolean) {
  if (!reply.trim() && !close) throw new BadRequestError('Write a reply or close it.');
  const s = await prisma.supportRequest
    .update({ where: { id }, data: { ...(reply.trim() && { reply: reply.trim(), repliedBy: adminId, repliedAt: new Date() }), status: close ? 'closed' : 'answered' } })
    .catch(() => null);
  if (!s) throw new NotFoundError('Request not found');
  await audit(adminId, close ? 'console.support.closed' : 'console.support.replied', 'SUPPORT_REQUEST', id, {});
  return { ok: true };
}

/** From the app: Help → Contact us. */
export async function createSupportRequest(userId: string, topic: string, message: string) {
  const t = ['payment', 'account', 'bug', 'delete_data', 'feedback', 'other'].includes(topic) ? topic : 'other';
  if (message.trim().length < 3) throw new BadRequestError('Please write a little more.');
  const open = await prisma.supportRequest.count({ where: { userId, status: 'open' } });
  if (open >= 5) throw new BadRequestError('You already have a few open requests — we will reply soon.');
  const created = await prisma.supportRequest.create({ data: { userId, topic: t, message: message.trim().slice(0, 4000) }, select: { id: true, status: true, createdAt: true } });
  Realtime.admin({ kind: 'support', text: t, id: created.id });
  return created;
}

export const mySupportRequests = (userId: string) =>
  prisma.supportRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, topic: true, message: true, status: true, reply: true, repliedAt: true, createdAt: true } });

// ── System ───────────────────────────────────────────────────────────────────

const timed = async <T>(fn: () => Promise<T>) => {
  const t = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t };
  } catch (err) {
    return { ok: false, ms: Date.now() - t, error: err instanceof Error ? err.message.slice(0, 120) : 'error' };
  }
};

export async function getSystem() {
  const [db, cache, ai, replies, openSafety, openSupport] = await Promise.all([
    timed(() => prisma.$queryRawUnsafe('SELECT 1')),
    timed(() => redis.ping()),
    prisma.$queryRawUnsafe<Array<{ calls: number; failed: number; avg_ms: number; last_ok: string | null; last_fail: string | null; last_cause: string | null }>>(
      `SELECT count(*)::int calls, count(*) FILTER (WHERE status = 'FAILED')::int failed,
              coalesce(avg(latency_ms) FILTER (WHERE status = 'SUCCESS' AND task IN ('chat','CHAT_STREAM')), 0)::int avg_ms,
              to_char(max(created_at) FILTER (WHERE status = 'SUCCESS'), 'YYYY-MM-DD"T"HH24:MI:SSOF') last_ok,
              to_char(max(created_at) FILTER (WHERE status = 'FAILED'), 'YYYY-MM-DD"T"HH24:MI:SSOF') last_fail,
              (array_agg(breakdown->>'cause' ORDER BY created_at DESC) FILTER (WHERE status = 'FAILED'))[1] last_cause
         FROM ai_usage_events WHERE provider = 'google' AND created_at >= now() - interval '1 hour'`,
    ),
    prisma.$queryRawUnsafe<Array<{ failed: number; total: number }>>(
      `SELECT count(*) FILTER (WHERE status = 'FAILED')::int failed, count(*)::int total FROM messages WHERE role = 'assistant' AND created_at >= now() - interval '24 hours'`,
    ),
    prisma.safetyMoment.count({ where: { resolvedAt: null, kind: { in: ['crisis', 'emergency'] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    prisma.supportRequest.count({ where: { status: 'open' } }),
  ]);
  const [errors, jobs, aiToday, versions, attention] = await Promise.all([
    recentErrors(15),
    jobStatus(),
    prisma.$queryRawUnsafe<Array<{ model: string; calls: number; failed: number; tokens: number; usd: number }>>(
      `SELECT model, count(*)::int calls, count(*) FILTER (WHERE status = 'FAILED')::int failed, coalesce(sum(total_tokens), 0)::bigint::float tokens,
              coalesce(sum(estimated_cost), 0)::float usd
         FROM ai_usage_events WHERE created_at >= $1 GROUP BY 1 ORDER BY 2 DESC`,
      istMidnight(0),
    ),
    // App versions people used in the last 30 days (one row per person: their newest device).
    prisma.$queryRawUnsafe<Array<{ platform: string; version: string | null; users: number }>>(
      `SELECT lower(d.platform) platform, d.app_version version, count(*)::int users FROM (
         SELECT DISTINCT ON (x.user_id) x.user_id, x.platform, x.app_version FROM (
           SELECT user_id, platform, app_version, last_seen_at FROM devices
           UNION ALL SELECT user_id, platform, app_version, last_seen_at FROM user_devices
         ) x JOIN users u ON u.id = x.user_id
         WHERE x.last_seen_at >= now() - interval '30 days' AND ${REAL_USERS}
         ORDER BY x.user_id, x.last_seen_at DESC
       ) d GROUP BY 1, 2 ORDER BY 3 DESC`,
    ),
    attentionCounts(),
  ]);
  const a = ai[0] ?? { calls: 0, failed: 0, avg_ms: 0, last_ok: null, last_fail: null, last_cause: null };
  const failRate = a.calls ? a.failed / a.calls : 0;
  const alerts: Array<{ level: 'bad' | 'warn'; text: string; href?: string }> = [];
  if (!db.ok) alerts.push({ level: 'bad', text: 'Database is not responding.' });
  if (!cache.ok) alerts.push({ level: 'bad', text: 'Redis is not responding (chat memory and limits depend on it).' });
  if (a.failed >= 3 && failRate > 0.2) alerts.push({ level: 'bad', text: `Gemini failed ${a.failed} of ${a.calls} times in the last hour — users see "can't reply right now". ${a.last_cause ?? ''}` });
  else if (a.failed > 0) alerts.push({ level: 'warn', text: `Gemini failed ${a.failed} times in the last hour.` });
  if (a.avg_ms > 15_000) alerts.push({ level: 'warn', text: `Replies are slow: ${Math.round(a.avg_ms / 1000)} s on average.` });
  if (openSafety > 0) alerts.push({ level: 'warn', text: `${openSafety} crisis/emergency moment(s) in the last 24 h not reviewed yet.`, href: '/safety' });
  if (openSupport > 0) alerts.push({ level: 'warn', text: `${openSupport} support request(s) waiting for a reply.`, href: '/support' });
  if (errors.lastHour >= 5) alerts.push({ level: 'warn', text: `${errors.lastHour} server errors in the last hour — see Recent errors below.` });
  if (attention.aiOverBudget) alerts.push({ level: 'warn', text: "Today's AI spend is over your daily budget.", href: '/ai-cost' });
  const lateJobs = jobs.filter((j) => j.late || !j.ok);
  if (!jobs.length) alerts.push({ level: 'warn', text: 'The background worker has never run (start it on the server with: pnpm --filter api start:worker). Without it, account deletions never happen.' });
  if (lateJobs.length) alerts.push({ level: 'warn', text: `Background job${lateJobs.length > 1 ? 's' : ''} not running: ${lateJobs.map((j) => j.name).join(', ')}. Account deletions wait until the worker runs.` });
  return {
    errors,
    jobs,
    worker: { seen: jobs.length > 0, running: jobs.length > 0 && jobs.some((j) => !j.late) },
    aiToday: aiToday.map((r) => ({ model: r.model, calls: r.calls, failed: r.failed, tokens: r.tokens })),
    appVersions: versions,
    services: {
      api: { ok: true, uptimeHours: Math.round((process.uptime() / 3600) * 10) / 10, memoryMb: Math.round(process.memoryUsage().rss / 1e6), node: process.version },
      database: db,
      redis: cache,
    },
    ai: { callsLastHour: a.calls, failedLastHour: a.failed, failRate, avgReplyMs: a.avg_ms, lastSuccess: a.last_ok, lastFailure: a.last_fail, lastCause: a.last_cause },
    replies24h: replies[0] ?? { failed: 0, total: 0 },
    alerts,
  };
}

// ── Promo codes ──────────────────────────────────────────────────────────────

export async function listPromos() {
  return prisma.billingPromotion.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { plan: { select: { code: true } } } });
}

export async function createPromo(adminId: string, input: { code: string; name: string; type: string; value: number; maxRedemptions?: number | null; validUntil?: string | null }) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new BadRequestError('Code: 3–30 letters, numbers, - or _.');
  if (!['PERCENTAGE', 'FREE_CREDITS', 'TRIAL_EXTENSION'].includes(input.type)) throw new BadRequestError('Unknown promo type');
  if (!(input.value > 0) || (input.type === 'PERCENTAGE' && input.value > 100)) throw new BadRequestError('Value is out of range');
  const plan = await prisma.billingPlan.findUnique({ where: { code: 'PREMIUM' } });
  const promo = await prisma.billingPromotion
    .create({
      data: {
        code,
        name: input.name.trim() || code,
        discountType: input.type as never,
        discountValue: input.value,
        planId: plan?.id,
        maxRedemptions: input.maxRedemptions ?? null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
      },
    })
    .catch((err: unknown) => {
      throw new BadRequestError(String(err).includes('Unique') ? 'That code already exists.' : 'Could not create the code.');
    });
  await audit(adminId, 'console.promo.created', 'PROMOTION', promo.id, { code, type: input.type, value: input.value });
  return promo;
}

export async function setPromoActive(adminId: string, id: string, active: boolean) {
  await prisma.billingPromotion.update({ where: { id }, data: { isActive: active } }).catch(() => {
    throw new NotFoundError('Code not found');
  });
  await audit(adminId, active ? 'console.promo.enabled' : 'console.promo.disabled', 'PROMOTION', id);
  return { ok: true };
}

// ── Team ─────────────────────────────────────────────────────────────────────

export async function listTeam() {
  const [admins, roles] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' }, include: { roles: { include: { role: { select: { name: true } } } } } }),
    prisma.adminRole.findMany({ select: { name: true, description: true }, orderBy: { name: 'asc' } }),
  ]);
  return {
    admins: admins.map((a) => ({ id: a.id, email: a.email, name: a.displayName, active: a.isActive, lastLogin: a.lastLoginAt, roles: a.roles.map((r) => r.role.name) })),
    roles,
  };
}

/** Creates an admin with a one-time password, shown once to the inviter. */
export async function inviteAdmin(adminId: string, email: string, name: string, role: string) {
  const roleRow = await prisma.adminRole.findUnique({ where: { name: role } });
  if (!roleRow) throw new BadRequestError('Unknown role');
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new BadRequestError('Enter a valid email.');
  const password = `${randomBytes(9).toString('base64url')}#A1`;
  const admin = await prisma.adminUser
    .create({
      data: {
        email: normalized,
        normalizedEmail: normalized,
        displayName: name.trim() || normalized.split('@')[0]!,
        passwordHash: await hashPassword(password),
        roles: { create: { roleId: roleRow.id } },
      } as never,
    })
    .catch((err: unknown) => {
      throw new BadRequestError(String(err).includes('Unique') ? 'An admin with this email already exists.' : 'Could not create the admin.');
    });
  await audit(adminId, 'console.team.invited', 'ADMIN', admin.id, { email: normalized, role });
  return { id: admin.id, email: normalized, temporaryPassword: password };
}

export async function setAdminActive(adminId: string, id: string, active: boolean) {
  if (id === adminId && !active) throw new BadRequestError("You can't disable your own account.");
  await prisma.adminUser.update({ where: { id }, data: { isActive: active } }).catch(() => {
    throw new NotFoundError('Admin not found');
  });
  if (!active) await prisma.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(adminId, active ? 'console.team.enabled' : 'console.team.disabled', 'ADMIN', id);
  return { ok: true };
}

export async function changeOwnPassword(adminId: string, current: string, next: string) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin || !(await verifyPassword(current, admin.passwordHash))) throw new BadRequestError('Your current password is wrong.');
  const strength = validatePasswordStrength(next);
  if (!strength.isValid) throw new BadRequestError(strength.message ?? 'Choose a stronger password.');
  await prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(next) } });
  await audit(adminId, 'console.team.password_changed', 'ADMIN', adminId);
  return { ok: true };
}

// ── Audit log ────────────────────────────────────────────────────────────────

export async function listAudit(params: { page?: number; action?: string }) {
  const size = 50;
  const page = Math.max(1, params.page ?? 1);
  const where = params.action ? { action: { contains: params.action } } : {};
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * size, take: size }),
    prisma.auditLog.count({ where }),
  ]);
  const adminIds = [...new Set(rows.filter((r) => r.actorType === 'ADMIN' && r.actorId).map((r) => r.actorId!))];
  const admins = new Map((await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })).map((a) => [a.id, a.email]));
  return {
    entries: rows.map((r) => ({ id: r.id, at: r.createdAt, actor: r.actorType === 'ADMIN' ? (admins.get(r.actorId ?? '') ?? 'admin') : r.actorType.toLowerCase(), action: r.action, resource: r.resourceType, resourceId: r.resourceId, metadata: r.metadata })),
    total,
    page,
    pageSize: size,
  };
}
