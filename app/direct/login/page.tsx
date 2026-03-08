import Link from 'next/link';
import { LoginForm } from './login-form';

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
      <p>
        No account yet? <Link href="/direct/signup">Create one</Link>
      </p>
    </main>
  );
}
