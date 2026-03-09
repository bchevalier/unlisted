import { redirect } from 'next/navigation';
import { getAdminSessionFromCookies } from '../../../lib/admin-auth';
import { AdminLoginForm } from './admin-login-form';

export default async function AdminLoginPage() {
  const session = await getAdminSessionFromCookies();
  if (session) {
    redirect('/admin');
  }

  return (
    <main>
      <AdminLoginForm />
    </main>
  );
}
