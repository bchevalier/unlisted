import {
  BillingError,
  getBillingStatus
} from '../../../../../features/direct/server/billing';
import { getKeeperSessionFromRequest } from '../../../../../lib/keeper-auth';

export async function GET(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return Response.json({ ok: false, error: 'Missing slug parameter' }, { status: 400 });
  }

  try {
    const status = await getBillingStatus(session.userId, slug);
    return Response.json({ ok: true, billing: status });
  } catch (error) {
    if (error instanceof BillingError) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('[billing/status]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
