'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useFormState, useFormStatus } from 'react-dom';

import { registerUser, type SignupFormState } from './actions';

const initialState: SignupFormState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </button>
  );
}

export function SignupForm() {
  const [state, formAction] = useFormState(registerUser, initialState);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hasTriggeredSignin, setHasTriggeredSignin] = useState(false);

  useEffect(() => {
    if (state.status === 'success' && !hasTriggeredSignin) {
      setHasTriggeredSignin(true);

      void signIn('credentials', {
        email,
        password,
        callbackUrl: '/',
        redirect: true
      });
    }
  }, [state, email, password, hasTriggeredSignin]);

  return (
    <form className="auth-card" action={formAction}>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="How should we greet you?"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {state.status === 'error' ? <p className="form-error">{state.error}</p> : null}

      <SubmitButton />

      <p className="form-footnote">
        Already have an account? <Link href="/auth/login">Log in</Link>.
      </p>
    </form>
  );
}
