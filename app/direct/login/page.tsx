import Link from 'next/link';
import { ExternalProviderAuthForm } from '../external-provider-auth-form';
import { LoginForm } from './login-form';
import { PasswordRecoveryForm } from './password-recovery-form';

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const next = params.next ?? '/direct/inbox';

  return (
    <main>
      <h1>Keeper login</h1>
      <p>Sign in to manage your door, inbox, and Direct settings.</p>
      <LoginForm next={next} />
      <ExternalProviderAuthForm mode="login" next={next} />
      <PasswordRecoveryForm />
      <p>
        No account yet? <Link href="/direct/signup">Create one</Link>
      </p>
      <p>
        Need to verify email? <Link href="/direct/verify-email">Verify here</Link>
      </p>
    </main>
  );
}
