import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../../../lib/db';

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  desiredSlug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export class AuthValidationError extends Error {}

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

  const user = await db.user.create({
    data: {
      email,
      name: payload.name?.trim() || null,
      passwordHash,
      door: {
        create: {
          slug,
          displayName: payload.name?.trim() ? `${payload.name.trim()}'s Door` : `${slug}'s Door`,
          headline: 'Send a structured request. Noise stays out.',
          settings: {
            create: {
              autoReplyEnabled: false
            }
          },
          emailAliases: {
            create: {
              alias: slug
            }
          }
        }
      }
    },
    select: {
      id: true,
      email: true,
      door: {
        select: {
          slug: true
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
        select: { slug: true }
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
    doorSlug: user.door?.slug ?? null
  };
}
