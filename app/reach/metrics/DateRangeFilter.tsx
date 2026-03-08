'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Client component for selecting a date range on the metrics page.
 * Pushes `from` and `to` query params to trigger a server re-fetch.
 */
export default function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromValue = searchParams.get('from') ?? '';
  const toValue = searchParams.get('to') ?? '';

  const apply = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const from = fd.get('from') as string;
      const to = fd.get('to') as string;
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      router.push(`/reach/metrics${params.toString() ? '?' + params.toString() : ''}`);
    },
    [router],
  );

  const clear = useCallback(() => {
    router.push('/reach/metrics');
  }, [router]);

  return (
    <form className="reach-date-filter" onSubmit={apply}>
      <label htmlFor="metrics-from">From</label>
      <input type="date" id="metrics-from" name="from" defaultValue={fromValue} />
      <label htmlFor="metrics-to">To</label>
      <input type="date" id="metrics-to" name="to" defaultValue={toValue} />
      <button type="submit">Apply</button>
      {(fromValue || toValue) && (
        <button type="button" onClick={clear} style={{ background: '#6b7a9a' }}>
          Clear
        </button>
      )}
    </form>
  );
}
