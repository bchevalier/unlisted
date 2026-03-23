// @ts-nocheck
import { DoorPlan } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  doorFindFirst,
  doorUpdate,
  doorSettingsUpsert,
  categoryUpdateMany,
  transaction,
} = vi.hoisted(() => {
  const doorFindFirst = vi.fn();
  const doorUpdate = vi.fn();
  const doorSettingsUpsert = vi.fn();
  const categoryUpdateMany = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) =>
    callback({
      door: { update: doorUpdate },
      doorSettings: { upsert: doorSettingsUpsert },
      category: { updateMany: categoryUpdateMany },
    })
  );

  return {
    doorFindFirst,
    doorUpdate,
    doorSettingsUpsert,
    categoryUpdateMany,
    transaction,
  };
});

vi.mock('../../../lib/db', () => ({
  db: {
    door: {
      findFirst: doorFindFirst,
    },
    doorSettings: {
      upsert: doorSettingsUpsert,
    },
    $transaction: transaction,
  },
}));

vi.mock('../../../lib/logger', () => ({
  logger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() })),
}));

vi.mock('../../../lib/metrics', () => ({
  increment: vi.fn(),
  startTimer: vi.fn(() => () => 0),
  METRIC: {},
}));

vi.mock('../../../lib/notifications', () => ({
  notifyKeeperNewRequest: vi.fn(),
  notifyKnockerAccepted: vi.fn(),
  notifyKnockerAutoReply: vi.fn(),
  notifyKnockerCompletionRequired: vi.fn(),
  notifyKnockerExpired: vi.fn(),
  sendBatch: vi.fn(),
}));

vi.mock('../../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn(),
}));

vi.mock('./verification', () => ({
  computeVerificationStatus: vi.fn(),
}));

import { DirectValidationError, updateDoorPlanForKeeper, updateDoorSettingsForKeeper } from './requests';

describe('updateDoorPlanForKeeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects free-to-paid switching when billing entitlement is inactive', async () => {
    doorFindFirst.mockResolvedValue({
      id: 'door_1',
      plan: DoorPlan.FREE,
      stripeSubscriptionStatus: null,
    });

    await expect(
      updateDoorPlanForKeeper('user_1', {
        doorSlug: 'john',
        plan: DoorPlan.PAID,
      })
    ).rejects.toMatchObject<Partial<DirectValidationError>>({
      message: 'Active billing is required before switching to Paid',
      statusCode: 403,
    });

    expect(transaction).not.toHaveBeenCalled();
  });

  it('allows switching to paid when billing entitlement is active', async () => {
    doorFindFirst.mockResolvedValue({
      id: 'door_1',
      plan: DoorPlan.FREE,
      stripeSubscriptionStatus: 'ACTIVE',
    });
    doorUpdate.mockResolvedValue(undefined);
    doorSettingsUpsert.mockResolvedValue(undefined);
    categoryUpdateMany.mockResolvedValue(undefined);

    const result = await updateDoorPlanForKeeper('user_1', {
      doorSlug: 'john',
      plan: DoorPlan.PAID,
    });

    expect(result).toEqual({ plan: DoorPlan.PAID });
    expect(transaction).toHaveBeenCalledOnce();
    expect(doorUpdate).toHaveBeenCalled();
    expect(doorSettingsUpsert).toHaveBeenCalled();
    expect(categoryUpdateMany).toHaveBeenCalled();
  });

  it('clears paid-only settings when switching back to free', async () => {
    doorFindFirst.mockResolvedValue({
      id: 'door_1',
      plan: DoorPlan.PAID,
      stripeSubscriptionStatus: 'CANCELED',
    });
    doorUpdate.mockResolvedValue(undefined);
    doorSettingsUpsert.mockResolvedValue(undefined);
    categoryUpdateMany.mockResolvedValue(undefined);

    const result = await updateDoorPlanForKeeper('user_1', {
      doorSlug: 'john',
      plan: DoorPlan.FREE,
    });

    expect(result).toEqual({ plan: DoorPlan.FREE });
    expect(doorSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          weeklyRequestCap: 50,
          paidQuoteAmountCents: null,
          paidQuoteCurrency: null,
          paidQuoteNote: null,
          quoteVisibleToVerifiedOrgsOnly: false,
          openToNonTargetedPaidReach: false,
        }),
      })
    );
  });
});

describe('updateDoorSettingsForKeeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips paid-only settings for free doors', async () => {
    doorFindFirst.mockResolvedValue({
      id: 'door_1',
      plan: DoorPlan.FREE,
    });
    doorSettingsUpsert.mockResolvedValue(undefined);

    await updateDoorSettingsForKeeper('user_1', {
      doorSlug: 'john',
      autoReplyEnabled: false,
      weeklyRequestCap: 10,
      revealMethod: 'NONE',
      revealValue: null,
      paidQuoteAmountCents: 50000,
      paidQuoteCurrency: 'USD',
      paidQuoteNote: 'Should not stick on free',
      quoteVisibleToVerifiedOrgsOnly: true,
      openToNonTargetedPaidReach: true,
    });

    expect(doorSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          weeklyRequestCap: 10,
          paidQuoteAmountCents: null,
          paidQuoteCurrency: null,
          paidQuoteNote: null,
          quoteVisibleToVerifiedOrgsOnly: false,
          openToNonTargetedPaidReach: false,
        }),
        create: expect.objectContaining({
          paidQuoteAmountCents: null,
          paidQuoteCurrency: null,
          paidQuoteNote: null,
          quoteVisibleToVerifiedOrgsOnly: false,
          openToNonTargetedPaidReach: false,
        }),
      })
    );
  });
});
