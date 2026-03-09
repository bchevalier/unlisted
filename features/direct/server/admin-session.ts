import { redirect } from 'next/navigation';
import { getAdminSessionFromCookies } from '../../../lib/admin-auth';

export async function requireAdminSession() {
  const session = await getAdminSessionFromCookies();

  if (!session) {
    redirect('/admin/login');
  }

  return session;
}
