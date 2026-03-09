import crypto from 'node:crypto';
import { AuthActionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import {
  AuthValidationError,
  shouldReturnAuthDebugTokens,
  signupKeeper
} from '../../../../../../features/direct/server/auth';
import {
  enforceAuthRateLimit,
  extractClientIP,
  recordAuthAttempt
} from '../../../../../../features/direct/server/auth-security';
import { sendEmailVerificationMail } from '../../../../../../lib/auth-mailer';
import { captureException } from '../../../../../../lib/error-tracking';
import { logger } from '../../../../../../lib/logger';

const log = logger('auth:agent-signup');

const agentSignupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  desiredSlug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).optional(),
  plan: z.enum(['FREE', 'PAID']).default('FREE')
});

function getAgentSignupSecret() {
  const secret = process.env.AGENT_SIGNUP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AGENT_SIGNUP_SECRET must be configured (32+ chars)');
  }

  return secret;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const ipAddress = extractClientIP(request);
  const payload = await request.json().catch(() => ({}));
  const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;

  try {
    const secret = getAgentSignupSecret();
    const providedSecret = request.headers.get('x-agent-signup-secret') ?? '';

    if (!safeEqual(providedSecret, secret)) {
      await recordAuthAttempt({
        action: AuthActionType.SIGNUP,
        ipAddress,
        email,
        success: false
      });

      return NextResponse.json({ ok: false, error: 'Unauthorized agent signup' }, { status: 401 });
    }

    await enforceAuthRateLimit({
      action: AuthActionType.SIGNUP,
      ipAddress,
      maxByIp: 120,
      ipWindowMinutes: 15,
      email,
      maxByEmail: 10,
      emailWindowMinutes: 60
    });

    const parsed = agentSignupSchema.parse(payload);

    const user = await signupKeeper(parsed);
    await sendEmailVerificationMail(user.email, user.verificationToken);

    await recordAuthAttempt({
      action: AuthActionType.SIGNUP,
      ipAddress,
      email: user.email,
      success: true
    });

    return NextResponse.json({
      ok: true,
      mode: 'agent',
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

    log.error('Agent signup failed unexpectedly', { error, email });
    await captureException(error, { component: 'auth:agent-signup' });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 429 });
  }
}
