import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAdminSessionFromCookiesMock, redirectMock } = vi.hoisted(() => ({
  getAdminSessionFromCookiesMock: vi.fn(),
  redirectMock: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('../../../lib/admin-auth', () => ({ getAdminSessionFromCookies: getAdminSessionFromCookiesMock }));

import { requireAdminSession } from './admin-session';

describe('admin session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the admin session when present', async () => {
    getAdminSessionFromCookiesMock.mockResolvedValue({ adminId: 'admin_1', email: 'ops@knokio.test' });

    await expect(requireAdminSession()).resolves.toEqual({ adminId: 'admin_1', email: 'ops@knokio.test' });
  });

  it('redirects to admin login when no session exists', async () => {
    getAdminSessionFromCookiesMock.mockResolvedValue(null);

    await expect(requireAdminSession()).rejects.toThrow('REDIRECT:/admin/login');
    expect(redirectMock).toHaveBeenCalledWith('/admin/login');
  });
});
