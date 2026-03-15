#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

/**
 * One-time admin bootstrap.
 *
 * Promotes an existing regular User to SUPER_ADMIN by creating/updating
 * an admin_users row using the same password hash as the User record.
 *
 * Usage:
 *   npm run admin:bootstrap
 *   npm run admin:bootstrap -- --email you@example.com
 */

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

const explicitEmail = getArg('--email')?.trim().toLowerCase() ?? null;
const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? null;
const targetEmail = explicitEmail ?? envEmail;

if (!targetEmail) {
  console.error('❌ Missing admin email. Set ADMIN_EMAIL or pass --email <value>.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    throw new Error(
      `No regular user found for ${targetEmail}. Sign up first via normal flow, then rerun bootstrap.`
    );
  }

  if (!user.passwordHash) {
    throw new Error(
      `User ${targetEmail} has no password hash. Use password signup (or set a password) before admin bootstrap.`
    );
  }

  const admin = await prisma.adminUser.upsert({
    where: { email: targetEmail },
    update: {
      role: 'SUPER_ADMIN',
      disabled: false,
      passwordHash: user.passwordHash,
    },
    create: {
      email: targetEmail,
      role: 'SUPER_ADMIN',
      disabled: false,
      passwordHash: user.passwordHash,
    },
    select: {
      id: true,
      email: true,
      role: true,
      disabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log('✅ Admin bootstrap complete');
  console.log(`   userId: ${user.id}`);
  console.log(`   adminId: ${admin.id}`);
  console.log(`   email: ${admin.email}`);
  console.log(`   role: ${admin.role}`);
  console.log(`   disabled: ${admin.disabled}`);
  console.log('');
  console.log('You can now log in at /admin/login with the SAME password as the regular account.');
  console.log('ADMIN_PASSWORD_HASH is no longer required for steady-state login.');
}

main()
  .catch((error) => {
    console.error('❌ Admin bootstrap failed:', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
