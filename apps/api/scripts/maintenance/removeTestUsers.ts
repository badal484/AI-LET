/**
 * Removes test users (Google Cloud Test Lab, Play Review accounts, eval accounts, etc.).
 *
 * Usage:
 *   npx tsx scripts/maintenance/removeTestUsers.ts           # dry run: lists matching test users
 *   npx tsx scripts/maintenance/removeTestUsers.ts --apply   # permanently erases them and their data
 */
import 'dotenv/config';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { TEST_USERS } from '../../src/modules/console/overview.service.js';
import { AccountDeletionService } from '../../src/modules/privacy/services/AccountDeletionService.js';

const apply = process.argv.includes('--apply');

async function main() {
  const users = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; name: string | null; status: string; created_at: Date }>>(
    `SELECT u.id, u.email, pr.display_name AS name, u.status::text, u.created_at
       FROM users u
       LEFT JOIN user_profiles pr ON pr.user_id = u.id
      WHERE u.status <> 'DELETED' AND ${TEST_USERS}
      ORDER BY u.created_at DESC`
  );

  console.log(`Found ${users.length} active test user account(s):`);
  for (const u of users) {
    console.log(`- ${u.name ?? 'No name'} (${u.email}) [ID: ${u.id}, status: ${u.status}, joined: ${new Date(u.created_at).toISOString()}]`);
  }

  if (users.length === 0) {
    console.log('No test accounts found to remove.');
    return;
  }

  if (!apply) {
    console.log('\n(Dry run complete. Run with --apply to permanently delete these test accounts.)');
    return;
  }

  console.log('\nDeleting test accounts...');
  for (const u of users) {
    try {
      let req = await prisma.accountDeletionRequest.findFirst({ where: { userId: u.id, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } } });
      if (!req) {
        req = await prisma.accountDeletionRequest.create({
          data: {
            userId: u.id,
            status: 'PENDING',
            reason: 'Maintenance: removeTestUsers script',
            scheduledFor: new Date(),
            anonymizeFinancialRecords: true,
          },
        });
      }
      await AccountDeletionService.process(req.id);
      console.log(`✓ Deleted user ${u.email} (${u.id})`);
    } catch (err) {
      console.error(`✗ Failed to delete user ${u.email} (${u.id}):`, err);
    }
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

