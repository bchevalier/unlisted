import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getKeeperSessionFromCookiesMock, redirectMock } = vi.hoisted(() => ({
  getKeeperSessionFromCookiesMock: vi.fn(),
  redirectMock: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('../../../lib/keeper-auth', () => ({ getKeeperSessionFromCookies: getKeeperSessionFromCookiesMock }));

import { requireKeeperSession } from './session';

describe('session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the keeper session when present', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue({ userId: 'user_1', email: 'john@example.com' });

    await expect(requireKeeperSession('/direct/inbox')).resolves.toEqual({ userId: 'user_1', email: 'john@example.com' });
  });

  it('redirects to login with next path when no session exists', async () => {
    getKeeperSessionFromCookiesMock.mockResolvedValue(null);

    await expect(requireKeeperSession('/direct/inbox')).rejects.toThrow('REDIRECT:/direct/login?next=%2Fdirect%2Finbox');
    expect(redirectMock).toHaveBeenCalledWith('/direct/login?next=%2Fdirect%2Finbox');
  });
});
