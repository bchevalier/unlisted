import crypto from 'node:crypto';
import { AuthProvider, CategoryFieldType, DoorPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../../../lib/db';
import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  consumeTwoFactorChallengeToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  createTwoFactorChallengeToken,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSetup,
  hashRecoveryCode,
  verifyTotpCode
} from './auth-security';
import { getDirectPlanEntitlements } from './plan-entitlements';
import {
  DIRECT_ONBOARDING_PRESETS,
  getDirectPresetConfig,
  type CategorySeed,
  type DirectOnboardingPreset,
} from './onboarding-presets';

const externalAuthProviders = [AuthProvider.GOOGLE, AuthProvider.APPLE, AuthProvider.LINKEDIN, AuthProvider.PRIVY] as const;

type ExternalAuthProvider = (typeof externalAuthProviders)[number];

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  desiredSlug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).optional(),
  preset: z.enum(DIRECT_ONBOARDING_PRESETS).default('CREATOR'),
  plan: z.enum([DoorPlan.FREE, DoorPlan.PAID]).default(DoorPlan.FREE)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

const externalIdentitySchema = z.object({
  provider: z
    .nativeEnum(AuthProvider)
    .refine((value) => externalAuthProviders.includes(value as ExternalAuthProvider), {
      message: 'Provider must be GOOGLE, APPLE, LINKEDIN, or PRIVY'
    }),
  providerSubject: z.string().trim().min(1).max(255),
  email: z.string().trim().email().optional(),
  emailVerified: z.boolean().default(false),
  name: z.string().trim().min(1).max(120).optional(),
  walletAddress: z.string().trim().min(6).max(120).optional(),
  desiredSlug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).optional(),
  preset: z.enum(DIRECT_ONBOARDING_PRESETS).default('CREATOR'),
  plan: z.enum([DoorPlan.FREE, DoorPlan.PAID]).default(DoorPlan.FREE)
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(10),
  newPassword: z.string().min(10).max(200)
});

const verifyTwoFactorSchema = z.object({
  challengeToken: z.string().trim().min(10),
  code: z.string().trim().min(6).max(20)
});

const confirmTwoFactorSetupSchema = z.object({
  code: z.string().trim().min(6).max(20)
});

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

export class AuthValidationError extends Error {}

// ---------------------------------------------------------------------------
// Slug generation — robust, collision-resistant, with reserved-word protection
// ---------------------------------------------------------------------------

/**
 * Reserved slugs that must never be assigned to a user door.
 * Includes route prefixes, product terms, and common vanity targets.
 */
const RESERVED_SLUGS = new Set([
  // App routes & API namespaces
  'admin', 'api', 'direct', 'reach', 'u', 'r', 'complete',
  'app', 'auth', 'login', 'signup', 'logout', 'register',
  'settings', 'inbox', 'dashboard', 'billing', 'account',
  // Product terms
  'knokio', 'door', 'doors', 'keeper', 'keepers', 'knocker', 'knockers',
  'request', 'requests', 'category', 'categories',
  // Infrastructure
  'www', 'mail', 'email', 'smtp', 'imap', 'pop', 'ftp', 'ssh',
  'cdn', 'assets', 'static', 'public', 'private',
  'help', 'support', 'status', 'health', 'healthz',
  'webhook', 'webhooks', 'cron', 'internal',
  // Common vanity / abuse vectors
  'test', 'demo', 'example', 'root', 'system', 'null', 'undefined',
  'info', 'contact', 'abuse', 'postmaster', 'webmaster', 'noreply', 'no-reply',
]);

function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

function normalizeSlug(input: string) {
  return input.trim().toLowerCase();
}

/**
 * Sanitise an arbitrary seed string into a valid slug candidate.
 * Strips invalid chars, collapses dashes, trims to 40 chars.
 */
function sanitizeSlugCandidate(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function fallbackSlug(seed: string) {
  const localPart = seed.split('@')[0] ?? 'keeper';
  return sanitizeSlugCandidate(localPart);
}

/** Generate a short random suffix (6 chars, base-36). */
function randomSuffix(): string {
  return crypto.randomBytes(4).toString('hex').slice(0, 6);
}

function normalizeEmail(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase();
}

function syntheticEmailForIdentity(provider: ExternalAuthProvider, providerSubject: string) {
  const hash = crypto.createHash('sha256').update(`${provider}:${providerSubject}`).digest('hex').slice(0, 24);
  return `id-${hash}@auth.knokio.local`;
}

function getDefaultCategoriesForPlan(plan: DoorPlan, preset: DirectOnboardingPreset = 'CREATOR'): CategorySeed[] {
  if (plan === DoorPlan.PAID && preset === 'CREATOR') {
    return PAID_CATEGORY_SEED;
  }

  return getDirectPresetConfig(preset, plan).categories;
}

function getDefaultWeeklyCapForPlan(plan: DoorPlan): number | null {
  return plan === DoorPlan.PAID ? null : 50;
}

/**
 * Ensure the given base slug is unique, non-reserved, and at least 2 chars.
 *
 * Strategy:
 *  1. If the base is reserved or too short, append a random suffix.
 *  2. Try the candidate as-is.
 *  3. On collision, append a random suffix (not sequential numbers — avoids
 *     information leakage about existing users).
 *  4. Up to 10 attempts with fresh randomness before giving up.
 */
async function ensureUniqueSlug(base: string): Promise<string> {
  let initial = base.length >= 2 ? base : `keeper-${randomSuffix()}`;

  // Block reserved slugs — always append randomness
  if (isReservedSlug(initial)) {
    initial = `${initial}-${randomSuffix()}`.slice(0, 40);
  }

  const existing = await db.door.findUnique({ where: { slug: initial }, select: { id: true } });
  if (!existing) {
    return initial;
  }

  // Collision: try with random suffixes (not sequential — prevents enumeration)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}-${randomSuffix()}`.slice(0, 40);
    // Double-check the random candidate isn't itself reserved
    if (isReservedSlug(candidate)) continue;
    const exists = await db.door.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) {
      return candidate;
    }
  }

  throw new AuthValidationError('Unable to allocate unique door slug');
}

function doorHeadlineForPlan(plan: DoorPlan, preset: DirectOnboardingPreset = 'CREATOR') {
  return getDirectPresetConfig(preset, plan).headline;
}

async function createDoorForUser(params: {
  userId: string;
  displayNameSeed: string;
  slugSeed: string;
  desiredSlug?: string;
  preset?: 'CREATOR' | 'ADVISOR' | 'PUBLIC_FACING';
  plan: DoorPlan;
}) {
  const entitlements = getDirectPlanEntitlements(params.plan);
  const existingDoorCount = await db.door.count({ where: { userId: params.userId } });

  if (existingDoorCount >= entitlements.maxDoors) {
    throw new AuthValidationError('Current Direct plan allows only one door per account');
  }

  // MVP note: web-form intake is the only public door surface right now, so
  // maxFormDoors is documented here even before multiple door types ship.
  if (entitlements.maxFormDoors < 1) {
    throw new AuthValidationError('Current Direct plan does not allow form doors');
  }

  const preset = params.preset ?? 'CREATOR';
  const slugBase = normalizeSlug(params.desiredSlug ?? fallbackSlug(params.slugSeed));
  const slug = await ensureUniqueSlug(slugBase);
  const categorySeed = getDefaultCategoriesForPlan(params.plan, preset);

  return db.door.create({
    data: {
      userId: params.userId,
      slug,
      displayName: `${params.displayNameSeed}'s Door`,
      headline: doorHeadlineForPlan(params.plan, preset),
      plan: params.plan,
      settings: {
        create: {
          autoReplyEnabled: false,
          weeklyRequestCap: getDefaultWeeklyCapForPlan(params.plan)
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
          weeklyCap: params.plan === DoorPlan.PAID ? null : 20,
          sortOrder: category.sortOrder,
          fields: {
            create: category.fields
          }
        }))
      }
    },
    select: {
      slug: true,
      plan: true
    }
  });
}

async function ensureDoorForUser(params: {
  userId: string;
  displayNameSeed: string;
  slugSeed: string;
  desiredSlug?: string;
  preset?: 'CREATOR' | 'ADVISOR' | 'PUBLIC_FACING';
  plan: DoorPlan;
}) {
  const existing = await db.door.findUnique({
    where: { userId: params.userId },
    select: { slug: true, plan: true }
  });

  if (existing) {
    return existing;
  }

  return createDoorForUser(params);
}

type AuthResult = {
  id: string;
  email: string;
  doorSlug: string | null;
  doorPlan: DoorPlan | null;
};

export type LoginKeeperResult =
  | {
      status: 'authenticated';
      keeper: AuthResult;
    }
  | {
      status: 'requires_two_factor';
      challengeToken: string;
      email: string;
    };

function toAuthResult(input: { id: string; email: string; door: { slug: string; plan: DoorPlan } | null }): AuthResult {
  return {
    id: input.id,
    email: input.email,
    doorSlug: input.door?.slug ?? null,
    doorPlan: input.door?.plan ?? null
  };
}

export function shouldReturnAuthDebugTokens() {
  return process.env.AUTH_DEBUG_RETURN_TOKENS === 'true' || process.env.NODE_ENV !== 'production';
}

export async function signupKeeper(input: unknown) {
  const payload = signupSchema.parse(input);
  const email = normalizeEmail(payload.email);

  if (!email) {
    throw new AuthValidationError('Email required');
  }

  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    throw new AuthValidationError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const displayName = payload.name?.trim() || email.split('@')[0] || 'keeper';

  const user = await db.user.create({
    data: {
      email,
      name: payload.name?.trim() || null,
      passwordHash,
      identities: {
        create: {
          provider: AuthProvider.PASSWORD,
          providerSubject: email,
          providerEmail: email
        }
      }
    },
    select: {
      id: true,
      email: true
    }
  });

  const door = await createDoorForUser({
    userId: user.id,
    displayNameSeed: displayName,
    slugSeed: email,
    desiredSlug: payload.desiredSlug,
    preset: payload.preset,
    plan: payload.plan
  });

  const verificationToken = await createEmailVerificationToken(user.id);

  return {
    id: user.id,
    email: user.email,
    emailVerified: false,
    verificationToken,
    door: {
      slug: door.slug,
      plan: door.plan
    }
  };
}

export async function loginKeeper(input: unknown): Promise<LoginKeeperResult> {
  const payload = loginSchema.parse(input);
  const email = normalizeEmail(payload.email);

  if (!email) {
    throw new AuthValidationError('Invalid credentials');
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
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

  if (!user.emailVerifiedAt) {
    throw new AuthValidationError('Email verification required');
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const challengeToken = await createTwoFactorChallengeToken(user.id);
    return {
      status: 'requires_two_factor',
      challengeToken,
      email: user.email
    };
  }

  return {
    status: 'authenticated',
    keeper: toAuthResult(user)
  };
}

export async function verifyTwoFactorLogin(input: unknown) {
  const payload = verifyTwoFactorSchema.parse(input);

  const userId = await consumeTwoFactorChallengeToken(payload.challengeToken);
  if (!userId) {
    throw new AuthValidationError('Invalid or expired two-factor challenge');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      door: {
        select: {
          slug: true,
          plan: true
        }
      },
      recoveryCodes: {
        where: {
          usedAt: null
        },
        select: {
          id: true,
          codeHash: true
        }
      }
    }
  });

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AuthValidationError('Two-factor auth is not enabled for this account');
  }

  const decryptedSecret = decryptSecret(user.twoFactorSecret);
  const twoFactorValid = verifyTotpCode(decryptedSecret, payload.code);

  if (!twoFactorValid) {
    const hashedCode = hashRecoveryCode(payload.code);
    const recoveryCode = user.recoveryCodes.find((item) => item.codeHash === hashedCode);

    if (!recoveryCode) {
      throw new AuthValidationError('Invalid two-factor code');
    }

    await db.twoFactorRecoveryCode.update({
      where: { id: recoveryCode.id },
      data: { usedAt: new Date() }
    });
  }

  return toAuthResult(user);
}

export async function startTwoFactorSetup(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true
    }
  });

  if (!user) {
    throw new AuthValidationError('User not found');
  }

  if (!user.emailVerifiedAt) {
    throw new AuthValidationError('Verify email before enabling 2FA');
  }

  const setup = generateTotpSetup(user.email);
  await db.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: encryptSecret(setup.secret),
      twoFactorEnabled: false
    }
  });

  return setup;
}

export async function confirmTwoFactorSetup(userId: string, input: unknown) {
  const payload = confirmTwoFactorSetupSchema.parse(input);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      twoFactorSecret: true
    }
  });

  if (!user?.twoFactorSecret) {
    throw new AuthValidationError('Two-factor setup has not been started');
  }

  const secret = decryptSecret(user.twoFactorSecret);
  const valid = verifyTotpCode(secret, payload.code);
  if (!valid) {
    throw new AuthValidationError('Invalid setup code');
  }

  const recoveryCodes = generateRecoveryCodes(8);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptSecret(secret)
      }
    });

    await tx.twoFactorRecoveryCode.deleteMany({
      where: {
        userId: user.id
      }
    });

    await tx.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.hashes.map((codeHash) => ({
        userId: user.id,
        codeHash
      }))
    });
  });

  return {
    recoveryCodes: recoveryCodes.plain
  };
}

export async function disableTwoFactor(userId: string) {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    });

    await tx.twoFactorRecoveryCode.deleteMany({
      where: {
        userId
      }
    });
  });
}

export async function resendEmailVerification(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      emailVerifiedAt: true
    }
  });

  if (!user || user.emailVerifiedAt) {
    return null;
  }

  const verificationToken = await createEmailVerificationToken(user.id);
  return verificationToken;
}

export async function verifyEmailToken(token: string) {
  const userId = await consumeEmailVerificationToken(token);
  if (!userId) {
    throw new AuthValidationError('Invalid or expired verification token');
  }

  return userId;
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      passwordHash: true
    }
  });

  if (!user || !user.passwordHash) {
    return null;
  }

  const resetToken = await createPasswordResetToken(user.id);
  return resetToken;
}

export async function resetPasswordWithToken(input: unknown) {
  const payload = resetPasswordSchema.parse(input);
  const userId = await consumePasswordResetToken(payload.token);

  if (!userId) {
    throw new AuthValidationError('Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(payload.newPassword, 12);

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash
    }
  });
}

export async function authenticateKeeperWithExternalIdentity(input: unknown) {
  const payload = externalIdentitySchema.parse(input);
  const provider = payload.provider as ExternalAuthProvider;
  const normalizedEmail = normalizeEmail(payload.email);
  const normalizedWallet = payload.walletAddress?.trim().toLowerCase() || null;

  const existingIdentity = await db.authIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider,
        providerSubject: payload.providerSubject
      }
    },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerifiedAt: true,
          door: {
            select: {
              slug: true,
              plan: true
            }
          }
        }
      }
    }
  });

  if (existingIdentity?.user) {
    if (!existingIdentity.user.emailVerifiedAt && payload.emailVerified) {
      await db.user.update({
        where: { id: existingIdentity.user.id },
        data: { emailVerifiedAt: new Date() }
      });
    }

    return toAuthResult(existingIdentity.user);
  }

  let user =
    normalizedEmail !== null
      ? await db.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true, email: true, name: true, emailVerifiedAt: true, door: { select: { slug: true, plan: true } } }
        })
      : null;

  if (!user && provider === AuthProvider.PRIVY && normalizedWallet) {
    const walletIdentity = await db.authIdentity.findFirst({
      where: {
        provider: AuthProvider.PRIVY,
        walletAddress: normalizedWallet
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerifiedAt: true,
            door: {
              select: {
                slug: true,
                plan: true
              }
            }
          }
        }
      }
    });

    user = walletIdentity?.user ?? null;
  }

  if (!user) {
    const syntheticEmail = syntheticEmailForIdentity(provider, payload.providerSubject);
    const accountEmail = normalizedEmail ?? syntheticEmail;
    const displayName = payload.name?.trim() || accountEmail.split('@')[0] || 'keeper';

    const created = await db.user.create({
      data: {
        email: accountEmail,
        emailVerifiedAt: payload.emailVerified ? new Date() : null,
        name: payload.name?.trim() || null
      },
      select: {
        id: true,
        email: true,
        name: true,
        door: {
          select: {
            slug: true,
            plan: true
          }
        }
      }
    });

    const door = await createDoorForUser({
      userId: created.id,
      displayNameSeed: displayName,
      slugSeed: accountEmail,
      desiredSlug: payload.desiredSlug,
      preset: payload.preset,
      plan: payload.plan
    });

    await db.authIdentity.create({
      data: {
        userId: created.id,
        provider,
        providerSubject: payload.providerSubject,
        providerEmail: normalizedEmail,
        walletAddress: normalizedWallet
      }
    });

    return {
      id: created.id,
      email: created.email,
      doorSlug: door.slug,
      doorPlan: door.plan
    };
  }

  const existingProviderIdentity = await db.authIdentity.findFirst({
    where: {
      userId: user.id,
      provider
    },
    select: {
      providerSubject: true
    }
  });

  if (existingProviderIdentity && existingProviderIdentity.providerSubject !== payload.providerSubject) {
    throw new AuthValidationError(`This account is already linked to a different ${provider} identity`);
  }

  if (!existingProviderIdentity) {
    await db.authIdentity.create({
      data: {
        userId: user.id,
        provider,
        providerSubject: payload.providerSubject,
        providerEmail: normalizedEmail,
        walletAddress: normalizedWallet
      }
    });
  }

  if (!user.emailVerifiedAt && payload.emailVerified) {
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date()
      }
    });
  }

  const door = await ensureDoorForUser({
    userId: user.id,
    displayNameSeed: user.name?.trim() || user.email.split('@')[0] || 'keeper',
    slugSeed: user.email,
    desiredSlug: payload.desiredSlug,
    plan: payload.plan
  });

  return {
    id: user.id,
    email: user.email,
    doorSlug: door.slug,
    doorPlan: door.plan
  };
}
