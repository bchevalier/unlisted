'use client';

import { useTransition } from 'react';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(() => {
      void signOut({ callbackUrl: '/' });
    });
  };

  return (
    <button className="button secondary" type="button" onClick={handleSignOut} disabled={isPending}>
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
