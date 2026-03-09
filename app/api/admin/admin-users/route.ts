import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { logAdminAction } from '../../../../lib/admin-audit';
import { db } from '../../../../lib/db';
import { captureException } from '../../../../lib/error-tracking';
import { logger } from '../../../../lib/logger';

const log = logger('admin:admin-users');

/**
 * GET /api/admin/admin-users — List all admin users.
 * Requires: authenticated admin session (any role).
 */
export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admins = await db.adminUser.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      disabled: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ admins });
}

/**
 * POST /api/admin/admin-users — Create a new admin user.
 * Requires: SUPER_ADMIN role (checked via session payload or env-var admin).
 */
export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only SUPER_ADMIN can create new admins
  const isSuperAdmin =
    session.adminRole === 'SUPER_ADMIN' ||
    // Env-var bootstrap admin is implicitly SUPER_ADMIN
    (!session.adminRole && session.email === process.env.ADMIN_EMAIL?.trim().toLowerCase());

  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden: requires SUPER_ADMIN role' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, role } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid input types' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (password.length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
    }

    const validRoles = ['ADMIN', 'SUPER_ADMIN'];
    const adminRole = role && validRoles.includes(role) ? role : 'ADMIN';

    // Check for existing admin
    const existing = await db.adminUser.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json({ error: 'Admin user with this email already exists' }, { status: 409 });
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await db.adminUser.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: adminRole,
      },
      select: {
        id: true,
        email: true,
        role: true,
        disabled: true,
        createdAt: true,
      },
    });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    logAdminAction({
      adminEmail: session.email,
      action: 'admin_user_created',
      targetType: 'admin_user',
      targetId: admin.id,
      details: { newAdminEmail: admin.email, role: admin.role },
      ip,
    });

    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    log.error('Admin user creation failed', { error });
    await captureException(error, { component: 'admin:admin-users' });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
