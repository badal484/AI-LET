import { prisma } from '../../infrastructure/database/prisma.js';
import { getSetting } from './appSettings.js';
import { REAL_USERS } from './overview.service.js';

/**
 * Numbers for console → Notifications: who lets us notify them, and whether notifications bring people
 * back. Real users only, last 30 days.
 *
 * A notification's kind comes from its delivery key: reply_ (a character's reply after they left the
 * chat), proactive_ (a character texting first), camp_ (an admin campaign), anything else = other.
 * "Came back" = they sent a message within 6 hours of it (a reply to a text-first message, or simply
 * returning to chat after a reply / campaign).
 */

const KIND_SQL = `CASE WHEN l.idempotency_key LIKE 'reply\\_%' THEN 'reply'
                       WHEN l.idempotency_key LIKE 'proactive\\_%' THEN 'textFirst'
                       WHEN l.idempotency_key LIKE 'camp\\_%' THEN 'campaign'
                       ELSE 'other' END`;

export async function notificationStats() {
  const [permission] = await prisma.$queryRawUnsafe<Array<Record<string, number>>>(
    `WITH last AS (
       SELECT DISTINCT ON (d.user_id) d.user_id, d.push_permission_status s, d.is_active AND d.push_token IS NOT NULL live
         FROM user_devices d JOIN users u ON u.id = d.user_id
        WHERE u.status = 'ACTIVE' AND ${REAL_USERS}
        ORDER BY d.user_id, d.last_seen_at DESC)
     SELECT count(*)::int "withApp",
            count(*) FILTER (WHERE live AND s IN ('AUTHORIZED','PROVISIONAL'))::int allowed,
            count(*) FILTER (WHERE s = 'DENIED')::int denied,
            count(*) FILTER (WHERE NOT live)::int uninstalled
       FROM last`,
  );

  // One row per notification (the first device's log), with whether they came back.
  const kinds = await prisma.$queryRawUnsafe<Array<{ kind: string; sent: number; failed: number; opened: number; cameBack: number }>>(
    `WITH n AS (
       SELECT DISTINCT ON (l.user_id, regexp_replace(l.idempotency_key, '_[^_]+$', ''))
              l.user_id, l.sent_at, l.status, l.opened_at, ${KIND_SQL} kind
         FROM notification_delivery_logs l JOIN users u ON u.id = l.user_id
        WHERE l.sent_at > now() - interval '30 days' AND ${REAL_USERS}
          AND l.idempotency_key NOT LIKE 'camptest\\_%'
        ORDER BY l.user_id, regexp_replace(l.idempotency_key, '_[^_]+$', ''), l.opened_at NULLS LAST)
     SELECT kind,
            count(*) FILTER (WHERE status <> 'FAILED')::int sent,
            count(*) FILTER (WHERE status = 'FAILED')::int failed,
            count(*) FILTER (WHERE opened_at IS NOT NULL)::int opened,
            count(*) FILTER (WHERE status <> 'FAILED' AND EXISTS (
              SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
               WHERE c.user_id = n.user_id AND m.role = 'user' AND m.created_at > n.sent_at AND m.created_at < n.sent_at + interval '6 hours'))::int "cameBack"
       FROM n GROUP BY kind`,
  );

  const daily = await prisma.$queryRawUnsafe<Array<{ day: string; reply: number; textFirst: number; campaign: number; other: number }>>(
    `SELECT to_char(d::date, 'YYYY-MM-DD') "day",
            count(l.*) FILTER (WHERE ${KIND_SQL} = 'reply')::int reply,
            count(l.*) FILTER (WHERE ${KIND_SQL} = 'textFirst')::int "textFirst",
            count(l.*) FILTER (WHERE ${KIND_SQL} = 'campaign')::int campaign,
            count(l.*) FILTER (WHERE ${KIND_SQL} = 'other')::int other
       FROM generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 13, (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day') d
       LEFT JOIN (notification_delivery_logs l JOIN users u ON u.id = l.user_id AND ${REAL_USERS})
              ON (l.sent_at AT TIME ZONE 'Asia/Kolkata')::date = d::date AND l.status <> 'FAILED' AND l.idempotency_key NOT LIKE 'camptest\\_%'
      GROUP BY d ORDER BY d`,
  );

  // Texting first, per character: did people answer?
  const characters = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; avatarUrl: string | null; sent: number; replied: number }>>(
    `SELECT ch.id::text, ch.name, ch.avatar_url "avatarUrl", count(*)::int sent,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM messages r WHERE r.conversation_id = m.conversation_id AND r.role = 'user'
                                            AND r.created_at > m.created_at AND r.created_at < m.created_at + interval '24 hours'))::int replied
       FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN characters ch ON ch.id = c.character_id
       JOIN users u ON u.id = c.user_id
      WHERE m.is_proactive AND m.source = 'proactive' AND m.created_at > now() - interval '30 days' AND ${REAL_USERS}
      GROUP BY ch.id ORDER BY sent DESC LIMIT 20`,
  );

  const [today] = await prisma.$queryRawUnsafe<Array<{ n: number; people: number }>>(
    `SELECT count(*)::int n, count(DISTINCT c.user_id)::int people
       FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN users u ON u.id = c.user_id
      WHERE m.is_proactive AND m.source = 'proactive' AND ${REAL_USERS}
        AND m.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`,
  );

  const kind = (k: string) => {
    const r = kinds.find((x) => x.kind === k) ?? { sent: 0, failed: 0, opened: 0, cameBack: 0 };
    return { ...r, openRate: r.sent ? r.opened / r.sent : null, cameBackRate: r.sent ? r.cameBack / r.sent : null };
  };

  return {
    permission: {
      withApp: permission?.['withApp'] ?? 0,
      allowed: permission?.['allowed'] ?? 0,
      denied: permission?.['denied'] ?? 0,
      uninstalled: permission?.['uninstalled'] ?? 0,
      allowedRate: permission?.['withApp'] ? (permission['allowed'] ?? 0) / permission['withApp'] : null,
    },
    kinds: { reply: kind('reply'), textFirst: kind('textFirst'), campaign: kind('campaign'), other: kind('other') },
    daily,
    textFirst: {
      enabled: await getSetting('proactive.enabled'),
      dailyBudget: await getSetting('proactive.dailyBudget'),
      today: today?.n ?? 0,
      peopleToday: today?.people ?? 0,
      characters: characters.map((c) => ({ ...c, replyRate: c.sent ? c.replied / c.sent : null })),
    },
  };
}
