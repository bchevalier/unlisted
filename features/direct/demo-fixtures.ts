import * as fs from 'node:fs';
import * as path from 'node:path';
import { RequestStatus } from '@prisma/client';
import type { PublicDoor } from './types';

export const DIRECT_DEMO_FIXTURE_QUERY_VALUE = 'demo';
export const DIRECT_DEMO_SLUG = 'john';

const DEMO_PAGE_SIZE = 10;
const DEFAULT_DEMO_FILE = 'data/direct-demo-default.json';
const STATE_DEMO_FILE = 'data/direct-demo-state.json';

type DemoDoorField = {
  key: string;
  label: string;
  required: boolean;
};

type DemoDoorCategory = {
  key: string;
  label: string;
  isEnabled: boolean;
  weeklyCap: number | null;
  fields: DemoDoorField[];
};

type DemoDoorAlias = {
  alias: string;
  isEnabled: boolean;
};

type DemoDoorSettings = {
  autoReplyEnabled: boolean;
  autoReplyMessage: string | null;
  weeklyRequestCap: number | null;
  revealMethod: 'NONE' | 'EMAIL' | 'URL';
  revealValue: string | null;
  notifyNewRequest: boolean;
  notifyDigest: boolean;
  paidQuoteAmountCents: number | null;
  paidQuoteCurrency: string | null;
  paidQuoteNote: string | null;
  quoteVisibleToVerifiedOrgsOnly: boolean;
  openToNonTargetedPaidReach: boolean;
};

type DemoRequestEvent = {
  id: string;
  type: string;
  actor: string;
  note?: string | null;
  createdAt: string;
};

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
  events: DemoRequestEvent[];
};

type DirectDemoState = {
  slug: string;
  displayName: string;
  plan: 'FREE' | 'PAID';
  settings: DemoDoorSettings;
  categories: DemoDoorCategory[];
  emailAliases: DemoDoorAlias[];
  requests: DemoRequestSeed[];
};

function resolveDemoFilePath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

export function getDirectDemoDefaultFilePath() {
  return resolveDemoFilePath(process.env.DIRECT_DEMO_DEFAULT_FILE ?? DEFAULT_DEMO_FILE);
}

export function getDirectDemoStateFilePath() {
  return resolveDemoFilePath(process.env.DIRECT_DEMO_STATE_FILE ?? STATE_DEMO_FILE);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getDefaultDirectDemoState(): DirectDemoState {
  return cloneState(readJsonFile<DirectDemoState>(getDirectDemoDefaultFilePath()));
}

export function readDirectDemoState(): DirectDemoState {
  const stateFile = getDirectDemoStateFilePath();
  if (fs.existsSync(stateFile)) {
    return cloneState(readJsonFile<DirectDemoState>(stateFile));
  }
  return getDefaultDirectDemoState();
}

export function writeDirectDemoState(state: DirectDemoState) {
  const stateFile = getDirectDemoStateFilePath();
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return stateFile;
}

export function resetDirectDemoState() {
  const state = getDefaultDirectDemoState();
  const stateFile = writeDirectDemoState(state);
  return { stateFile, state };
}

export function isDirectDemoFixture(value?: string | null) {
  return value === DIRECT_DEMO_FIXTURE_QUERY_VALUE;
}

function buildStatusCounts(requests: DemoRequestSeed[]) {
  return requests.reduce<Record<string, number>>((acc, request) => {
    acc[request.status] = (acc[request.status] ?? 0) + 1;
    return acc;
  }, {});
}

function buildDemoDoorBase(state: DirectDemoState, doorSlug: string) {
  return {
    slug: doorSlug,
    displayName: state.displayName,
    plan: state.plan,
    settings: cloneState(state.settings),
    categories: state.categories.map((category) => ({
      ...category,
      fields: category.fields.map((field) => ({ ...field })),
    })),
    emailAliases: state.emailAliases.map((alias) => ({
      ...alias,
      alias: alias.alias === state.slug ? doorSlug : alias.alias,
    })),
  };
}

export function getDirectDemoInboxFixture(options?: {
  doorSlug?: string;
  page?: number;
  pageSize?: number;
  status?: RequestStatus;
}) {
  const state = readDirectDemoState();
  const doorSlug = options?.doorSlug ?? state.slug ?? DIRECT_DEMO_SLUG;
  const pageSize = Math.max(1, options?.pageSize ?? DEMO_PAGE_SIZE);
  const statusCounts = buildStatusCounts(state.requests);
  const filteredRequests = options?.status
    ? state.requests.filter((request) => request.status === options.status)
    : state.requests;
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
    ...buildDemoDoorBase(state, doorSlug),
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

export function getDirectDemoPublicDoorFixture(doorSlug = DIRECT_DEMO_SLUG): PublicDoor {
  const state = readDirectDemoState();
  const headline = 'A private-by-default door for brand deals, collabs, and other serious inbound';

  return {
    id: 'direct-demo-door',
    slug: doorSlug,
    displayName: state.displayName,
    headline,
    isPaidDoor: state.plan === 'PAID',
    categories: state.categories.map((category) => ({
      key: category.key,
      label: category.label,
      description:
        category.key === 'brand-deals'
          ? 'Share the brief, budget, and timeline before this reaches the inbox.'
          : 'Give enough context for Direct to route serious requests properly.',
      fields: category.fields.map((field) => ({
        key: field.key,
        label: field.label,
        required: field.required,
        type: field.key === 'budget' ? 'NUMBER' : field.key === 'brief' ? 'TEXTAREA' : field.key === 'website' ? 'URL' : 'TEXT',
        placeholder:
          field.key === 'budget'
            ? '5000'
            : field.key === 'timeline'
              ? 'Launch in April'
              : field.key === 'brief'
                ? 'What is the opportunity?'
                : field.key === 'topic'
                  ? 'What do you need help with?'
                  : null,
      })),
    })),
  };
}

export function getDirectDemoRequestFixture(requestId: string, doorSlug?: string) {
  const state = readDirectDemoState();
  const request = state.requests.find((item) => item.id === requestId);

  if (!request) {
    return null;
  }

  const resolvedDoorSlug = doorSlug ?? state.slug ?? DIRECT_DEMO_SLUG;

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
      slug: resolvedDoorSlug,
      settings: cloneState(state.settings),
    },
    events: request.events.map((event) => ({ ...event })),
  };
}
