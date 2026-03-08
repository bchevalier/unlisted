import { PrismaClient, AuthProvider, CategoryFieldType, DoorPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const demoEmail = process.env.DEMO_KEEPER_EMAIL ?? 'john@knokio.local';
const demoName = process.env.DEMO_KEEPER_NAME ?? 'John';
const demoSlug = process.env.DEMO_DOOR_SLUG ?? 'john';
const demoAlias = process.env.DEMO_DOOR_ALIAS ?? demoSlug;
const demoPassword = process.env.DEMO_KEEPER_PASSWORD ?? 'changeme123456';
const demoPlan = process.env.DEMO_DOOR_PLAN === 'PAID' ? DoorPlan.PAID : DoorPlan.FREE;

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: demoName, passwordHash, emailVerifiedAt: new Date() },
    create: { email: demoEmail, name: demoName, passwordHash, emailVerifiedAt: new Date() }
  });

  await prisma.authIdentity.upsert({
    where: {
      provider_providerSubject: {
        provider: AuthProvider.PASSWORD,
        providerSubject: demoEmail.toLowerCase()
      }
    },
    update: {
      userId: user.id,
      providerEmail: demoEmail.toLowerCase()
    },
    create: {
      userId: user.id,
      provider: AuthProvider.PASSWORD,
      providerSubject: demoEmail.toLowerCase(),
      providerEmail: demoEmail.toLowerCase()
    }
  });

  const door = await prisma.door.upsert({
    where: { userId: user.id },
    update: {
      slug: demoSlug,
      displayName: `${demoName}'s Door`,
      plan: demoPlan,
      headline:
        demoPlan === DoorPlan.PAID
          ? 'Paid opportunities only. Send complete details for priority review.'
          : 'Send a structured request. Noise stays out.'
    },
    create: {
      userId: user.id,
      slug: demoSlug,
      displayName: `${demoName}'s Door`,
      plan: demoPlan,
      headline:
        demoPlan === DoorPlan.PAID
          ? 'Paid opportunities only. Send complete details for priority review.'
          : 'Send a structured request. Noise stays out.'
    }
  });

  await prisma.doorSettings.upsert({
    where: { doorId: door.id },
    update: {
      weeklyRequestCap: demoPlan === DoorPlan.PAID ? null : 50
    },
    create: {
      doorId: door.id,
      autoReplyEnabled: false,
      weeklyRequestCap: demoPlan === DoorPlan.PAID ? null : 50
    }
  });

  await prisma.emailAlias.upsert({
    where: { alias: demoAlias },
    update: { doorId: door.id, isEnabled: true },
    create: { alias: demoAlias, doorId: door.id }
  });

  const categories =
    demoPlan === DoorPlan.PAID
      ? [
          {
            key: 'product-placement',
            label: 'Product Placement',
            description: 'Brand campaigns and sponsored placements',
            sortOrder: 1,
            fields: [
              { key: 'brand', label: 'Brand', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              {
                key: 'campaign-brief',
                label: 'Campaign brief',
                type: CategoryFieldType.TEXTAREA,
                required: true,
                sortOrder: 2
              },
              {
                key: 'budget',
                label: 'Budget (NZD)',
                type: CategoryFieldType.NUMBER,
                required: true,
                sortOrder: 3
              },
              {
                key: 'timeline',
                label: 'Timeline',
                type: CategoryFieldType.TEXT,
                required: true,
                sortOrder: 4
              }
            ]
          },
          {
            key: 'advisory-access',
            label: 'Paid Advisory Access',
            description: 'Paid consulting sessions and expert access',
            sortOrder: 2,
            fields: [
              {
                key: 'topic',
                label: 'What do you need help with?',
                type: CategoryFieldType.TEXTAREA,
                required: true,
                sortOrder: 1
              },
              {
                key: 'budget',
                label: 'Budget (NZD)',
                type: CategoryFieldType.NUMBER,
                required: true,
                sortOrder: 2
              },
              {
                key: 'urgency',
                label: 'Urgency',
                type: CategoryFieldType.TEXT,
                required: false,
                sortOrder: 3
              }
            ]
          },
          {
            key: 'other-paid',
            label: 'Other Paid Opportunity',
            description: 'Other paid opportunities requiring priority review',
            sortOrder: 3,
            fields: [
              {
                key: 'budget',
                label: 'Budget (NZD)',
                type: CategoryFieldType.NUMBER,
                required: true,
                sortOrder: 1
              }
            ]
          }
        ]
      : [
          {
            key: 'business',
            label: 'Business Inquiry',
            description: 'Partnerships, consulting, commercial opportunities',
            sortOrder: 1,
            fields: [
              { key: 'company', label: 'Company', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              {
                key: 'budget',
                label: 'Budget (NZD)',
                type: CategoryFieldType.NUMBER,
                required: false,
                sortOrder: 2
              },
              { key: 'website', label: 'Website', type: CategoryFieldType.URL, required: false, sortOrder: 3 }
            ]
          },
          {
            key: 'collab',
            label: 'Collaboration',
            description: 'Creator and project collaborations',
            sortOrder: 2,
            fields: [
              { key: 'project', label: 'Project Name', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
              {
                key: 'timeline',
                label: 'Timeline',
                type: CategoryFieldType.TEXT,
                required: false,
                sortOrder: 2
              }
            ]
          },
          {
            key: 'other',
            label: 'Other',
            description: 'General request',
            sortOrder: 3,
            fields: []
          }
        ];

  for (const categorySeed of categories) {
    const category = await prisma.category.upsert({
      where: { doorId_key: { doorId: door.id, key: categorySeed.key } },
      update: {
        label: categorySeed.label,
        description: categorySeed.description,
        isEnabled: true,
        weeklyCap: demoPlan === DoorPlan.PAID ? null : 20,
        sortOrder: categorySeed.sortOrder
      },
      create: {
        doorId: door.id,
        key: categorySeed.key,
        label: categorySeed.label,
        description: categorySeed.description,
        weeklyCap: demoPlan === DoorPlan.PAID ? null : 20,
        sortOrder: categorySeed.sortOrder
      }
    });

    for (const field of categorySeed.fields) {
      await prisma.categoryField.upsert({
        where: { categoryId_key: { categoryId: category.id, key: field.key } },
        update: {
          label: field.label,
          type: field.type,
          required: field.required,
          sortOrder: field.sortOrder
        },
        create: {
          categoryId: category.id,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          sortOrder: field.sortOrder
        }
      });
    }
  }

  console.log(
    `Seed complete: plan ${demoPlan}, door /u/${door.slug}, alias ${demoAlias}@knokio.io, login ${demoEmail} / ${demoPassword}`
  );

  // ---------------------------------------------------------------------------
  // Reach pilot seed data
  // ---------------------------------------------------------------------------

  const reachEnabled = process.env.ENABLE_REACH !== 'false';
  if (!reachEnabled) {
    console.log('Reach disabled — skipping Reach seed data.');
    return;
  }

  // 1. Human actor linked to the demo keeper
  const humanActor = await prisma.reachActor.upsert({
    where: { userId: user.id },
    update: {
      handle: demoSlug,
      displayName: demoName,
      type: 'HUMAN',
    },
    create: {
      userId: user.id,
      type: 'HUMAN',
      handle: demoSlug,
      displayName: demoName,
    },
  });

  // 2. AI agent actor (headless, API-key auth)
  const aiAgentKey = 'knk_demo_ai_agent_key_for_local_testing_only';
  const aiAgentHash = (await import('crypto')).createHash('sha256').update(aiAgentKey).digest('hex');

  const aiActor = await prisma.reachActor.upsert({
    where: { handle: 'demo-ai-agent' },
    update: {
      displayName: 'Demo AI Agent',
      type: 'AI_AGENT',
      apiKeyHash: aiAgentHash,
      endpoint: 'http://localhost:4000/webhook',
      capabilities: { intents: ['summarize', 'draft-reply', 'triage'] },
    },
    create: {
      type: 'AI_AGENT',
      handle: 'demo-ai-agent',
      displayName: 'Demo AI Agent',
      apiKeyHash: aiAgentHash,
      endpoint: 'http://localhost:4000/webhook',
      capabilities: { intents: ['summarize', 'draft-reply', 'triage'] },
    },
  });

  // 3. Organization actor (headless)
  const orgKey = 'knk_demo_org_key_for_local_testing_only';
  const orgHash = (await import('crypto')).createHash('sha256').update(orgKey).digest('hex');

  const orgActor = await prisma.reachActor.upsert({
    where: { handle: 'demo-org' },
    update: {
      displayName: 'Demo Organization',
      type: 'ORGANIZATION',
      apiKeyHash: orgHash,
    },
    create: {
      type: 'ORGANIZATION',
      handle: 'demo-org',
      displayName: 'Demo Organization',
      apiKeyHash: orgHash,
    },
  });

  // 4. Add human + AI as org members
  await prisma.reachOrgMember.upsert({
    where: { orgId_memberId: { orgId: orgActor.id, memberId: humanActor.id } },
    update: { role: 'OWNER', isActive: true },
    create: { orgId: orgActor.id, memberId: humanActor.id, role: 'OWNER' },
  });

  await prisma.reachOrgMember.upsert({
    where: { orgId_memberId: { orgId: orgActor.id, memberId: aiActor.id } },
    update: { role: 'MEMBER', isActive: true },
    create: { orgId: orgActor.id, memberId: aiActor.id, role: 'MEMBER' },
  });

  // 5. Policies for human actor
  const humanPolicies = [
    {
      name: 'Auto-accept verified humans',
      contractTypes: ['HUMAN_HUMAN'],
      action: 'ACCEPT',
      requireVerifiedSender: true,
      autoAcceptMatching: true,
      escalateToHuman: false,
      priority: 100,
      maxWeeklyInbound: 20,
    },
    {
      name: 'Route AI inbound for review',
      contractTypes: ['AI_HUMAN'],
      action: 'ROUTE',
      requireVerifiedSender: false,
      autoAcceptMatching: false,
      escalateToHuman: false,
      priority: 50,
      maxWeeklyInbound: 10,
    },
    {
      name: 'Escalate unverified senders',
      contractTypes: ['HUMAN_HUMAN'],
      action: 'ESCALATE',
      requireVerifiedSender: false,
      autoAcceptMatching: false,
      escalateToHuman: true,
      priority: 10,
      maxWeeklyInbound: 5,
    },
  ];

  for (const p of humanPolicies) {
    const existing = await prisma.reachPolicy.findFirst({
      where: { actorId: humanActor.id, name: p.name },
    });
    if (!existing) {
      await prisma.reachPolicy.create({
        data: { actorId: humanActor.id, ...p },
      });
    }
  }

  // 6. Policies for AI actor
  const aiPolicies = [
    {
      name: 'Accept human requests',
      contractTypes: ['HUMAN_AI'],
      action: 'ACCEPT',
      requireVerifiedSender: false,
      autoAcceptMatching: true,
      escalateToHuman: false,
      priority: 100,
      maxWeeklyInbound: 50,
    },
    {
      name: 'Accept AI-to-AI',
      contractTypes: ['AI_AI'],
      action: 'ACCEPT',
      requireVerifiedSender: false,
      autoAcceptMatching: true,
      escalateToHuman: false,
      priority: 90,
      maxWeeklyInbound: 100,
    },
  ];

  for (const p of aiPolicies) {
    const existing = await prisma.reachPolicy.findFirst({
      where: { actorId: aiActor.id, name: p.name },
    });
    if (!existing) {
      await prisma.reachPolicy.create({
        data: { actorId: aiActor.id, ...p },
      });
    }
  }

  // 7. Sample contracts to populate pilot metrics
  const sampleContracts = [
    {
      type: 'HUMAN_AI',
      initiatorId: humanActor.id,
      targetId: aiActor.id,
      purpose: 'Summarize my weekly inbox digest',
      message: 'Please provide a summary of key action items from this week.',
      status: 'FULFILLED',
    },
    {
      type: 'AI_HUMAN',
      initiatorId: aiActor.id,
      targetId: humanActor.id,
      purpose: 'Triage escalation: potential partnership inquiry',
      message: 'High-confidence match for advisory access category.',
      status: 'ACTIVE',
    },
    {
      type: 'HUMAN_HUMAN',
      initiatorId: humanActor.id,
      targetId: humanActor.id, // self not allowed in prod, but for seed demo...
      purpose: 'Test self-contract (seed data)',
      status: 'REJECTED',
    },
  ];

  // Only create sample contracts if none exist yet.
  const existingContracts = await prisma.reachContract.count();
  if (existingContracts === 0) {
    for (const sc of sampleContracts) {
      // Skip self-referencing contracts (not allowed by domain rules).
      if (sc.initiatorId === sc.targetId) continue;

      const contract = await prisma.reachContract.create({
        data: {
          type: sc.type,
          status: sc.status,
          initiatorId: sc.initiatorId,
          targetId: sc.targetId,
          purpose: sc.purpose,
          message: sc.message ?? null,
          routedAt: ['ACTIVE', 'FULFILLED'].includes(sc.status) ? new Date() : null,
          resolvedAt: ['FULFILLED', 'REJECTED'].includes(sc.status) ? new Date() : null,
        },
      });

      // Create lifecycle events.
      await prisma.reachContractEvent.create({
        data: {
          contractId: contract.id,
          type: 'CREATED',
          actor: 'SYSTEM',
        },
      });

      if (['ACTIVE', 'FULFILLED'].includes(sc.status)) {
        await prisma.reachContractEvent.create({
          data: {
            contractId: contract.id,
            type: 'ACCEPTED',
            actor: 'SYSTEM',
            note: 'Auto-accepted by policy (seed)',
          },
        });
      }

      if (sc.status === 'FULFILLED') {
        await prisma.reachContractEvent.create({
          data: {
            contractId: contract.id,
            type: 'FULFILLED',
            actor: 'TARGET',
            note: 'Completed (seed)',
          },
        });
      }

      if (sc.status === 'REJECTED') {
        await prisma.reachContractEvent.create({
          data: {
            contractId: contract.id,
            type: 'REJECTED',
            actor: 'SYSTEM',
            note: 'Rejected by policy (seed)',
          },
        });
      }
    }
  }

  console.log(
    `Reach seed complete: actors [@${humanActor.handle}, @${aiActor.handle}, @${orgActor.handle}]` +
    `\n  AI agent API key: ${aiAgentKey}` +
    `\n  Org API key: ${orgKey}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
