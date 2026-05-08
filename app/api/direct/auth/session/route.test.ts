import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getKeeperSessionFromRequestMock } = vi.hoisted(() => ({
  getKeeperSessionFromRequestMock: vi.fn(),
}));

vi.mock('../../../../../lib/keeper-auth', () => ({
  getKeeperSessionFromRequest: getKeeperSessionFromRequestMock,
}));

import { GET } from './route';

describe('GET /api/direct/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns authenticated:false when no keeper session exists', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/direct/auth/session'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, authenticated: false });
  });

  it('returns the authenticated keeper session payload', async () => {
    getKeeperSessionFromRequestMock.mockReturnValue({ userId: 'user_1', email: 'john@example.com' });

    const response = await GET(new Request('http://localhost/api/direct/auth/session'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      authenticated: true,
      keeper: { userId: 'user_1', email: 'john@example.com' },
    });
  });
});
