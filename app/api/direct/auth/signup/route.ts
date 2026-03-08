import { AuthActionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  AuthValidationError,
  shouldReturnAuthDebugTokens,
  signupKeeper
} from '../../../../../features/direct/server/auth';
import {
  enforceAuthRateLimit,
  extractClientIP,
  recordAuthAttempt
} from '../../../../../features/direct/server/auth-security';
import { sendEmailVerificationMail } from '../../../../../lib/auth-mailer';

export async function POST(request: Request) {
  const ipAddress = extractClientIP(request);
  const payload = await request.json().catch(() => ({}));
  const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;

  try {
    await enforceAuthRateLimit({
      action: AuthActionType.SIGNUP,
      ipAddress,
      maxByIp: 10,
      ipWindowMinutes: 15,
      email,
      maxByEmail: 5,
      emailWindowMinutes: 60
    });

    if (typeof payload?.website === 'string' && payload.website.trim().length > 0) {
      await recordAuthAttempt({
        action: AuthActionType.SIGNUP,
        ipAddress,
        email,
        success: false
      });

      return NextResponse.json({ ok: false, error: 'Invalid signup attempt' }, { status: 400 });
    }

    const user = await signupKeeper(payload);
    await sendEmailVerificationMail(user.email, user.verificationToken);

    await recordAuthAttempt({
      action: AuthActionType.SIGNUP,
      ipAddress,
      email: user.email,
      success: true
    });

    return NextResponse.json({
      ok: true,
      emailVerificationRequired: true,
      keeper: {
        email: user.email,
        doorSlug: user.door?.slug ?? null,
        doorPlan: user.door?.plan ?? null
      },
      debug: shouldReturnAuthDebugTokens()
        ? { emailVerificationToken: user.verificationToken }
        : undefined
    });
  } catch (error) {
    await recordAuthAttempt({
      action: AuthActionType.SIGNUP,
      ipAddress,
      email,
      success: false
    });

    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 429 });
  }
}
