'use server';

import { hash } from 'argon2';

import { db } from '../../../lib/db';
import { signupSchema } from '../../../lib/validation/auth';

export type SignupFormState = {
  status: 'idle' | 'error' | 'success';
  error?: string;
};

export async function registerUser(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const rawName = formData.get('name');
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');

  const parsed = signupSchema.safeParse({
    name: typeof rawName === 'string' ? rawName : undefined,
    email: typeof rawEmail === 'string' ? rawEmail : '',
    password: typeof rawPassword === 'string' ? rawPassword : ''
  });

  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? 'Invalid signup information';
    return { status: 'error', error: message };
  }

  const { name, email, password } = parsed.data;
  const existingUser = await db.user.findUnique({ where: { email } });

  if (existingUser) {
    return {
      status: 'error',
      error: 'An account already exists for this email. Please log in instead.'
    };
  }

  const passwordHash = await hash(password);

  try {
    await db.user.create({
      data: {
        email,
        name: name?.trim() || null,
        passwordHash
      }
    });
  } catch {
    return {
      status: 'error',
      error: 'Could not create your account right now. Please try again.'
    };
  }

  return { status: 'success' };
}
