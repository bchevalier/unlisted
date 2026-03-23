import { RequestStatus } from '@prisma/client';

export const DIRECT_DEMO_FIXTURE_QUERY_VALUE = 'demo';
export const DIRECT_DEMO_SLUG = 'john';

const DEMO_PAGE_SIZE = 10;

const DEMO_DOOR_SETTINGS = {
  autoReplyEnabled: true,
  autoReplyMessage: 'Thanks — Direct needs a little more detail before this reaches the inbox.',
  weeklyRequestCap: 50,
  revealMethod: 'EMAIL',
  revealValue: 'john@knokio.example',
  notifyNewRequest: true,
  notifyDigest: false,
  paidQuoteAmountCents: 15000,
  paidQuoteCurrency: 'USD',
  paidQuoteNote: 'Paid advisory starts here when the brief is a fit.',
  quoteVisibleToVerifiedOrgsOnly: true,
  openToNonTargetedPaidReach: false,
} as const;

const DEMO_CATEGORIES = [
  {
    key: 'brand-deals',
    label: 'Brand deals',
    isEnabled: true,
    weeklyCap: 10,
    fields: [
      { key: 'budget', label: 'Budget', required: true },
      { key: 'timeline', label: 'Timeline', required: true },
      { key: 'brief', label: 'Brief', required: true },
    ],
  },
  {
    key: 'advisory',
    label: 'Advisory',
    isEnabled: true,
    weeklyCap: 5,
    fields: [
      { key: 'topic', label: 'Topic', required: true },
      { key: 'budget', label: 'Budget', required: true },
    ],
  },
] as const;

const DEMO_EMAIL_ALIASES = [{ alias: DIRECT_DEMO_SLUG, isEnabled: true }] as const;

type DemoRequestSeed = {
  id: string;
  requestToken: string;
  source: 'FORM';
  status: string;
  title: string;
  message: string;
  senderName: string;
  senderEmail: string;
  createdAt: string;
  updatedAt: string;
  completionExpiresAt?: string | null;
  category: { label: string };
  paidAmountCents?: number | null;
  requesterType: 'INDIVIDUAL' | 'ORGANIZATION';
  requesterOrgName?: string | null;
  requesterOrgWebsite?: string | null;
  requesterRoleTitle?: string | null;
  requesterVerificationStatus?: string | null;
  requesterVerificationReason?: string | null;
  keeperQuoteAmountCents?: number | null;
  keeperQuoteCurrency?: string | null;
  keeperQuoteNote?: string | null;
  structuredData?: Record<string, string> | null;
  events: Array<{
    id: string;
    type: string;
    actor: string;
    note?: string | null;
    createdAt: string;
  }>;
};

const DEMO_REQUEST_SEEDS: DemoRequestSeed[] = [
  {
    id: 'demo-accepted',
    requestToken: 'demo-token-accepted',
    source: 'FORM',
    status: 'ACCEPTED',
    title: 'Brand partnership with launch budget',
    message: 'We have a complete brief, confirmed budget, and a launch timeline ready for review.',
    senderName: 'Maya Chen',
    senderEmail: 'maya@northstar.studio',
    createdAt: '2026-03-20T08:00:00.000Z',
    updatedAt: '2026-03-20T09:30:00.000Z',
    category: { label: 'Brand deals' },
    paidAmountCents: null,
    requesterType: 'ORGANIZATION',
    requesterOrgName: 'Northstar Studio',
    requesterOrgWebsite: 'https://northstar.example',
    requesterRoleTitle: 'Partnerships Lead',
    requesterVerificationStatus: 'ORG_VERIFIED',
    requesterVerificationReason: 'Domain and org signals matched',
    structuredData: {
      budget: '$8,000',
      timeline: 'Launch in April',
      brief: 'Three short-form videos plus one story sequence',
    },
    events: [
      {
        id: 'event-demo-accepted-created',
        type: 'CREATED',
        actor: 'SYSTEM',
        note: 'Complete brief qualified for inbox delivery.',
        createdAt: '2026-03-20T08:00:00.000Z',
      },
      {
        id: 'event-demo-accepted-routed',
        type: 'STATUS_CHANGED',
        actor: 'SYSTEM',
        note: 'Accepted into inbox.',
        createdAt: '2026-03-20T08:02:00.000Z',
      },
    ],
  },
  {
    id: 'demo-auto-replied',
    requestToken: 'demo-token-auto',
    source: 'FORM',
    status: 'AUTO_REPLIED',
    title: 'Campaign idea missing budget',
    message: 'The campaign idea looks relevant, but the sender skipped budget and timeline.',
    senderName: 'Jon Perez',
    senderEmail: 'jon@orbitmedia.example',
    createdAt: '2026-03-20T10:00:00.000Z',
    updatedAt: '2026-03-20T10:01:00.000Z',
    category: { label: 'Brand deals' },
    paidAmountCents: null,
    requesterType: 'ORGANIZATION',
    requesterOrgName: 'Orbit Media',
    requesterOrgWebsite: 'https://orbitmedia.example',
    requesterRoleTitle: 'Campaign Manager',
    requesterVerificationStatus: 'BASIC_VERIFIED',
    requesterVerificationReason: 'Email syntax and domain reputation passed',
    structuredData: {
      brief: 'Creator-led campaign around a product refresh',
    },
    events: [
      {
        id: 'event-demo-auto-created',
        type: 'CREATED',
        actor: 'SYSTEM',
        note: 'Request captured with missing required fields.',
        createdAt: '2026-03-20T10:00:00.000Z',
      },
      {
        id: 'event-demo-auto-replied',
        type: 'AUTO_REPLIED',
        actor: 'SYSTEM',
        note: 'Asked for budget and timeline before delivery.',
        createdAt: '2026-03-20T10:01:00.000Z',
      },
    ],
  },
  {
    id: 'demo-awaiting-completion',
    requestToken: 'demo-token-awaiting',
    source: 'FORM',
    status: 'AWAITING_COMPLETION',
    title: 'Advisory request awaiting completion',
    message: 'The sender started the request, but Direct is waiting for the missing context fields.',
    senderName: 'Sam Rivera',
    senderEmail: 'sam@signalops.example',
    createdAt: '2026-03-20T11:00:00.000Z',
    updatedAt: '2026-03-20T11:05:00.000Z',
    completionExpiresAt: '2026-03-23T11:00:00.000Z',
    category: { label: 'Advisory' },
    paidAmountCents: null,
    requesterType: 'ORGANIZATION',
    requesterOrgName: 'SignalOps',
    requesterOrgWebsite: 'https://signalops.example',
    requesterRoleTitle: 'Founder',
    requesterVerificationStatus: 'BASIC_VERIFIED',
    requesterVerificationReason: 'Completion link sent to verified sender email',
    structuredData: {
      topic: 'Growth advisory',
    },
    events: [
      {
        id: 'event-demo-awaiting-created',
        type: 'CREATED',
        actor: 'SYSTEM',
        note: 'Request created before all required fields were completed.',
        createdAt: '2026-03-20T11:00:00.000Z',
      },
      {
        id: 'event-demo-awaiting-hold',
        type: 'COMPLETION_REQUESTED',
        actor: 'SYSTEM',
        note: 'Waiting on budget and decision timeline.',
        createdAt: '2026-03-20T11:05:00.000Z',
      },
    ],
  },
  {
    id: 'demo-paid-intent',
    requestToken: 'demo-token-paid',
    source: 'FORM',
    status: 'ACCEPTED',
    title: 'Paid advisory request with verified org intent',
    message: 'A verified org used the paid lane with a concrete brief and a proposed advisory budget.',
    senderName: 'Leah Brooks',
    senderEmail: 'leah@brightloop.example',
    createdAt: '2026-03-20T12:30:00.000Z',
    updatedAt: '2026-03-20T12:45:00.000Z',
    category: { label: 'Advisory' },
    paidAmountCents: 15000,
    requesterType: 'ORGANIZATION',
    requesterOrgName: 'Brightloop',
    requesterOrgWebsite: 'https://brightloop.example',
    requesterRoleTitle: 'CEO',
    requesterVerificationStatus: 'ORG_VERIFIED',
    requesterVerificationReason: 'Verified org signals plus paid intent',
    keeperQuoteAmountCents: 15000,
    keeperQuoteCurrency: 'USD',
    keeperQuoteNote: 'Direct preserved the paid-intent signal before inbox delivery.',
    structuredData: {
      topic: 'Product positioning workshop',
      budget: '$150',
      timeline: 'Next week',
    },
    events: [
      {
        id: 'event-demo-paid-created',
        type: 'CREATED',
        actor: 'SYSTEM',
        note: 'Paid-intent request created.',
        createdAt: '2026-03-20T12:30:00.000Z',
      },
      {
        id: 'event-demo-paid-routed',
        type: 'STATUS_CHANGED',
        actor: 'SYSTEM',
        note: 'Accepted after verifying org and paid signal.',
        createdAt: '2026-03-20T12:45:00.000Z',
      },
    ],
  },
];

export function isDirectDemoFixture(value?: string | null) {
  return value === DIRECT_DEMO_FIXTURE_QUERY_VALUE;
}

function buildStatusCounts(requests: DemoRequestSeed[]) {
  return requests.reduce<Record<string, number>>((acc, request) => {
    acc[request.status] = (acc[request.status] ?? 0) + 1;
    return acc;
  }, {});
}

function buildDemoDoorBase(doorSlug: string) {
  return {
    slug: doorSlug,
    displayName: 'John',
    plan: 'FREE',
    settings: { ...DEMO_DOOR_SETTINGS },
    categories: DEMO_CATEGORIES.map((category) => ({
      ...category,
      fields: category.fields.map((field) => ({ ...field })),
    })),
    emailAliases: DEMO_EMAIL_ALIASES.map((alias) => ({ ...alias, alias: doorSlug })),
  };
}

export function getDirectDemoInboxFixture(options?: {
  doorSlug?: string;
  page?: number;
  pageSize?: number;
  status?: RequestStatus;
}) {
  const doorSlug = options?.doorSlug ?? DIRECT_DEMO_SLUG;
  const pageSize = Math.max(1, options?.pageSize ?? DEMO_PAGE_SIZE);
  const statusCounts = buildStatusCounts(DEMO_REQUEST_SEEDS);
  const filteredRequests = options?.status
    ? DEMO_REQUEST_SEEDS.filter((request) => request.status === options.status)
    : DEMO_REQUEST_SEEDS;
  const totalCount = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, options?.page ?? 1), totalPages);
  const start = (page - 1) * pageSize;
  const requests = filteredRequests.slice(start, start + pageSize).map((request) => ({
    id: request.id,
    source: request.source,
    status: request.status,
    senderName: request.senderName,
    senderEmail: request.senderEmail,
    title: request.title,
    message: request.message,
    requestToken: request.requestToken,
    createdAt: request.createdAt,
    paidAmountCents: request.paidAmountCents ?? null,
    category: { ...request.category },
  }));

  return {
    ...buildDemoDoorBase(doorSlug),
    requests,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
    statusCounts,
  };
}

export function getDirectDemoRequestFixture(requestId: string, doorSlug = DIRECT_DEMO_SLUG) {
  const request = DEMO_REQUEST_SEEDS.find((item) => item.id === requestId);

  if (!request) {
    return null;
  }

  return {
    id: request.id,
    source: request.source,
    status: request.status,
    senderName: request.senderName,
    senderEmail: request.senderEmail,
    title: request.title,
    message: request.message,
    structuredData: request.structuredData ?? null,
    requestToken: request.requestToken,
    completionExpiresAt: request.completionExpiresAt ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    requesterType: request.requesterType,
    requesterOrgName: request.requesterOrgName ?? null,
    requesterOrgWebsite: request.requesterOrgWebsite ?? null,
    requesterRoleTitle: request.requesterRoleTitle ?? null,
    requesterVerificationStatus: request.requesterVerificationStatus ?? null,
    requesterVerificationReason: request.requesterVerificationReason ?? null,
    keeperQuoteAmountCents: request.keeperQuoteAmountCents ?? null,
    keeperQuoteCurrency: request.keeperQuoteCurrency ?? null,
    keeperQuoteNote: request.keeperQuoteNote ?? null,
    category: { ...request.category },
    door: {
      slug: doorSlug,
      settings: { ...DEMO_DOOR_SETTINGS },
    },
    events: request.events.map((event) => ({ ...event })),
  };
}
