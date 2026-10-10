/**
 * What would the text-first round do for one person right now? Nothing is sent.
 *   npx tsx scripts/notifications/textFirstDryRun.ts user@example.com
 */
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { decideFor, ignoredStreak, usualHours } from '../../src/modules/notifications/services/proactiveRound.service.js';
import { NotificationService } from '../../src/modules/notifications/services/notification.service.js';

const email = process.argv[2];
if (!email) throw new Error('Usage: textFirstDryRun.ts <email>');
const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
const prefs = await NotificationService.getUserPreferences(user.id);
const tz = prefs.timezone && prefs.timezone !== 'UTC' ? prefs.timezone : 'Asia/Kolkata';
console.log('time zone', tz, '| usual hours', (await usualHours(user.id, tz)).join(','));
console.log('ignored streak', await ignoredStreak(user.id));
console.log('decision', await decideFor(user.id, { dryRun: true }));
await prisma.$disconnect();
process.exit(0);
