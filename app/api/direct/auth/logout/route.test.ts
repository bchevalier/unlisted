import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/direct/auth/logout', () => {
  it('clears the keeper session cookie', async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
    expect(response.headers.get('set-cookie')).toContain('knokio_keeper_session=;');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
