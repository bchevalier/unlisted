import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { snapshot } from '../../../../lib/metrics';

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({ ok: true, metrics: snapshot() });
}
