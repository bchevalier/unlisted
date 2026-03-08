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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
