'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/direct/auth/logout', { method: 'POST' });
        router.push('/direct');
        router.refresh();
      }}
    >
      Logout
    </button>
  );
}
