'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type UserAdminActionsProps = {
  userId: string;
  email: string;
  isDisabled: boolean;
};

export function UserAdminActions({ userId, email, isDisabled }: UserAdminActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: 'disable' | 'enable') {
    const verb = action === 'disable' ? 'disable' : 'enable';
    if (!confirm(`${verb} user ${email}?`)) return;

    setLoading(true);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {isDisabled ? (
        <button
          onClick={() => handleAction('enable')}
          disabled={loading}
          style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
        >
          {loading ? 'Processing…' : 'Re-enable User'}
        </button>
      ) : (
        <button
          onClick={() => handleAction('disable')}
          disabled={loading}
          style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
        >
          {loading ? 'Processing…' : 'Disable User'}
        </button>
      )}
    </div>
  );
}
