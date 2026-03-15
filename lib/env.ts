import { z } from 'zod';
import { assertBioOverrideNotInProduction } from './env-guards';

const requiredUrl = (name: string) =>
  z
    .string()
    .trim()
    .nonempty({ message: `${name} must be provided` })
    .url({ message: `${name} must be a valid URL` });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    APP_URL: requiredUrl('APP_URL'),
    NEXTAUTH_URL: requiredUrl('NEXTAUTH_URL'),
    NEXTAUTH_SECRET: z
      .string()
      .min(32, { message: 'NEXTAUTH_SECRET must be at least 32 characters' }),
    DATABASE_URL: z
      .string()
      .trim()
      .nonempty({ message: 'DATABASE_URL is required' }),
    // Stripe (optional — billing features degrade gracefully when unset)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID: z.string().optional(),
    // Social verification — dev-only override
    SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE: z.string().optional(),
  })
  .passthrough();

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;

// ---------------------------------------------------------------------------
// Hard startup guard — runs at env-parse time (earliest boot phase) so a
// misconfigured deploy fails immediately rather than at first request.
// ---------------------------------------------------------------------------
assertBioOverrideNotInProduction(
  env.NODE_ENV,
  env.SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE,
);
