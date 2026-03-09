'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type RequestAdminActionsProps = {
  requestId: string;
  title: string;
};

export function RequestAdminActions({ requestId, title }: RequestAdminActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete request "${title || requestId}"? This cannot be undone.`)) return;

    setLoading(true);
    try {
      await fetch(`/api/admin/requests/${requestId}`, {
        method: 'DELETE',
      });
      router.push('/admin/requests');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      style={{
        padding: '0.5rem 1rem',
        background: '#dc3545',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        borderRadius: '4px',
        marginTop: '1rem',
      }}
    >
      {loading ? 'Deleting…' : 'Delete Request'}
    </button>
  );
}
