import { getAdminSessionFromRequest } from '../../../../features/direct/server/admin-session';
import { snapshot } from '../../../../lib/metrics';

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({ ok: true, metrics: snapshot() });
}
