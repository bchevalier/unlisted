import { z } from 'zod';

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, { message: 'Name must be shorter than 80 characters' })
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      return value === '' ? undefined : value;
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Email must be valid' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(128, { message: 'Password is too long' })
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Email must be valid' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(128, { message: 'Password is too long' })
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
