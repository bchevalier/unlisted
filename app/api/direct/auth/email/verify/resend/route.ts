import { AuthActionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import {
  resendEmailVerification,
  shouldReturnAuthDebugTokens
} from '../../../../../../../features/direct/server/auth';
import {
  enforceAuthRateLimit,
  extractClientIP,
  recordAuthAttempt
} from '../../../../../../../features/direct/server/auth-security';
import { sendEmailVerificationMail } from '../../../../../../../lib/auth-mailer';
import { captureException } from '../../../../../../../lib/error-tracking';
import { logger } from '../../../../../../../lib/logger';

const log = logger('auth:email-resend');

const resendSchema = z.object({
  email: z.string().trim().email()
});

export async function POST(request: Request) {
  const ipAddress = extractClientIP(request);
  const payload = await request.json().catch(() => ({}));

  try {
    const parsed = resendSchema.parse(payload);

    await enforceAuthRateLimit({
      action: AuthActionType.EMAIL_VERIFICATION,
      ipAddress,
      maxByIp: 15,
      ipWindowMinutes: 30,
      email: parsed.email,
      maxByEmail: 5,
      emailWindowMinutes: 60
    });

    const token = await resendEmailVerification(parsed.email);
    if (token) {
      await sendEmailVerificationMail(parsed.email, token);
    }

    await recordAuthAttempt({
      action: AuthActionType.EMAIL_VERIFICATION,
      ipAddress,
      email: parsed.email,
      success: true
    });

    return NextResponse.json({
      ok: true,
      debug: shouldReturnAuthDebugTokens() && token ? { emailVerificationToken: token } : undefined
    });
  } catch (error) {
    const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;
    await recordAuthAttempt({
      action: AuthActionType.EMAIL_VERIFICATION,
      ipAddress,
      email,
      success: false
    });

    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    log.error('Email resend failed unexpectedly', { error });
    await captureException(error, { component: 'auth:email-resend' });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 429 });
  }
}
