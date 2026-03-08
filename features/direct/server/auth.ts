import { CategoryFieldType, DoorPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../../../lib/db';

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  desiredSlug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).optional(),
  plan: z.enum([DoorPlan.FREE, DoorPlan.PAID]).default(DoorPlan.FREE)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export class AuthValidationError extends Error {}

type CategorySeed = {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  fields: Array<{
    key: string;
    label: string;
    type: CategoryFieldType;
    required: boolean;
    sortOrder: number;
    placeholder?: string;
  }>;
};

const FREE_CATEGORY_SEED: CategorySeed[] = [
  {
    key: 'business',
    label: 'Business Inquiry',
    description: 'Partnerships, consulting, and commercial opportunities',
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
      {
        key: 'website',
        label: 'Website',
        type: CategoryFieldType.URL,
        required: false,
        sortOrder: 3
      }
    ]
  },
  {
    key: 'collab',
    label: 'Collaboration',
    description: 'Creator and project collaborations',
    sortOrder: 2,
    fields: [
      { key: 'project', label: 'Project name', type: CategoryFieldType.TEXT, required: true, sortOrder: 1 },
      { key: 'timeline', label: 'Timeline', type: CategoryFieldType.TEXT, required: false, sortOrder: 2 }
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

const PAID_CATEGORY_SEED: CategorySeed[] = [
  {
    key: 'product-placement',
    label: 'Product Placement',
    description: 'Brand campaigns, sponsored placements, and paid content slots',
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
      },
      {
        key: 'landing-page',
        label: 'Landing page',
        type: CategoryFieldType.URL,
        required: false,
        sortOrder: 5
      }
    ]
  },
  {
    key: 'advisory-access',
    label: 'Paid Advisory Access',
    description: 'Consulting sessions, strategy reviews, or priority expert access',
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
        key: 'urgency',
        label: 'Urgency',
        type: CategoryFieldType.TEXT,
        required: false,
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
        key: 'website',
        label: 'Website',
        type: CategoryFieldType.URL,
        required: false,
        sortOrder: 4
      }
    ]
  },
  {
    key: 'other-paid',
    label: 'Other Paid Opportunity',
    description: 'Everything else requiring paid priority review',
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
];

function normalizeSlug(input: string) {
  return input.trim().toLowerCase();
}

function fallbackSlug(email: string) {
  const localPart = email.split('@')[0] ?? 'keeper';
  return localPart
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const initial = base.length >= 2 ? base : `keeper-${Date.now().toString(36)}`;

  const existing = await db.door.findUnique({ where: { slug: initial }, select: { id: true } });
  if (!existing) {
    return initial;
  }

  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${initial}-${i}`.slice(0, 40);
    const exists = await db.door.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) {
      return candidate;
    }
  }

  throw new AuthValidationError('Unable to allocate unique door slug');
}

function getDefaultCategoriesForPlan(plan: DoorPlan): CategorySeed[] {
  return plan === DoorPlan.PAID ? PAID_CATEGORY_SEED : FREE_CATEGORY_SEED;
}

function getDefaultWeeklyCapForPlan(plan: DoorPlan): number | null {
  return plan === DoorPlan.PAID ? null : 50;
}

export async function signupKeeper(input: unknown) {
  const payload = signupSchema.parse(input);
  const email = payload.email.toLowerCase();

  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    throw new AuthValidationError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const slugBase = normalizeSlug(payload.desiredSlug ?? fallbackSlug(email));
  const slug = await ensureUniqueSlug(slugBase);
  const categorySeed = getDefaultCategoriesForPlan(payload.plan);

  const user = await db.user.create({
    data: {
      email,
      name: payload.name?.trim() || null,
      passwordHash,
      door: {
        create: {
          slug,
          displayName: payload.name?.trim() ? `${payload.name.trim()}'s Door` : `${slug}'s Door`,
          headline:
            payload.plan === DoorPlan.PAID
              ? 'Paid opportunities only. Send complete details for priority review.'
              : 'Send a structured request. Noise stays out.',
          plan: payload.plan,
          settings: {
            create: {
              autoReplyEnabled: false,
              weeklyRequestCap: getDefaultWeeklyCapForPlan(payload.plan)
            }
          },
          emailAliases: {
            create: {
              alias: slug
            }
          },
          categories: {
            create: categorySeed.map((category) => ({
              key: category.key,
              label: category.label,
              description: category.description,
              weeklyCap: payload.plan === DoorPlan.PAID ? null : 20,
              sortOrder: category.sortOrder,
              fields: {
                create: category.fields
              }
            }))
          }
        }
      }
    },
    select: {
      id: true,
      email: true,
      door: {
        select: {
          slug: true,
          plan: true
        }
      }
    }
  });

  return user;
}

export async function loginKeeper(input: unknown) {
  const payload = loginSchema.parse(input);
  const email = payload.email.toLowerCase();

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      door: {
        select: { slug: true, plan: true }
      }
    }
  });

  if (!user?.passwordHash) {
    throw new AuthValidationError('Invalid credentials');
  }

  const isValid = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isValid) {
    throw new AuthValidationError('Invalid credentials');
  }

  return {
    id: user.id,
    email: user.email,
    doorSlug: user.door?.slug ?? null,
    doorPlan: user.door?.plan ?? null
  };
}
