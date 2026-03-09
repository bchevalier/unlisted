import { AuthActionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { AuthValidationError, verifyEmailToken } from '../../../../../../../features/direct/server/auth';
import {
  enforceAuthRateLimit,
  extractClientIP,
  recordAuthAttempt
} from '../../../../../../../features/direct/server/auth-security';
import { captureException } from '../../../../../../../lib/error-tracking';
import { logger } from '../../../../../../../lib/logger';

const log = logger('auth:email-verify');

const confirmSchema = z.object({
  token: z.string().trim().min(10)
});

export async function POST(request: Request) {
  const ipAddress = extractClientIP(request);
  const payload = await request.json().catch(() => ({}));

  try {
    await enforceAuthRateLimit({
      action: AuthActionType.EMAIL_VERIFICATION,
      ipAddress,
      maxByIp: 30,
      ipWindowMinutes: 30
    });

    const parsed = confirmSchema.parse(payload);
    await verifyEmailToken(parsed.token);

    await recordAuthAttempt({
      action: AuthActionType.EMAIL_VERIFICATION,
      ipAddress,
      success: true
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await recordAuthAttempt({
      action: AuthActionType.EMAIL_VERIFICATION,
      ipAddress,
      success: false
    });

    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    log.error('Email verification failed unexpectedly', { error });
    await captureException(error, { component: 'auth:email-verify' });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 429 });
  }
}
