import { z } from 'zod';

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
      .nonempty({ message: 'DATABASE_URL is required' })
  })
  .strict();

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
