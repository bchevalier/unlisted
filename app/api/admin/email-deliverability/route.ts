import { getAdminSessionFromRequest } from '../../../../features/direct/server/admin-session';
import { checkDeliverability } from '../../../../lib/email-deliverability';

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const domain = url.searchParams.get('domain') ?? undefined;

  try {
    const report = await checkDeliverability(domain);
    return Response.json({ ok: true, report });
  } catch (error) {
    console.error('[deliverability-check]', error);
    return Response.json({ ok: false, error: 'Deliverability check failed' }, { status: 500 });
  }
}
