import { LoginForm } from './login-form';

export const metadata = {
  title: 'Log in | Knokio',
  description: 'Access your Knokio account.'
};

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <div className="auth-header">
        <div className="auth-badge">
          <span className="auth-mark" aria-hidden="true" />
          <span>Knokio</span>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">
          Sign in to keep your door open to the right people — without putting your contact details on
          display.
        </p>
        <div className="auth-details" aria-hidden="true">
          <div className="auth-detail">
            <span className="auth-dot" />
            <span>Structured requests over open inbox noise.</span>
          </div>
          <div className="auth-detail">
            <span className="auth-dot magenta" />
            <span>Control when (or if) you reveal contact details.</span>
          </div>
        </div>
      </div>

        <div className="auth-panel">
          <div className="auth-panel-header">
            <h2 className="auth-panel-title">Sign in</h2>
            <p className="auth-panel-subtitle">Use your email and password to continue.</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
