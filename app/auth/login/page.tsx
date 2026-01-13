import { LoginForm } from './login-form';

export const metadata = {
  title: 'Log in | Knokio',
  description: 'Access your Knokio account.'
};

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <div className="auth-header">
        <p className="eyebrow">Knokio</p>
        <h1>Welcome back</h1>
        <p className="lede">
          Log in to manage your door, set limits, and keep your contact details private.
        </p>
      </div>

      <LoginForm />
    </main>
  );
}
