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

const prisma = new PrismaClient();

const PROFILE = 'staging-lite';
const PREFIX = 'seed-staging-lite';

const CONFIG = {
  users: 180,
  directRequests: 4000,
  reachActors: 80,
  reachPolicies: 220,
  reachContracts: 1500,
  reachWebhooks: 90,
  reachDeliveries: 1200,
};

type ChunkName =
  | 'cleanup'
  | 'users'
  | 'direct'
  | 'reach-core'
  | 'reach-contracts'
  | 'reach-webhooks'
  | 'reach-deliveries'
  | 'summary';

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
] as const;

function parseArgs() {
  const args = process.argv.slice(2);
  const getValue = (flag: string): string | undefined => {
    const index = args.findIndex((arg) => arg === flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const chunk = (getValue('--chunk') ?? 'summary') as ChunkName;
  const start = Number(getValue('--start') ?? 1);
  const count = Number(getValue('--count') ?? 0);

  const allowed: ChunkName[] = [
    'cleanup',
    'users',
    'direct',
    'reach-core',
    'reach-contracts',
    'reach-webhooks',
    'reach-deliveries',
    'summary',
  ];

  if (!allowed.includes(chunk)) {
    throw new Error(`Invalid --chunk '${chunk}'. Allowed: ${allowed.join(', ')}`);
  }

  return { chunk, start, count };
}

function hashRand(index: number, salt: string): number {
  const hash = crypto.createHash('sha256').update(`${salt}:${index}`).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

function pickByRand<T>(values: T[], rand: number): T {
  const idx = Math.min(values.length - 1, Math.floor(rand * values.length));
  return values[idx]!;
}

function weightedStatus(index: number): RequestStatus {
  const r = hashRand(index, 'direct-status');
  if (r < 0.42) return RequestStatus.PENDING;
  if (r < 0.66) return RequestStatus.ACCEPTED;
  if (r < 0.80) return RequestStatus.DECLINED;
  if (r < 0.94) return RequestStatus.EXPIRED;
  return RequestStatus.AWAITING_COMPLETION;
}

function weightedReachStatus(index: number): ReachContractStatus {
  const r = hashRand(index, 'reach-status');
  if (r < 0.35) return ReachContractStatus.PROPOSED;
  if (r < 0.60) return ReachContractStatus.ACTIVE;
  if (r < 0.78) return ReachContractStatus.FULFILLED;
  if (r < 0.88) return ReachContractStatus.REJECTED;
  if (r < 0.96) return ReachContractStatus.EXPIRED;
  return ReachContractStatus.CANCELLED;
}

function toReachType(initiatorType: ReachActorType, targetType: ReachActorType): ReachContractType {
  const i = initiatorType === ReachActorType.AI_AGENT ? 'AI' : 'HUMAN';
  const t = targetType === ReachActorType.AI_AGENT ? 'AI' : 'HUMAN';

  if (i === 'AI' && t === 'AI') return ReachContractType.AI_AI;
  if (i === 'AI' && t === 'HUMAN') return ReachContractType.AI_HUMAN;
  if (i === 'HUMAN' && t === 'AI') return ReachContractType.HUMAN_AI;
  return ReachContractType.HUMAN_HUMAN;
}

async function cleanup() {
  console.log(`Cleaning seed data for ${PROFILE}...`);
  await prisma.reachActor.deleteMany({ where: { handle: { startsWith: `${PREFIX}-` } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${PREFIX}-` } } });
  await prisma.reachWebhook.deleteMany({ where: { description: { startsWith: `Seed ${PROFILE} webhook` } } });
  console.log('Cleanup complete.');
}

async function seedUsers() {
  console.log(`Seeding users/doors for ${PROFILE}...`);
  const passwordHash = await bcrypt.hash('SeedPass!2345', 10);

  for (let i = 1; i <= CONFIG.users; i += 1) {
    const suffix = String(i).padStart(4, '0');
    const email = `${PREFIX}-keeper-${suffix}@knokio.local`;
    const slug = `${PREFIX}-u${suffix}`;
    const alias = `${PREFIX}a${suffix}`;

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
      update: { userId: user.id, providerEmail: email },
      create: {
        userId: user.id,
        provider: AuthProvider.PASSWORD,
        providerSubject: email,
        providerEmail: email,
      },
    });

    const plan = i % 4 === 0 ? DoorPlan.PAID : DoorPlan.FREE;

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
        notifyDigest: i % 5 === 0,
      },
      create: {
        doorId: door.id,
        weeklyRequestCap: plan === DoorPlan.PAID ? null : 50,
        notifyNewRequest: true,
        notifyDigest: i % 5 === 0,
      },
    });

    await prisma.emailAlias.upsert({
      where: { alias },
      update: { doorId: door.id, isEnabled: true },
      create: { alias, doorId: door.id, isEnabled: true },
    });

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
          weeklyCap: plan === DoorPlan.PAID ? null : 20,
          isEnabled: true,
          sortOrder: categoryTemplate.sortOrder,
        },
        create: {
          doorId: door.id,
          key: categoryTemplate.key,
          label: categoryTemplate.label,
          description: categoryTemplate.description,
          weeklyCap: plan === DoorPlan.PAID ? null : 20,
          isEnabled: true,
          sortOrder: categoryTemplate.sortOrder,
        },
      });

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
  }

  console.log(`Users/doors seeded: ${CONFIG.users}`);
}

async function seedDirectRequests(start: number, count: number) {
  const end = start + count - 1;
  console.log(`Seeding direct requests ${start}..${end}`);

  const doors = await prisma.door.findMany({
    where: { slug: { startsWith: `${PREFIX}-` } },
    include: { categories: { select: { id: true } } },
    orderBy: { slug: 'asc' },
  });

  if (!doors.length) throw new Error('No seeded doors found. Run --chunk users first.');

  for (let i = start; i <= end; i += 1) {
    const door = doors[(i - 1) % doors.length]!;
    const categories = door.categories;
    const categoryId = categories.length
      ? categories[Math.floor(hashRand(i, 'category') * categories.length)]!.id
      : null;

    const status = weightedStatus(i);
    const source = hashRand(i, 'source') < 0.35 ? RequestSource.EMAIL : RequestSource.FORM;

    const title = `Seed STAGING_LITE request ${i}`;
    await prisma.request.deleteMany({ where: { title } });

    const request = await prisma.request.create({
      data: {
        doorId: door.id,
        categoryId,
        source,
        status,
        senderName: `Sender ${i}`,
        senderEmail: `sender-${PREFIX}-${i}@example.test`,
        ipHash: `ip-${PREFIX}-${Math.floor(i / 3)}`,
        title,
        message: `Seeded staging-lite request ${i}`,
        structuredData: { seedProfile: PROFILE, index: i },
        completionToken:
          status === RequestStatus.AWAITING_COMPLETION
            ? crypto.randomBytes(16).toString('hex')
            : null,
        completionExpiresAt:
          status === RequestStatus.AWAITING_COMPLETION
            ? new Date(Date.now() + 1000 * 60 * 60 * 24)
            : null,
      },
    });

    const events: Array<{ type: RequestEventType; actor: RequestEventActor; note: string }> = [
      { type: RequestEventType.CREATED, actor: RequestEventActor.SYSTEM, note: 'Seed created' },
    ];

    if (status === RequestStatus.ACCEPTED) {
      events.push({ type: RequestEventType.ACCEPTED, actor: RequestEventActor.KEEPER, note: 'Seed accepted' });
    } else if (status === RequestStatus.DECLINED) {
      events.push({ type: RequestEventType.DECLINED, actor: RequestEventActor.KEEPER, note: 'Seed declined' });
    } else if (status === RequestStatus.EXPIRED) {
      events.push({ type: RequestEventType.EXPIRED, actor: RequestEventActor.SYSTEM, note: 'Seed expired' });
    } else if (status === RequestStatus.AWAITING_COMPLETION) {
      events.push({ type: RequestEventType.AUTO_REPLIED, actor: RequestEventActor.SYSTEM, note: 'Seed completion flow' });
    }

    await prisma.requestEvent.createMany({
      data: events.map((event) => ({
        requestId: request.id,
        type: event.type,
        actor: event.actor,
        note: event.note,
        metadata: { seedProfile: PROFILE, index: i },
      })),
    });
  }

  console.log(`Direct chunk complete (${count} requests).`);
}

async function seedReachCore() {
  console.log('Seeding Reach core (actors, memberships, policies)...');

  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${PREFIX}-` } },
    orderBy: { email: 'asc' },
    take: 40,
  });

  const humanActors: Array<{ id: string; type: ReachActorType }> = [];
  const aiActors: Array<{ id: string; type: ReachActorType }> = [];
  const orgActors: Array<{ id: string; type: ReachActorType }> = [];

  for (let i = 0; i < users.length; i += 1) {
    const idx = String(i + 1).padStart(3, '0');
    const handle = `${PREFIX}-human-${idx}`;
    const actor = await prisma.reachActor.upsert({
      where: { userId: users[i]!.id },
      update: { handle, type: ReachActorType.HUMAN, displayName: `Seed Human ${idx}`, isActive: true },
      create: {
        userId: users[i]!.id,
        handle,
        type: ReachActorType.HUMAN,
        displayName: `Seed Human ${idx}`,
      },
    });
    humanActors.push({ id: actor.id, type: actor.type });
  }

  for (let i = 1; i <= 24; i += 1) {
    const idx = String(i).padStart(3, '0');
    const handle = `${PREFIX}-ai-${idx}`;
    const apiKeyHash = crypto.createHash('sha256').update(`knk_${PREFIX}_ai_${idx}`).digest('hex');
    const actor = await prisma.reachActor.upsert({
      where: { handle },
      update: {
        type: ReachActorType.AI_AGENT,
        displayName: `Seed AI ${idx}`,
        apiKeyHash,
        isActive: true,
        agentMeta: { operatorName: `Seed Operator ${idx}`, modelId: 'seed-model', version: '1.0' },
      },
      create: {
        handle,
        type: ReachActorType.AI_AGENT,
        displayName: `Seed AI ${idx}`,
        apiKeyHash,
        isActive: true,
        agentMeta: { operatorName: `Seed Operator ${idx}`, modelId: 'seed-model', version: '1.0' },
      },
    });
    aiActors.push({ id: actor.id, type: actor.type });
  }

  for (let i = 1; i <= 16; i += 1) {
    const idx = String(i).padStart(3, '0');
    const handle = `${PREFIX}-org-${idx}`;
    const apiKeyHash = crypto.createHash('sha256').update(`knk_${PREFIX}_org_${idx}`).digest('hex');
    const actor = await prisma.reachActor.upsert({
      where: { handle },
      update: {
        type: ReachActorType.ORGANIZATION,
        displayName: `Seed Org ${idx}`,
        apiKeyHash,
        isActive: true,
      },
      create: {
        handle,
        type: ReachActorType.ORGANIZATION,
        displayName: `Seed Org ${idx}`,
        apiKeyHash,
        isActive: true,
      },
    });
    orgActors.push({ id: actor.id, type: actor.type });
  }

  for (let i = 0; i < orgActors.length; i += 1) {
    const org = orgActors[i]!;
    const owner = humanActors[i % humanActors.length]!;
    await prisma.reachOrgMember.upsert({
      where: { orgId_memberId: { orgId: org.id, memberId: owner.id } },
      update: { role: ReachOrgRole.OWNER, isActive: true },
      create: { orgId: org.id, memberId: owner.id, role: ReachOrgRole.OWNER, isActive: true },
    });
  }

  const policyTargets = [...humanActors, ...aiActors];
  await prisma.reachPolicy.deleteMany({ where: { name: { startsWith: `${PREFIX}-policy-` } } });

  for (let i = 1; i <= CONFIG.reachPolicies; i += 1) {
    const actor = policyTargets[(i - 1) % policyTargets.length]!;
    const action = pickByRand(
      [ReachPolicyAction.ACCEPT, ReachPolicyAction.ROUTE, ReachPolicyAction.ESCALATE, ReachPolicyAction.REJECT],
      hashRand(i, 'policy-action'),
    );

    await prisma.reachPolicy.create({
      data: {
        actorId: actor.id,
        name: `${PREFIX}-policy-${String(i).padStart(4, '0')}`,
        isActive: true,
        contractTypes:
          actor.type === ReachActorType.AI_AGENT
            ? [ReachContractType.HUMAN_AI, ReachContractType.AI_AI]
            : [ReachContractType.HUMAN_HUMAN, ReachContractType.AI_HUMAN],
        action,
        maxWeeklyInbound: 100,
        requireVerifiedSender: hashRand(i, 'policy-verify') < 0.5,
        autoAcceptMatching: action === ReachPolicyAction.ACCEPT,
        escalateToHuman: action === ReachPolicyAction.ESCALATE,
        filters: {
          requiredTags: ['seed'],
          purposeKeywords: ['pilot'],
        },
        priority: Math.floor(hashRand(i, 'policy-priority') * 1000),
      },
    });
  }

  console.log('Reach core seeded.');
}

async function seedReachContracts(start: number, count: number) {
  const end = start + count - 1;
  console.log(`Seeding reach contracts ${start}..${end}`);

  const actors = await prisma.reachActor.findMany({
    where: {
      handle: { startsWith: `${PREFIX}-` },
      type: { in: [ReachActorType.HUMAN, ReachActorType.AI_AGENT] },
      isActive: true,
    },
    select: { id: true, type: true },
    orderBy: { handle: 'asc' },
  });

  if (actors.length < 2) throw new Error('Not enough reach actors. Run --chunk reach-core first.');

  for (let i = start; i <= end; i += 1) {
    const init = actors[(i - 1) % actors.length]!;
    let target = actors[(i + 7) % actors.length]!;
    if (target.id === init.id) {
      target = actors[(i + 11) % actors.length]!;
    }

    const purpose = `Seed STAGING_LITE contract ${i}`;
    await prisma.reachContract.deleteMany({ where: { purpose } });

    const status = weightedReachStatus(i);

    const contract = await prisma.reachContract.create({
      data: {
        type: toReachType(init.type, target.type),
        status,
        initiatorId: init.id,
        targetId: target.id,
        purpose,
        message: `Seed reach contract ${i}`,
        structuredData: { seedProfile: PROFILE, index: i },
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

    const events: Array<{ type: ReachContractEventType; actor: ReachContractEventActor; note: string }> = [
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
        note: event.note,
        metadata: { seedProfile: PROFILE, index: i },
      })),
    });
  }

  console.log(`Reach contracts chunk complete (${count} contracts).`);
}

async function seedReachWebhooks() {
  console.log('Seeding reach webhooks...');

  await prisma.reachWebhook.deleteMany({ where: { description: { startsWith: `Seed ${PROFILE} webhook` } } });

  const actors = await prisma.reachActor.findMany({
    where: {
      handle: { startsWith: `${PREFIX}-` },
      type: { in: [ReachActorType.AI_AGENT, ReachActorType.ORGANIZATION] },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (!actors.length) throw new Error('No AI/ORG reach actors found. Run --chunk reach-core first.');

  for (let i = 1; i <= CONFIG.reachWebhooks; i += 1) {
    const actor = actors[(i - 1) % actors.length]!;
    await prisma.reachWebhook.create({
      data: {
        actorId: actor.id,
        url: `https://example.test/hooks/${PREFIX}/${i}`,
        secretHash: crypto.createHash('sha256').update(`${PREFIX}-webhook-${i}`).digest('hex'),
        events: [ReachContractEventType.CREATED, ReachContractEventType.ACCEPTED, ReachContractEventType.FULFILLED],
        description: `Seed ${PROFILE} webhook ${i}`,
        isActive: true,
      },
    });
  }

  console.log(`Reach webhooks seeded: ${CONFIG.reachWebhooks}`);
}

async function seedReachDeliveries(start: number, count: number) {
  const end = start + count - 1;
  console.log(`Seeding reach deliveries ${start}..${end}`);

  const webhooks = await prisma.reachWebhook.findMany({
    where: { description: { startsWith: `Seed ${PROFILE} webhook` } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const contracts = await prisma.reachContract.findMany({
    where: { purpose: { startsWith: 'Seed STAGING_LITE contract' } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!webhooks.length || !contracts.length) {
    throw new Error('Missing webhooks/contracts. Run reach chunks first.');
  }

  if (start === 1) {
    await prisma.reachWebhookDelivery.deleteMany({ where: { payload: { path: ['seedProfile'], equals: PROFILE } } });
  }

  for (let i = start; i <= end; i += 1) {
    await prisma.reachWebhookDelivery.create({
      data: {
        webhookId: webhooks[(i - 1) % webhooks.length]!.id,
        contractId: contracts[(i - 1) % contracts.length]!.id,
        event: pickByRand(
          [ReachContractEventType.CREATED, ReachContractEventType.ACCEPTED, ReachContractEventType.FULFILLED],
          hashRand(i, 'delivery-event'),
        ),
        status: hashRand(i, 'delivery-status') < 0.75 ? 'success' : hashRand(i, 'delivery-status') < 0.95 ? 'failed' : 'pending',
        httpStatus: hashRand(i, 'delivery-http') < 0.75 ? 200 : 500,
        attempts: (i % 3) + 1,
        lastError: hashRand(i, 'delivery-error') < 0.2 ? 'Seed transient failure' : null,
        payload: { seedProfile: PROFILE, deliveryIndex: i },
        deliveredAt: hashRand(i, 'delivery-delivered') < 0.75 ? new Date() : null,
      },
    });
  }

  console.log(`Reach deliveries chunk complete (${count} deliveries).`);
}

async function summary() {
  const [users, doors, requests, requestEvents, actors, policies, contracts, contractEvents, webhooks, deliveries] =
    await Promise.all([
      prisma.user.count({ where: { email: { startsWith: `${PREFIX}-` } } }),
      prisma.door.count({ where: { slug: { startsWith: `${PREFIX}-` } } }),
      prisma.request.count({ where: { title: { startsWith: 'Seed STAGING_LITE request' } } }),
      prisma.requestEvent.count({ where: { metadata: { path: ['seedProfile'], equals: PROFILE } } }),
      prisma.reachActor.count({ where: { handle: { startsWith: `${PREFIX}-` } } }),
      prisma.reachPolicy.count({ where: { name: { startsWith: `${PREFIX}-policy-` } } }),
      prisma.reachContract.count({ where: { purpose: { startsWith: 'Seed STAGING_LITE contract' } } }),
      prisma.reachContractEvent.count({ where: { metadata: { path: ['seedProfile'], equals: PROFILE } } }),
      prisma.reachWebhook.count({ where: { description: { startsWith: `Seed ${PROFILE} webhook` } } }),
      prisma.reachWebhookDelivery.count({ where: { payload: { path: ['seedProfile'], equals: PROFILE } } }),
    ]);

  console.log('\nSeed summary (staging-lite chunked)');
  console.log({ users, doors, requests, requestEvents, actors, policies, contracts, contractEvents, webhooks, deliveries });
}

async function main() {
  const { chunk, start, count } = parseArgs();

  switch (chunk) {
    case 'cleanup':
      await cleanup();
      break;
    case 'users':
      await seedUsers();
      break;
    case 'direct':
      if (count <= 0) throw new Error('--count is required for direct chunk');
      await seedDirectRequests(start, count);
      break;
    case 'reach-core':
      await seedReachCore();
      break;
    case 'reach-contracts':
      if (count <= 0) throw new Error('--count is required for reach-contracts chunk');
      await seedReachContracts(start, count);
      break;
    case 'reach-webhooks':
      await seedReachWebhooks();
      break;
    case 'reach-deliveries':
      if (count <= 0) throw new Error('--count is required for reach-deliveries chunk');
      await seedReachDeliveries(start, count);
      break;
    case 'summary':
      await summary();
      break;
    default:
      throw new Error(`Unsupported chunk ${chunk}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
