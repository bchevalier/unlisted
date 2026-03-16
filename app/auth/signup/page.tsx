import { SignupForm } from './signup-form';

export const metadata = {
  title: 'Create account | Knokio',
  description: 'Start protecting your contact details with Knokio.'
};

export default function SignupPage() {
  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <div className="auth-header">
        <div className="auth-badge">
          <span className="auth-mark" aria-hidden="true" />
          <span>Knokio</span>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          Build a single, controlled entry point for your inbound. You decide what you accept and how
          people reach you.
        </p>
        <div className="auth-details" aria-hidden="true">
          <div className="auth-detail">
            <span className="auth-dot" />
            <span>Start with safe defaults, refine later.</span>
          </div>
          <div className="auth-detail">
            <span className="auth-dot magenta" />
            <span>One door link instead of public email.</span>
          </div>
        </div>
      </div>

        <div className="auth-panel">
          <div className="auth-panel-header">
            <h2 className="auth-panel-title">Create account</h2>
            <p className="auth-panel-subtitle">It takes less than a minute.</p>
          </div>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
