import { AuthActionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import {
  requestPasswordReset,
  shouldReturnAuthDebugTokens
} from '../../../../../../../features/direct/server/auth';
import {
  enforceAuthRateLimit,
  extractClientIP,
  recordAuthAttempt
} from '../../../../../../../features/direct/server/auth-security';
import { sendPasswordResetMail } from '../../../../../../../lib/auth-mailer';
import { captureException } from '../../../../../../../lib/error-tracking';
import { logger } from '../../../../../../../lib/logger';

const log = logger('auth:password-reset');

const requestSchema = z.object({
  email: z.string().trim().email()
});

export async function POST(request: Request) {
  const ipAddress = extractClientIP(request);
  const payload = await request.json().catch(() => ({}));

  try {
    const parsed = requestSchema.parse(payload);

    await enforceAuthRateLimit({
      action: AuthActionType.PASSWORD_RESET_REQUEST,
      ipAddress,
      maxByIp: 10,
      ipWindowMinutes: 60,
      email: parsed.email,
      maxByEmail: 4,
      emailWindowMinutes: 60
    });

    const token = await requestPasswordReset(parsed.email);
    if (token) {
      await sendPasswordResetMail(parsed.email, token);
    }

    await recordAuthAttempt({
      action: AuthActionType.PASSWORD_RESET_REQUEST,
      ipAddress,
      email: parsed.email,
      success: true
    });

    return NextResponse.json({
      ok: true,
      debug: shouldReturnAuthDebugTokens() && token ? { passwordResetToken: token } : undefined
    });
  } catch (error) {
    const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;

    await recordAuthAttempt({
      action: AuthActionType.PASSWORD_RESET_REQUEST,
      ipAddress,
      email,
      success: false
    });

    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    log.error('Password reset request failed unexpectedly', { error });
    await captureException(error, { component: 'auth:password-reset' });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 429 });
  }
}
