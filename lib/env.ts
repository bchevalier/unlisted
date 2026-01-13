import { z } from 'zod';

const requiredUrl = (name: string) =>
  z
    .string()
    .trim()
    .nonempty({ message: `${name} must be provided` })
    .url({ message: `${name} must be a valid URL` });

const envSchema = z.object({
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
  DIRECT_URL: z
    .string()
    .trim()
    .nonempty({ message: 'DIRECT_URL is required (non-pooled Postgres URL for migrations)' })
    .optional()
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL
});

export type Env = z.infer<typeof envSchema>;
