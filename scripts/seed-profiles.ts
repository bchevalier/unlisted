#!/usr/bin/env tsx

import crypto from 'node:crypto';
import {
  PrismaClient,
  AuthProvider,
  CategoryFieldType,
  DoorPlan,
  RequestEventActor,
  RequestEventType,
  RequestSource,
  RequestStatus,
  ReachActorType,
  ReachContractEventActor,
  ReachContractEventType,
  ReachContractStatus,
  ReachContractType,
  ReachOrgRole,
  ReachPolicyAction,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

type ProfileName = 'ci' | 'staging-lite' | 'staging' | 'load';

interface ProfileConfig {
  users: number;
  directRequests: number;
  directEventsTarget: number;
  reachActors: number;
  reachPolicies: number;
  reachContracts: number;
  reachEventsTarget: number;
  reachWebhooks: number;
  reachDeliveries: number;
}

const PROFILE_CONFIG: Record<ProfileName, ProfileConfig> = {
  ci: {
    users: 12,
    directRequests: 250,
    directEventsTarget: 800,
    reachActors: 20,
    reachPolicies: 40,
    reachContracts: 250,
    reachEventsTarget: 900,
    reachWebhooks: 20,
    reachDeliveries: 200,
  },
  'staging-lite': {
    users: 180,
    directRequests: 4000,
    directEventsTarget: 12000,
    reachActors: 80,
    reachPolicies: 220,
    reachContracts: 1500,
    reachEventsTarget: 4500,
    reachWebhooks: 90,
    reachDeliveries: 1200,
  },
  staging: {
    users: 250,
    directRequests: 12000,
    directEventsTarget: 42000,
    reachActors: 120,
    reachPolicies: 420,
    reachContracts: 5000,
    reachEventsTarget: 15000,
    reachWebhooks: 220,
    reachDeliveries: 4000,
  },
  load: {
    users: 500,
    directRequests: 25000,
    directEventsTarget: 70000,
    reachActors: 180,
    reachPolicies: 700,
    reachContracts: 8000,
    reachEventsTarget: 24000,
    reachWebhooks: 400,
    reachDeliveries: 7000,
  },
};

const DIRECT_CATEGORY_TEMPLATES = [
  {
    key: 'business',
    label: 'Business Inquiry',
    description: 'Partnership and commercial opportunities',
    sortOrder: 1,
    fields: [
      { key: 'company', label: 'Company', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
      { key: 'budget', label: 'Budget', type: CategoryFieldType.NUMBER, required: false, sortOrder: 2 },
      { key: 'website', label: 'Website', type: CategoryFieldType.URL, required: false, sortOrder: 3 },
    ],
  },
  {
    key: 'collab',
    label: 'Collaboration',
    description: 'Creator and product collaboration',
    sortOrder: 2,
    fields: [
      { key: 'project', label: 'Project', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
      { key: 'timeline', label: 'Timeline', type: CategoryFieldType.TEXT, required: false, sortOrder: 2 },
    ],
  },
  {
    key: 'other',
    label: 'Other',
    description: 'General request',
    sortOrder: 3,
    fields: [],
  },
];

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const getValue = (flag: string): string | undefined => {
    const idx = args.findIndex((a) => a === flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const profile = (getValue('--profile') ?? 'ci') as ProfileName;
  const runCleanupOnly = args.includes('--cleanup-only');

  if (!Object.hasOwn(PROFILE_CONFIG, profile)) {
    throw new Error(`Invalid profile '${profile}'. Expected one of: ${Object.keys(PROFILE_CONFIG).join(', ')}`);
  }

  return { profile, runCleanupOnly };
}

function seedFromString(input: string): number {
  return [...input].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 2166136261);
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)] as T;
}

function pickWeighted<T>(entries: Array<{ value: T; weight: number }>, rand: () => number): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const target = rand() * total;
  let cursor = 0;
  for (const entry of entries) {
    cursor += entry.weight;
    if (target <= cursor) return entry.value;
  }
  return entries[entries.length - 1]!.value;
}

function buildPrefix(profile: ProfileName): string {
  return `seed-${profile}`;
}

async function cleanupProfileData(prefix: string) {
  console.log(`Cleaning prior seed data for prefix '${prefix}'...`);

  await prisma.reachActor.deleteMany({ where: { handle: { startsWith: `${prefix}-` } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${prefix}-` } } });

  try {
    await prisma.adminUser.deleteMany({ where: { email: { startsWith: `${prefix}-` } } });
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: string }).code
        : undefined;

    if (code !== 'P2021') {
      throw error;
    }

    console.warn('Skipping admin_users cleanup: table does not exist in this database yet.');
  }

  console.log('Cleanup complete.');
}

async function seedDirect(profile: ProfileName, config: ProfileConfig, rand: () => number) {
  const prefix = buildPrefix(profile);
  const passwordHash = await bcrypt.hash('SeedPass!2345', 10);

  const doors: Array<{ id: string; slug: string; userId: string }> = [];
  const doorCategories = new Map<string, string[]>();

  for (let i = 1; i <= config.users; i += 1) {
    const suffix = String(i).padStart(4, '0');
    const email = `${prefix}-keeper-${suffix}@knokio.local`;
    const slug = `${prefix}-u${suffix}`;
    const alias = `${prefix}a${suffix}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: `Seed Keeper ${suffix}`,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      create: {
        email,
        name: `Seed Keeper ${suffix}`,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.authIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: AuthProvider.PASSWORD,
          providerSubject: email,
        },
      },
      update: {
        userId: user.id,
        providerEmail: email,
      },
      create: {
        userId: user.id,
        provider: AuthProvider.PASSWORD,
        providerSubject: email,
        providerEmail: email,
      },
    });

    const plan = rand() < 0.25 ? DoorPlan.PAID : DoorPlan.FREE;

    const door = await prisma.door.upsert({
      where: { userId: user.id },
      update: {
        slug,
        displayName: `Seed Door ${suffix}`,
        headline: plan === DoorPlan.PAID ? 'Priority paid opportunities' : 'Filtered inbound only',
        plan,
      },
      create: {
        userId: user.id,
        slug,
        displayName: `Seed Door ${suffix}`,
        headline: plan === DoorPlan.PAID ? 'Priority paid opportunities' : 'Filtered inbound only',
        plan,
      },
    });

    await prisma.doorSettings.upsert({
      where: { doorId: door.id },
      update: {
        weeklyRequestCap: plan === DoorPlan.PAID ? null : 50,
        notifyNewRequest: true,
        notifyDigest: rand() < 0.3,
      },
      create: {
        doorId: door.id,
        weeklyRequestCap: plan === DoorPlan.PAID ? null : 50,
        notifyNewRequest: true,
        notifyDigest: rand() < 0.3,
      },
    });

    await prisma.emailAlias.upsert({
      where: { alias },
      update: { doorId: door.id, isEnabled: true },
      create: { alias, doorId: door.id, isEnabled: true },
    });

    const categoryIds: string[] = [];

    for (const categoryTemplate of DIRECT_CATEGORY_TEMPLATES) {
      const category = await prisma.category.upsert({
        where: {
          doorId_key: {
            doorId: door.id,
            key: categoryTemplate.key,
          },
        },
        update: {
          label: categoryTemplate.label,
          description: categoryTemplate.description,
          isEnabled: true,
          weeklyCap: plan === DoorPlan.PAID ? null : 20,
          sortOrder: categoryTemplate.sortOrder,
        },
        create: {
          doorId: door.id,
          key: categoryTemplate.key,
          label: categoryTemplate.label,
          description: categoryTemplate.description,
          isEnabled: true,
          weeklyCap: plan === DoorPlan.PAID ? null : 20,
          sortOrder: categoryTemplate.sortOrder,
        },
      });

      categoryIds.push(category.id);

      for (const field of categoryTemplate.fields) {
        await prisma.categoryField.upsert({
          where: {
            categoryId_key: {
              categoryId: category.id,
              key: field.key,
            },
          },
          update: {
            label: field.label,
            type: field.type,
            required: field.required,
            sortOrder: field.sortOrder,
          },
          create: {
            categoryId: category.id,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            sortOrder: field.sortOrder,
          },
        });
      }
    }

    doors.push({ id: door.id, slug: door.slug, userId: user.id });
    doorCategories.set(door.id, categoryIds);
  }

  // Remove prior seeded requests for these doors to keep deterministic counts.
  await prisma.request.deleteMany({
    where: {
      doorId: { in: doors.map((d) => d.id) },
    },
  });

  const createdRequestIds: string[] = [];
  let eventCount = 0;

  for (let i = 1; i <= config.directRequests; i += 1) {
    const door = doors[(i - 1) % doors.length]!;
    const source = rand() < 0.35 ? RequestSource.EMAIL : RequestSource.FORM;
    const status = pickWeighted(
      [
        { value: RequestStatus.PENDING, weight: 42 },
        { value: RequestStatus.ACCEPTED, weight: 24 },
        { value: RequestStatus.DECLINED, weight: 14 },
        { value: RequestStatus.EXPIRED, weight: 14 },
        { value: RequestStatus.AWAITING_COMPLETION, weight: 6 },
      ],
      rand,
    );

    const categoryIds = doorCategories.get(door.id) ?? [];
    const categoryId = categoryIds.length ? pick(categoryIds, rand) : null;

    const createdAt = new Date(Date.now() - Math.floor(rand() * 1000 * 60 * 60 * 24 * 40));

    const request = await prisma.request.create({
      data: {
        doorId: door.id,
        categoryId,
        source,
        status,
        senderName: `Sender ${i}`,
        senderEmail: `sender-${buildPrefix(profile)}-${i}@example.test`,
        ipHash: `ip-${buildPrefix(profile)}-${Math.floor(i / 3)}`,
        title: `Seed ${profile.toUpperCase()} request ${i}`,
        message: `This is seeded ${profile} request ${i} for door ${door.slug}.`,
        structuredData: {
          seedProfile: profile,
          requestNumber: i,
          source,
        },
        completionToken:
          status === RequestStatus.AWAITING_COMPLETION
            ? crypto.randomBytes(16).toString('hex')
            : null,
        completionExpiresAt:
          status === RequestStatus.AWAITING_COMPLETION
            ? new Date(Date.now() + 1000 * 60 * 60 * 24)
            : null,
        createdAt,
      },
    });

    createdRequestIds.push(request.id);

    const events: Array<{
      type: RequestEventType;
      actor: RequestEventActor;
      note: string;
      metadata: { seedProfile: ProfileName };
    }> = [
      {
        type: RequestEventType.CREATED,
        actor: RequestEventActor.SYSTEM,
        note: 'Seeded request created',
        metadata: { seedProfile: profile },
      },
    ];

    if (status === RequestStatus.ACCEPTED) {
      events.push({
        type: RequestEventType.ACCEPTED,
        actor: RequestEventActor.KEEPER,
        note: 'Seed accepted',
        metadata: { seedProfile: profile },
      });
    } else if (status === RequestStatus.DECLINED) {
      events.push({
        type: RequestEventType.DECLINED,
        actor: RequestEventActor.KEEPER,
        note: 'Seed declined',
        metadata: { seedProfile: profile },
      });
    } else if (status === RequestStatus.EXPIRED) {
      events.push({
        type: RequestEventType.EXPIRED,
        actor: RequestEventActor.SYSTEM,
        note: 'Seed expired',
        metadata: { seedProfile: profile },
      });
    } else if (status === RequestStatus.AWAITING_COMPLETION) {
      events.push({
        type: RequestEventType.AUTO_REPLIED,
        actor: RequestEventActor.SYSTEM,
        note: 'Seed completion email sent',
        metadata: { seedProfile: profile },
      });
    }

    await prisma.requestEvent.createMany({
      data: events.map((event) => ({
        requestId: request.id,
        type: event.type,
        actor: event.actor,
        note: event.note,
        metadata: event.metadata,
      })),
    });

    eventCount += events.length;
  }

  // Top up events to target with additional AUTO_REPLIED events.
  const extraEventsNeeded = Math.max(0, config.directEventsTarget - eventCount);
  if (extraEventsNeeded > 0 && createdRequestIds.length > 0) {
    const extra = Array.from({ length: extraEventsNeeded }, (_, index) => ({
      requestId: createdRequestIds[index % createdRequestIds.length]!,
      type: RequestEventType.AUTO_REPLIED,
      actor: RequestEventActor.SYSTEM,
      note: `Seed extra event ${index + 1}`,
      metadata: { seedProfile: profile, extra: true },
    }));

    await prisma.requestEvent.createMany({ data: extra });
    eventCount += extra.length;
  }

  console.log(
    `Direct seeded (${profile}): users=${config.users}, doors=${doors.length}, requests=${createdRequestIds.length}, events=${eventCount}`,
  );

  return {
    userIds: doors.map((d) => d.userId),
    doorIds: doors.map((d) => d.id),
  };
}

function toReachContractType(initiator: ReachActorType, target: ReachActorType): ReachContractType {
  const init = initiator === ReachActorType.AI_AGENT ? 'AI' : 'HUMAN';
  const tgt = target === ReachActorType.AI_AGENT ? 'AI' : 'HUMAN';

  if (init === 'AI' && tgt === 'AI') return ReachContractType.AI_AI;
  if (init === 'AI' && tgt === 'HUMAN') return ReachContractType.AI_HUMAN;
  if (init === 'HUMAN' && tgt === 'AI') return ReachContractType.HUMAN_AI;
  return ReachContractType.HUMAN_HUMAN;
}

async function seedReach(
  profile: ProfileName,
  config: ProfileConfig,
  rand: () => number,
  directUserIds: string[],
) {
  const prefix = buildPrefix(profile);

  const humanCount = Math.min(Math.max(4, Math.floor(config.reachActors * 0.5)), directUserIds.length);
  const aiCount = Math.max(3, Math.floor(config.reachActors * 0.3));
  const orgCount = Math.max(2, config.reachActors - humanCount - aiCount);

  const actors: Array<{ id: string; type: ReachActorType; handle: string }> = [];

  for (let i = 0; i < humanCount; i += 1) {
    const userId = directUserIds[i]!;
    const handle = `${prefix}-human-${String(i + 1).padStart(3, '0')}`;

    const actor = await prisma.reachActor.upsert({
      where: { userId },
      update: {
        handle,
        type: ReachActorType.HUMAN,
        displayName: `Seed Human ${i + 1}`,
        isActive: true,
      },
      create: {
        userId,
        handle,
        type: ReachActorType.HUMAN,
        displayName: `Seed Human ${i + 1}`,
      },
    });

    actors.push({ id: actor.id, type: actor.type, handle: actor.handle });
  }

  for (let i = 0; i < aiCount; i += 1) {
    const idx = String(i + 1).padStart(3, '0');
    const handle = `${prefix}-ai-${idx}`;
    const apiKey = `knk_${prefix}_ai_${idx}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const actor = await prisma.reachActor.upsert({
      where: { handle },
      update: {
        type: ReachActorType.AI_AGENT,
        displayName: `Seed AI ${idx}`,
        isActive: true,
        apiKeyHash,
        capabilities: {
          intents: ['triage', 'fulfill', 'route'],
          seedProfile: profile,
        },
        agentMeta: {
          operatorName: `Seed Operator ${idx}`,
          modelId: 'gpt-seed',
          version: '1.0',
        },
      },
      create: {
        handle,
        type: ReachActorType.AI_AGENT,
        displayName: `Seed AI ${idx}`,
        isActive: true,
        apiKeyHash,
        capabilities: {
          intents: ['triage', 'fulfill', 'route'],
          seedProfile: profile,
        },
        agentMeta: {
          operatorName: `Seed Operator ${idx}`,
          modelId: 'gpt-seed',
          version: '1.0',
        },
      },
    });

    actors.push({ id: actor.id, type: actor.type, handle: actor.handle });
  }

  for (let i = 0; i < orgCount; i += 1) {
    const idx = String(i + 1).padStart(3, '0');
    const handle = `${prefix}-org-${idx}`;
    const apiKey = `knk_${prefix}_org_${idx}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const actor = await prisma.reachActor.upsert({
      where: { handle },
      update: {
        type: ReachActorType.ORGANIZATION,
        displayName: `Seed Org ${idx}`,
        isActive: true,
        apiKeyHash,
      },
      create: {
        handle,
        type: ReachActorType.ORGANIZATION,
        displayName: `Seed Org ${idx}`,
        isActive: true,
        apiKeyHash,
      },
    });

    actors.push({ id: actor.id, type: actor.type, handle: actor.handle });
  }

  const humanActors = actors.filter((actor) => actor.type === ReachActorType.HUMAN);
  const aiActors = actors.filter((actor) => actor.type === ReachActorType.AI_AGENT);
  const orgActors = actors.filter((actor) => actor.type === ReachActorType.ORGANIZATION);

  // Org memberships.
  for (const org of orgActors) {
    const owner = pick(humanActors, rand);
    await prisma.reachOrgMember.upsert({
      where: {
        orgId_memberId: {
          orgId: org.id,
          memberId: owner.id,
        },
      },
      update: {
        role: ReachOrgRole.OWNER,
        isActive: true,
      },
      create: {
        orgId: org.id,
        memberId: owner.id,
        role: ReachOrgRole.OWNER,
        isActive: true,
      },
    });

    if (aiActors.length) {
      const ai = pick(aiActors, rand);
      await prisma.reachOrgMember.upsert({
        where: {
          orgId_memberId: {
            orgId: org.id,
            memberId: ai.id,
          },
        },
        update: {
          role: ReachOrgRole.MEMBER,
          isActive: true,
        },
        create: {
          orgId: org.id,
          memberId: ai.id,
          role: ReachOrgRole.MEMBER,
          isActive: true,
        },
      });
    }
  }

  const policyActorPool = [...humanActors, ...aiActors];
  let policyCount = 0;

  while (policyCount < config.reachPolicies && policyActorPool.length) {
    const actor = policyActorPool[policyCount % policyActorPool.length]!;
    const action = pick(
      [ReachPolicyAction.ACCEPT, ReachPolicyAction.ROUTE, ReachPolicyAction.ESCALATE, ReachPolicyAction.REJECT],
      rand,
    );

    await prisma.reachPolicy.create({
      data: {
        actorId: actor.id,
        name: `${prefix}-policy-${String(policyCount + 1).padStart(4, '0')}`,
        isActive: true,
        contractTypes:
          actor.type === ReachActorType.AI_AGENT
            ? [ReachContractType.HUMAN_AI, ReachContractType.AI_AI]
            : [ReachContractType.HUMAN_HUMAN, ReachContractType.AI_HUMAN],
        action,
        maxWeeklyInbound: 100,
        requireVerifiedSender: rand() < 0.4,
        autoAcceptMatching: action === ReachPolicyAction.ACCEPT,
        escalateToHuman: action === ReachPolicyAction.ESCALATE,
        filters: {
          requiredTags: rand() < 0.5 ? ['seed'] : [],
          purposeKeywords: rand() < 0.5 ? ['pilot'] : [],
        },
        priority: Math.floor(rand() * 1000),
      },
    });

    policyCount += 1;
  }

  const contractActors = [...humanActors, ...aiActors];
  const contractIds: string[] = [];
  let reachEventCount = 0;

  for (let i = 1; i <= config.reachContracts; i += 1) {
    const initiator = pick(contractActors, rand);
    let target = pick(contractActors, rand);
    while (target.id === initiator.id) {
      target = pick(contractActors, rand);
    }

    const status = pickWeighted(
      [
        { value: ReachContractStatus.PROPOSED, weight: 35 },
        { value: ReachContractStatus.ACTIVE, weight: 25 },
        { value: ReachContractStatus.FULFILLED, weight: 18 },
        { value: ReachContractStatus.REJECTED, weight: 10 },
        { value: ReachContractStatus.EXPIRED, weight: 8 },
        { value: ReachContractStatus.CANCELLED, weight: 4 },
      ],
      rand,
    );

    const contract = await prisma.reachContract.create({
      data: {
        type: toReachContractType(initiator.type, target.type),
        status,
        initiatorId: initiator.id,
        targetId: target.id,
        purpose: `Seed ${profile.toUpperCase()} contract ${i}`,
        message: `Seed contract ${i} for profile ${profile}`,
        structuredData: { seedProfile: profile, index: i },
        routedAt:
          status === ReachContractStatus.ACTIVE || status === ReachContractStatus.FULFILLED
            ? new Date()
            : null,
        resolvedAt:
          status === ReachContractStatus.FULFILLED ||
          status === ReachContractStatus.REJECTED ||
          status === ReachContractStatus.EXPIRED ||
          status === ReachContractStatus.CANCELLED
            ? new Date()
            : null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    contractIds.push(contract.id);

    const events: Array<{ type: ReachContractEventType; actor: ReachContractEventActor; note?: string }> = [
      { type: ReachContractEventType.CREATED, actor: ReachContractEventActor.SYSTEM, note: 'Seed created' },
    ];

    if (status === ReachContractStatus.ACTIVE || status === ReachContractStatus.FULFILLED) {
      events.push({ type: ReachContractEventType.ACCEPTED, actor: ReachContractEventActor.TARGET, note: 'Seed accepted' });
    }

    if (status === ReachContractStatus.FULFILLED) {
      events.push({ type: ReachContractEventType.FULFILLED, actor: ReachContractEventActor.TARGET, note: 'Seed fulfilled' });
    } else if (status === ReachContractStatus.REJECTED) {
      events.push({ type: ReachContractEventType.REJECTED, actor: ReachContractEventActor.TARGET, note: 'Seed rejected' });
    } else if (status === ReachContractStatus.EXPIRED) {
      events.push({ type: ReachContractEventType.EXPIRED, actor: ReachContractEventActor.SYSTEM, note: 'Seed expired' });
    } else if (status === ReachContractStatus.CANCELLED) {
      events.push({ type: ReachContractEventType.CANCELLED, actor: ReachContractEventActor.INITIATOR, note: 'Seed cancelled' });
    }

    await prisma.reachContractEvent.createMany({
      data: events.map((event) => ({
        contractId: contract.id,
        type: event.type,
        actor: event.actor,
        note: event.note ?? null,
        metadata: { seedProfile: profile },
      })),
    });

    reachEventCount += events.length;
  }

  const extraReachEventsNeeded = Math.max(0, config.reachEventsTarget - reachEventCount);
  if (extraReachEventsNeeded > 0 && contractIds.length > 0) {
    await prisma.reachContractEvent.createMany({
      data: Array.from({ length: extraReachEventsNeeded }, (_, index) => ({
        contractId: contractIds[index % contractIds.length]!,
        type: ReachContractEventType.ROUTED,
        actor: ReachContractEventActor.SYSTEM,
        note: `Seed routed event ${index + 1}`,
        metadata: { seedProfile: profile, extra: true },
      })),
    });

    reachEventCount += extraReachEventsNeeded;
  }

  const webhookActors = [...aiActors, ...orgActors];
  const webhookIds: string[] = [];

  for (let i = 1; i <= config.reachWebhooks; i += 1) {
    if (!webhookActors.length) break;
    const actor = webhookActors[(i - 1) % webhookActors.length]!;

    const webhook = await prisma.reachWebhook.create({
      data: {
        actorId: actor.id,
        url: `https://example.test/hooks/${prefix}/${i}`,
        secretHash: crypto.createHash('sha256').update(`${prefix}-webhook-${i}`).digest('hex'),
        events: [ReachContractEventType.CREATED, ReachContractEventType.ACCEPTED, ReachContractEventType.FULFILLED],
        description: `Seed webhook ${i}`,
        isActive: true,
      },
    });

    webhookIds.push(webhook.id);
  }

  for (let i = 1; i <= config.reachDeliveries; i += 1) {
    if (!webhookIds.length || !contractIds.length) break;

    await prisma.reachWebhookDelivery.create({
      data: {
        webhookId: webhookIds[(i - 1) % webhookIds.length]!,
        contractId: contractIds[(i - 1) % contractIds.length]!,
        event: pick(
          [ReachContractEventType.CREATED, ReachContractEventType.ACCEPTED, ReachContractEventType.FULFILLED],
          rand,
        ),
        status: pickWeighted(
          [
            { value: 'success', weight: 75 },
            { value: 'failed', weight: 20 },
            { value: 'pending', weight: 5 },
          ],
          rand,
        ),
        httpStatus: rand() < 0.75 ? 200 : 500,
        attempts: Math.floor(rand() * 3) + 1,
        lastError: rand() < 0.2 ? 'Seed transient failure' : null,
        payload: { seedProfile: profile, delivery: i },
        deliveredAt: rand() < 0.75 ? new Date() : null,
      },
    });
  }

  console.log(
    `Reach seeded (${profile}): actors=${actors.length}, policies=${policyCount}, contracts=${contractIds.length}, events=${reachEventCount}, webhooks=${webhookIds.length}, deliveries=${config.reachDeliveries}`,
  );
}

async function printSummary(profile: ProfileName) {
  const prefix = buildPrefix(profile);

  const [users, doors, requests, requestEvents, actors, policies, contracts, contractEvents, webhooks, deliveries] =
    await Promise.all([
      prisma.user.count({ where: { email: { startsWith: `${prefix}-` } } }),
      prisma.door.count({ where: { slug: { startsWith: `${prefix}-` } } }),
      prisma.request.count({ where: { title: { startsWith: `Seed ${profile.toUpperCase()} request` } } }),
      prisma.requestEvent.count({ where: { metadata: { path: ['seedProfile'], equals: profile } } }),
      prisma.reachActor.count({ where: { handle: { startsWith: `${prefix}-` } } }),
      prisma.reachPolicy.count({ where: { name: { startsWith: `${prefix}-policy-` } } }),
      prisma.reachContract.count({ where: { purpose: { startsWith: `Seed ${profile.toUpperCase()} contract` } } }),
      prisma.reachContractEvent.count({ where: { metadata: { path: ['seedProfile'], equals: profile } } }),
      prisma.reachWebhook.count({ where: { description: { startsWith: 'Seed webhook' } } }),
      prisma.reachWebhookDelivery.count({ where: { payload: { path: ['seedProfile'], equals: profile } } }),
    ]);

  console.log('\nSeed summary');
  console.log(`  profile: ${profile}`);
  console.log(`  users: ${users}`);
  console.log(`  doors: ${doors}`);
  console.log(`  requests: ${requests}`);
  console.log(`  request events: ${requestEvents}`);
  console.log(`  reach actors: ${actors}`);
  console.log(`  reach policies: ${policies}`);
  console.log(`  reach contracts: ${contracts}`);
  console.log(`  reach contract events: ${contractEvents}`);
  console.log(`  reach webhooks: ${webhooks}`);
  console.log(`  reach deliveries: ${deliveries}`);
}

async function main() {
  const { profile, runCleanupOnly } = parseArgs();
  const config = PROFILE_CONFIG[profile];
  const prefix = buildPrefix(profile);
  const rand = createRng(seedFromString(`${profile}-seed`));

  await cleanupProfileData(prefix);

  if (runCleanupOnly) {
    console.log('Cleanup-only mode complete.');
    return;
  }

  const direct = await seedDirect(profile, config, rand);
  await seedReach(profile, config, rand, direct.userIds);
  await printSummary(profile);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
