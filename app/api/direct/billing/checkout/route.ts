import { ZodError, z } from 'zod';
import {
  BillingError,
  createCheckoutSession
} from '../../../../../features/direct/server/billing';
import { getKeeperSessionFromRequest } from '../../../../../lib/keeper-auth';
import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';

const log = logger('billing:checkout');

const checkoutSchema = z.object({
  doorSlug: z.string().min(1)
});

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = checkoutSchema.parse(await request.json());
    const checkoutUrl = await createCheckoutSession(session.userId, payload.doorSlug);
    log.info('Checkout session created', { userId: session.userId, doorSlug: payload.doorSlug });
    return Response.json({ ok: true, url: checkoutUrl });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof BillingError) {
      log.warn('Checkout billing error', { error: error.message, status: error.statusCode });
      return Response.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    log.error('Checkout session creation failed', { error });
    await captureException(error, { component: 'billing:checkout', userId: session.userId });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
