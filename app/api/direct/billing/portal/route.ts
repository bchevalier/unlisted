import { ZodError, z } from 'zod';
import {
  BillingError,
  createBillingPortalSession
} from '../../../../../features/direct/server/billing';
import { getKeeperSessionFromRequest } from '../../../../../lib/keeper-auth';

const portalSchema = z.object({
  doorSlug: z.string().min(1)
});

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = portalSchema.parse(await request.json());
    const portalUrl = await createBillingPortalSession(session.userId, payload.doorSlug);
    return Response.json({ ok: true, url: portalUrl });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof BillingError) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[billing/portal]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
