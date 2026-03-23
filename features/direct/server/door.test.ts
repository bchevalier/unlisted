import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    door: { findUnique: vi.fn() },
  },
}));

vi.mock('../../../lib/db', () => ({ db: dbMock }));

import { getPublicDoorBySlug } from './door';

describe('door helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for missing or disabled public doors', async () => {
    dbMock.door.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ isEnabled: false });

    await expect(getPublicDoorBySlug('missing')).resolves.toBeNull();
    await expect(getPublicDoorBySlug('disabled')).resolves.toBeNull();
  });

  it('maps enabled public door data into the public door shape', async () => {
    dbMock.door.findUnique.mockResolvedValue({
      id: 'door_1',
      slug: 'john',
      displayName: 'John',
      headline: 'Brand partnerships only',
      isEnabled: true,
      plan: 'PAID',
      categories: [
        {
          key: 'brand-deals',
          label: 'Brand deals',
          description: 'Serious inbound only',
          fields: [
            {
              key: 'budget',
              label: 'Budget',
              type: 'NUMBER',
              required: true,
              placeholder: '5000',
            },
          ],
        },
      ],
    });

    const door = await getPublicDoorBySlug('john');

    expect(door).toEqual({
      id: 'door_1',
      slug: 'john',
      displayName: 'John',
      headline: 'Brand partnerships only',
      isPaidDoor: true,
      categories: [
        {
          key: 'brand-deals',
          label: 'Brand deals',
          description: 'Serious inbound only',
          fields: [
            {
              key: 'budget',
              label: 'Budget',
              type: 'NUMBER',
              required: true,
              placeholder: '5000',
            },
          ],
        },
      ],
    });
  });
});
