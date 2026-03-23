// @ts-nocheck
import {
  ContactRevealMethod,
  DoorPlan,
  RequestEventActor,
  RequestEventType,
  RequestSource,
  RequestStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  doorFindUnique,
  doorFindFirst,
  emailAliasFindUnique,
  blockedSenderFindUnique,
  requestCount,
  requestCreate,
  requestFindUnique,
  requestFindMany,
  requestUpdate,
  requestUpdateMany,
  requestGroupBy,
  requestEventCreateMany,
  transaction,
  loggerInfo,
  incrementMock,
  endTimerMock,
  verifyTurnstileTokenMock,
  notifyKeeperNewRequestMock,
  notifyKnockerAcceptedMock,
  notifyKnockerAutoReplyMock,
  notifyKnockerCompletionRequiredMock,
  notifyKnockerExpiredMock,
  sendBatchMock,
  computeVerificationStatusMock,
  hasPaidEntitlementMock,
} = vi.hoisted(() => {
  const doorFindUnique = vi.fn();
  const doorFindFirst = vi.fn();
  const emailAliasFindUnique = vi.fn();
  const blockedSenderFindUnique = vi.fn();
  const requestCount = vi.fn();
  const requestCreate = vi.fn();
  const requestFindUnique = vi.fn();
  const requestFindMany = vi.fn();
  const requestUpdate = vi.fn();
  const requestUpdateMany = vi.fn();
  const requestGroupBy = vi.fn();
  const requestEventCreateMany = vi.fn();
  const loggerInfo = vi.fn();
  const incrementMock = vi.fn();
  const endTimerMock = vi.fn();
  const verifyTurnstileTokenMock = vi.fn();
  const notifyKeeperNewRequestMock = vi.fn();
  const notifyKnockerAcceptedMock = vi.fn();
  const notifyKnockerAutoReplyMock = vi.fn();
  const notifyKnockerCompletionRequiredMock = vi.fn();
  const notifyKnockerExpiredMock = vi.fn();
  const sendBatchMock = vi.fn();
  const computeVerificationStatusMock = vi.fn();
  const hasPaidEntitlementMock = vi.fn();
  const transaction = vi.fn(async (callback) =>
    callback({
      request: { updateMany: requestUpdateMany },
      requestEvent: { createMany: requestEventCreateMany },
    })
  );

  return {
    doorFindUnique,
    doorFindFirst,
    emailAliasFindUnique,
    blockedSenderFindUnique,
    requestCount,
    requestCreate,
    requestFindUnique,
    requestFindMany,
    requestUpdate,
    requestUpdateMany,
    requestGroupBy,
    requestEventCreateMany,
    transaction,
    loggerInfo,
    incrementMock,
    endTimerMock,
    verifyTurnstileTokenMock,
    notifyKeeperNewRequestMock,
    notifyKnockerAcceptedMock,
    notifyKnockerAutoReplyMock,
    notifyKnockerCompletionRequiredMock,
    notifyKnockerExpiredMock,
    sendBatchMock,
    computeVerificationStatusMock,
    hasPaidEntitlementMock,
  };
});

vi.mock('../../../lib/db', () => ({
  db: {
    door: {
      findUnique: doorFindUnique,
      findFirst: doorFindFirst,
    },
    doorBlockedSender: {
      findUnique: blockedSenderFindUnique,
    },
    emailAlias: {
      findUnique: emailAliasFindUnique,
    },
    request: {
      count: requestCount,
      create: requestCreate,
      findUnique: requestFindUnique,
      findMany: requestFindMany,
      update: requestUpdate,
      updateMany: requestUpdateMany,
      groupBy: requestGroupBy,
    },
    requestEvent: {
      createMany: requestEventCreateMany,
    },
    $transaction: transaction,
  },
}));

vi.mock('../../../lib/logger', () => ({
  logger: vi.fn(() => ({ info: loggerInfo, warn: vi.fn(), error: vi.fn(), child: vi.fn() })),
}));

vi.mock('../../../lib/metrics', () => ({
  increment: incrementMock,
  startTimer: vi.fn(() => endTimerMock),
  METRIC: {
    REQUEST_CREATION_MS: 'REQUEST_CREATION_MS',
    REQUEST_FORM_CREATED: 'REQUEST_FORM_CREATED',
    REQUEST_EMAIL_CREATED: 'REQUEST_EMAIL_CREATED',
    REQUEST_ACCEPTED: 'REQUEST_ACCEPTED',
    REQUEST_DECLINED: 'REQUEST_DECLINED',
    REQUEST_EXPIRED: 'REQUEST_EXPIRED',
    EMAIL_INBOUND_RECEIVED: 'EMAIL_INBOUND_RECEIVED',
    EMAIL_INBOUND_REJECTED: 'EMAIL_INBOUND_REJECTED',
    HONEYPOT_TRIGGERED: 'HONEYPOT_TRIGGERED',
  },
}));

vi.mock('../../../lib/notifications', () => ({
  notifyKeeperNewRequest: notifyKeeperNewRequestMock,
  notifyKnockerAccepted: notifyKnockerAcceptedMock,
  notifyKnockerAutoReply: notifyKnockerAutoReplyMock,
  notifyKnockerCompletionRequired: notifyKnockerCompletionRequiredMock,
  notifyKnockerExpired: notifyKnockerExpiredMock,
  sendBatch: sendBatchMock,
}));

vi.mock('../../../lib/turnstile', () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

vi.mock('./billing', () => ({
  hasPaidEntitlement: hasPaidEntitlementMock,
}));

vi.mock('./verification', () => ({
  computeVerificationStatus: computeVerificationStatusMock,
}));

import {
  createEmailRequest,
  createFormRequest,
  expireStaleRequests,
  updateRequestStatusForKeeper,
} from './requests';

describe('requests helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verifyTurnstileTokenMock.mockResolvedValue({ ok: true });
    blockedSenderFindUnique.mockResolvedValue(null);
    requestCount.mockResolvedValue(0);
    requestGroupBy.mockResolvedValue([]);
    notifyKeeperNewRequestMock.mockResolvedValue(undefined);
    notifyKnockerAcceptedMock.mockResolvedValue(undefined);
    notifyKnockerAutoReplyMock.mockResolvedValue(undefined);
    notifyKnockerCompletionRequiredMock.mockResolvedValue(undefined);
    notifyKnockerExpiredMock.mockResolvedValue(undefined);
    sendBatchMock.mockResolvedValue(undefined);
    computeVerificationStatusMock.mockResolvedValue({
      status: 'BASIC_VERIFIED',
      reason: 'matched domain signals',
    });
    hasPaidEntitlementMock.mockResolvedValue(false);
    process.env.APP_URL = 'https://app.knokio.test';
  });

  it('creates paid form requests directly with sanitized fields and requester verification', async () => {
    doorFindUnique.mockResolvedValue({
      id: 'door_1',
      slug: 'john',
      displayName: 'John Direct',
      isEnabled: true,
      plan: DoorPlan.PAID,
      user: { email: 'john@example.com' },
      settings: { weeklyRequestCap: 50, notifyNewRequest: true },
      categories: [
        {
          id: 'cat_1',
          key: 'brand-deals',
          weeklyCap: 20,
          fields: [
            {
              key: 'website',
              label: 'Website',
              type: 'URL',
              required: true,
            },
          ],
        },
      ],
    });
    requestCreate.mockResolvedValue({
      id: 'req_1',
      requestToken: 'req_token_123',
      status: RequestStatus.PENDING,
      requesterVerificationStatus: 'BASIC_VERIFIED',
    });

    const result = await createFormRequest(
      {
        doorSlug: 'john',
        categoryKey: 'brand-deals',
        senderName: ' Maya ',
        senderEmail: 'MAYA@EXAMPLE.COM',
        title: ' Big campaign ',
        message: 'We would like to work together.',
        fields: { website: 'https://brand.example' },
        requesterType: 'ORGANIZATION',
        requesterOrgName: ' Brand Co ',
        requesterOrgWebsite: ' https://brand.example ',
        requesterRoleTitle: ' Partnerships ',
      },
      { cfTurnstileToken: 'turnstile-token', ipAddress: null, honeypot: '' }
    );

    expect(result).toEqual({
      id: 'req_1',
      requestToken: 'req_token_123',
      status: RequestStatus.PENDING,
      requesterVerificationStatus: 'BASIC_VERIFIED',
    });
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith('turnstile-token', null);
    expect(computeVerificationStatusMock).toHaveBeenCalledWith({
      senderEmail: 'MAYA@EXAMPLE.COM',
      requesterType: 'ORGANIZATION',
      requesterOrgName: 'Brand Co',
      requesterOrgWebsite: 'https://brand.example',
      requesterRoleTitle: 'Partnerships',
    });
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          doorId: 'door_1',
          categoryId: 'cat_1',
          source: RequestSource.FORM,
          status: RequestStatus.PENDING,
          senderName: 'Maya',
          senderEmail: 'MAYA@EXAMPLE.COM',
          title: 'Big campaign',
          structuredData: { website: 'https://brand.example' },
          requesterType: 'ORGANIZATION',
          requesterOrgName: 'Brand Co',
          requesterOrgWebsite: 'https://brand.example',
          requesterRoleTitle: 'Partnerships',
          requesterVerificationStatus: 'BASIC_VERIFIED',
          requesterVerificationReason: 'matched domain signals',
          events: {
            create: {
              type: RequestEventType.CREATED,
              actor: RequestEventActor.SYSTEM,
              note: 'Form submission created request',
            },
          },
        }),
      })
    );
    expect(notifyKeeperNewRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keeperEmail: 'john@example.com',
        doorSlug: 'john',
        senderName: 'Maya',
        senderEmail: 'MAYA@EXAMPLE.COM',
        title: 'Big campaign',
      })
    );
    expect(incrementMock).toHaveBeenCalledWith('REQUEST_FORM_CREATED');
    expect(endTimerMock).toHaveBeenCalled();
  });

  it('creates inbound email requests that require completion when categories have required fields', async () => {
    emailAliasFindUnique.mockResolvedValue({
      alias: 'john',
      isEnabled: true,
      door: {
        id: 'door_1',
        slug: 'john',
        isEnabled: true,
        plan: DoorPlan.PAID,
        displayName: 'John Direct',
        user: { email: 'john@example.com' },
        settings: {
          weeklyRequestCap: 50,
          autoReplyEnabled: true,
          autoReplyMessage: 'Thanks for reaching out',
          notifyNewRequest: true,
        },
        categories: [
          {
            id: 'cat_1',
            key: 'brand-deals',
            label: 'Brand deals',
            fields: [{ key: 'budget', required: true }],
          },
        ],
      },
    });
    requestCreate.mockResolvedValue({
      id: 'req_email_1',
      requestToken: 'req_email_token',
      status: RequestStatus.AWAITING_COMPLETION,
      completionToken: 'stored_completion_token',
    });

    const result = await createEmailRequest({
      to: 'John <john@inbound.knokio.test>',
      from: 'Maya <maya@example.com>',
      subject: 'Partnership idea',
      text: 'Need details from you first.\n\nOn Mon wrote:\nquoted reply',
    });

    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          doorId: 'door_1',
          source: RequestSource.EMAIL,
          status: RequestStatus.AWAITING_COMPLETION,
          senderName: 'Maya',
          senderEmail: 'maya@example.com',
          title: 'Partnership idea',
          message: 'Need details from you first.',
          requesterType: 'INDIVIDUAL',
          requesterVerificationStatus: 'BASIC_VERIFIED',
          requesterVerificationReason: 'matched domain signals',
          structuredData: {
            _emailMeta: {
              to: 'John <john@inbound.knokio.test>',
              from: 'Maya <maya@example.com>',
              alias: 'john',
            },
          },
        }),
      })
    );
    expect(result).toMatchObject({
      id: 'req_email_1',
      requestToken: 'req_email_token',
      status: RequestStatus.AWAITING_COMPLETION,
      completionRequired: true,
    });
    expect(result.completionUrl).toMatch(/^https:\/\/app\.knokio\.test\/complete\/[a-f0-9]{64}$/);
    expect(notifyKnockerCompletionRequiredMock).toHaveBeenCalledWith(
      expect.objectContaining({
        knockerEmail: 'maya@example.com',
        doorName: 'John Direct',
        subject: 'Partnership idea',
      })
    );
    expect(notifyKeeperNewRequestMock).not.toHaveBeenCalled();
    expect(notifyKnockerAutoReplyMock).not.toHaveBeenCalled();
    expect(incrementMock).toHaveBeenCalledWith('EMAIL_INBOUND_RECEIVED');
    expect(incrementMock).toHaveBeenCalledWith('REQUEST_EMAIL_CREATED');
    expect(endTimerMock).toHaveBeenCalled();
  });

  it('accepts keeper-owned requests, snapshots quote settings, and notifies the sender', async () => {
    requestFindUnique.mockResolvedValue({
      id: 'req_1',
      status: RequestStatus.PENDING,
      senderEmail: 'maya@example.com',
      requestToken: 'req_token_123',
      door: {
        userId: 'user_1',
        slug: 'john',
        displayName: 'John Direct',
        settings: {
          revealMethod: ContactRevealMethod.EMAIL,
          revealValue: 'john@example.com',
          paidQuoteAmountCents: 500000,
          paidQuoteCurrency: 'USD',
          paidQuoteNote: 'Budget starts here',
        },
      },
    });
    requestUpdate.mockResolvedValue({ id: 'req_1', status: RequestStatus.ACCEPTED });

    const result = await updateRequestStatusForKeeper('user_1', 'req_1', {
      status: RequestStatus.ACCEPTED,
      note: ' Strong fit ',
    });

    expect(result).toEqual({ id: 'req_1', status: RequestStatus.ACCEPTED });
    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: {
        status: RequestStatus.ACCEPTED,
        keeperQuoteAmountCents: 500000,
        keeperQuoteCurrency: 'USD',
        keeperQuoteNote: 'Budget starts here',
        events: {
          create: {
            type: RequestEventType.ACCEPTED,
            actor: RequestEventActor.KEEPER,
            note: 'Strong fit',
          },
        },
      },
      select: { id: true, status: true },
    });
    expect(notifyKnockerAcceptedMock).toHaveBeenCalledWith({
      knockerEmail: 'maya@example.com',
      doorName: 'John Direct',
      requestToken: 'req_token_123',
      revealMethod: ContactRevealMethod.EMAIL,
      revealValue: 'john@example.com',
      keeperNote: 'Strong fit',
    });
    expect(incrementMock).toHaveBeenCalledWith('REQUEST_ACCEPTED');
    expect(loggerInfo).toHaveBeenCalledWith('Request accepted', {
      requestId: 'req_1',
      doorSlug: 'john',
    });
  });

  it('expires stale pending and awaiting-completion requests in one transaction and batches notifications', async () => {
    requestFindMany
      .mockResolvedValueOnce([
        {
          id: 'req_pending_1',
          senderEmail: 'maya@example.com',
          requestToken: 'token_pending_1',
          door: { displayName: 'John Direct' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'req_awaiting_1',
          senderEmail: 'sam@example.com',
          requestToken: 'token_awaiting_1',
          door: { displayName: 'John Direct' },
        },
      ]);
    requestUpdateMany.mockResolvedValue({ count: 2 });
    requestEventCreateMany.mockResolvedValue({ count: 2 });

    const result = await expireStaleRequests({ expiryDays: 30, batchSize: 100 });

    expect(result).toEqual({ expired: 2 });
    expect(transaction).toHaveBeenCalledOnce();
    expect(requestUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['req_pending_1', 'req_awaiting_1'] },
        status: { in: [RequestStatus.PENDING, RequestStatus.AWAITING_COMPLETION] },
      },
      data: expect.objectContaining({
        status: RequestStatus.EXPIRED,
        completionToken: null,
        completionExpiresAt: null,
        updatedAt: expect.any(Date),
      }),
    });
    expect(requestEventCreateMany).toHaveBeenCalledWith({
      data: [
        {
          requestId: 'req_pending_1',
          type: RequestEventType.EXPIRED,
          actor: RequestEventActor.SYSTEM,
          note: 'Auto-expired after 30 days',
        },
        {
          requestId: 'req_awaiting_1',
          type: RequestEventType.EXPIRED,
          actor: RequestEventActor.SYSTEM,
          note: 'Auto-expired after 30 days',
        },
      ],
    });
    expect(sendBatchMock).toHaveBeenCalledTimes(1);
    expect(sendBatchMock.mock.calls[0][0]).toHaveLength(2);
    expect(sendBatchMock.mock.calls[0][1]).toBe(5);
    expect(incrementMock).toHaveBeenCalledWith('REQUEST_EXPIRED', 2);
    expect(loggerInfo).toHaveBeenCalledWith('Expired stale requests', {
      expired: 2,
      expiryDays: 30,
    });
  });
});
