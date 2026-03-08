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

const externalAuthProviders = [AuthProvider.GOOGLE, AuthProvider.APPLE, AuthProvider.LINKEDIN, AuthProvider.PRIVY] as const;

type ExternalAuthProvider = (typeof externalAuthProviders)[number];

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

export class AuthValidationError extends Error {}

function normalizeSlug(input: string) {
  return input.trim().toLowerCase();
}

function fallbackSlug(seed: string) {
  const localPart = seed.split('@')[0] ?? 'keeper';
  return localPart
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
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

function getDefaultCategoriesForPlan(plan: DoorPlan): CategorySeed[] {
  return plan === DoorPlan.PAID ? PAID_CATEGORY_SEED : FREE_CATEGORY_SEED;
}

function getDefaultWeeklyCapForPlan(plan: DoorPlan): number | null {
  return plan === DoorPlan.PAID ? null : 50;
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

function doorHeadlineForPlan(plan: DoorPlan) {
  return plan === DoorPlan.PAID
    ? 'Paid opportunities only. Send complete details for priority review.'
    : 'Send a structured request. Noise stays out.';
}

async function createDoorForUser(params: {
  userId: string;
  displayNameSeed: string;
  slugSeed: string;
  desiredSlug?: string;
  plan: DoorPlan;
}) {
  const slugBase = normalizeSlug(params.desiredSlug ?? fallbackSlug(params.slugSeed));
  const slug = await ensureUniqueSlug(slugBase);
  const categorySeed = getDefaultCategoriesForPlan(params.plan);

  return db.door.create({
    data: {
      userId: params.userId,
      slug,
      displayName: `${params.displayNameSeed}'s Door`,
      headline: doorHeadlineForPlan(params.plan),
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
