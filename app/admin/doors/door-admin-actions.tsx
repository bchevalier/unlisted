'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DoorAdminActionsProps = {
  doorId: string;
  slug: string;
  isEnabled: boolean;
};

export function DoorAdminActions({ doorId, slug, isEnabled }: DoorAdminActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: 'suspend' | 'unsuspend') {
    const verb = action === 'suspend' ? 'suspend' : 'unsuspend';
    if (!confirm(`${verb} door "${slug}"?`)) return;

    setLoading(true);
    try {
      await fetch(`/api/admin/doors/${doorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (isEnabled) {
    return (
      <button
        onClick={() => handleAction('suspend')}
        disabled={loading}
        style={{ padding: '0.25rem 0.75rem', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '3px', fontSize: '0.8rem' }}
      >
        {loading ? '…' : 'Suspend'}
      </button>
    );
  }

  return (
    <button
      onClick={() => handleAction('unsuspend')}
      disabled={loading}
      style={{ padding: '0.25rem 0.75rem', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '3px', fontSize: '0.8rem' }}
    >
      {loading ? '…' : 'Unsuspend'}
    </button>
  );
}
