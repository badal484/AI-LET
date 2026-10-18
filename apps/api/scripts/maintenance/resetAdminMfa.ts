/**
 * Turns off two-step sign-in for one admin (lost phone). Their next sign-in asks them to set it up again.
 *   DATABASE_URL=… ADMIN_EMAIL=… npx tsx scripts/maintenance/resetAdminMfa.ts
 * Writes to the database you point it at — for production, only with the owner's OK. Logged in the audit log.
 */
import { PrismaClient } from '@prisma/client';

const email = (process.env['ADMIN_EMAIL'] ?? '').trim().toLowerCase();
if (!email.includes('@')) throw new Error('Set ADMIN_EMAIL.');

const prisma = new PrismaClient();
const admin = await prisma.adminUser.findFirst({ where: { normalizedEmail: email, deletedAt: null }, select: { id: true } });
if (!admin) throw new Error(`No admin ${email}`);
await prisma.adminUser.update({ where: { id: admin.id }, data: { isMfaEnabled: false, mfaSecret: null } });
await prisma.auditLog.create({
  data: { actorType: 'SYSTEM', action: 'ADMIN_MFA_RESET', resourceType: 'AdminUser', resourceId: admin.id, metadata: { via: 'scripts/maintenance/resetAdminMfa.ts' } },
});
console.log(`Two-step sign-in reset for ${email}: they set it up again at the next sign-in.`);
await prisma.$disconnect();
