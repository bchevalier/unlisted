import { PrismaClient, CategoryFieldType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const demoEmail = process.env.DEMO_KEEPER_EMAIL ?? 'john@knokio.local';
const demoName = process.env.DEMO_KEEPER_NAME ?? 'John';
const demoSlug = process.env.DEMO_DOOR_SLUG ?? 'john';
const demoAlias = process.env.DEMO_DOOR_ALIAS ?? demoSlug;
const demoPassword = process.env.DEMO_KEEPER_PASSWORD ?? 'changeme123456';

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: demoName, passwordHash },
    create: { email: demoEmail, name: demoName, passwordHash }
  });

  const door = await prisma.door.upsert({
    where: { userId: user.id },
    update: {
      slug: demoSlug,
      displayName: `${demoName}'s Door`,
      headline: 'Send a structured request. Noise stays out.'
    },
    create: {
      userId: user.id,
      slug: demoSlug,
      displayName: `${demoName}'s Door`,
      headline: 'Send a structured request. Noise stays out.'
    }
  });

  await prisma.doorSettings.upsert({
    where: { doorId: door.id },
    update: {},
    create: {
      doorId: door.id,
      autoReplyEnabled: false
    }
  });

  await prisma.emailAlias.upsert({
    where: { alias: demoAlias },
    update: { doorId: door.id, isEnabled: true },
    create: { alias: demoAlias, doorId: door.id }
  });

  const categories = [
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
        sortOrder: categorySeed.sortOrder
      },
      create: {
        doorId: door.id,
        key: categorySeed.key,
        label: categorySeed.label,
        description: categorySeed.description,
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
    `Seed complete: door /u/${door.slug}, alias ${demoAlias}@knokio.io, login ${demoEmail} / ${demoPassword}`
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
