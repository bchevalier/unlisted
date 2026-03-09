import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '../../../../../lib/admin-auth';
import { logAdminAction, isValidEntityId } from '../../../../../lib/admin-audit';
import { db } from '../../../../../lib/db';

type RouteContext = { params: Promise<{ adminId: string }> };

/**
 * PATCH /api/admin/admin-users/:adminId — Update an admin user (disable/enable, change role).
 * Requires: SUPER_ADMIN role.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isSuperAdmin =
    session.adminRole === 'SUPER_ADMIN' ||
    (!session.adminRole && session.email === process.env.ADMIN_EMAIL?.trim().toLowerCase());

  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden: requires SUPER_ADMIN role' }, { status: 403 });
  }

  const { adminId } = await context.params;
  if (!isValidEntityId(adminId)) {
    return NextResponse.json({ error: 'Invalid admin ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.disabled === 'boolean') {
      updateData.disabled = body.disabled;
    }

    if (body.role && ['ADMIN', 'SUPER_ADMIN'].includes(body.role)) {
      updateData.role = body.role;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const admin = await db.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
    }

    // Prevent self-disable
    if (updateData.disabled === true && admin.email === session.email) {
      return NextResponse.json({ error: 'Cannot disable your own account' }, { status: 400 });
    }

    const updated = await db.adminUser.update({
      where: { id: adminId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        disabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    logAdminAction({
      adminEmail: session.email,
      action: 'admin_user_updated',
      targetType: 'admin_user',
      targetId: adminId,
      details: updateData,
      ip,
    });

    return NextResponse.json({ admin: updated });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/admin-users/:adminId — Delete an admin user.
 * Requires: SUPER_ADMIN role.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isSuperAdmin =
    session.adminRole === 'SUPER_ADMIN' ||
    (!session.adminRole && session.email === process.env.ADMIN_EMAIL?.trim().toLowerCase());

  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden: requires SUPER_ADMIN role' }, { status: 403 });
  }

  const { adminId } = await context.params;
  if (!isValidEntityId(adminId)) {
    return NextResponse.json({ error: 'Invalid admin ID' }, { status: 400 });
  }

  try {
    const admin = await db.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
    }

    // Prevent self-deletion
    if (admin.email === session.email) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await db.adminUser.delete({ where: { id: adminId } });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    logAdminAction({
      adminEmail: session.email,
      action: 'admin_user_deleted',
      targetType: 'admin_user',
      targetId: adminId,
      details: { deletedEmail: admin.email },
      ip,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
