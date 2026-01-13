import { SignupForm } from './signup-form';

export const metadata = {
  title: 'Create account | Knokio',
  description: 'Start protecting your contact details with Knokio.'
};

export default function SignupPage() {
  return (
    <main className="auth-layout">
      <div className="auth-header">
        <p className="eyebrow">Knokio</p>
        <h1>Create your account</h1>
        <p className="lede">
          Set up Knokio so people can reach you on your terms. You can tighten your settings anytime.
        </p>
      </div>

      <SignupForm />
    </main>
  );
}
