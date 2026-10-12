/**
 * Creates (or resets the password of) a super admin. Used by copyCatalog.sh; also handy if you're
 * locked out:  DATABASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… npx tsx scripts/maintenance/createAdmin.ts
 */
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { ADMIN_ROLES } from '@ai-companion/config';

const email = (process.env['ADMIN_EMAIL'] ?? '').trim().toLowerCase();
const password = process.env['ADMIN_PASSWORD'] ?? '';
if (!email.includes('@') || password.length < 12) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters).');

const prisma = new PrismaClient();
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
const admin = await prisma.adminUser.upsert({
  where: { email },
  create: { email, normalizedEmail: email, passwordHash, displayName: 'Owner', isActive: true },
  update: { passwordHash, isActive: true },
});
const role = await prisma.adminRole.findUnique({ where: { name: ADMIN_ROLES.SUPER_ADMIN } });
if (!role) throw new Error('No super_admin role in this database — copy the catalog first.');
await prisma.adminRoleAssignment.upsert({
  where: { adminId_roleId: { adminId: admin.id, roleId: role.id } },
  create: { adminId: admin.id, roleId: role.id },
  update: {},
});
console.log(`Admin ready: ${email}`);
await prisma.$disconnect();
