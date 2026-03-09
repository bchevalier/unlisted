import { getAdminSessionFromRequest } from '../../../../lib/admin-auth';
import { checkDeliverability } from '../../../../lib/email-deliverability';
import { logger } from '../../../../lib/logger';
import { captureException } from '../../../../lib/error-tracking';

const log = logger('admin:deliverability');

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
    log.error('Deliverability check failed', { error, domain });
    await captureException(error, { component: 'admin:deliverability' });
    return Response.json({ ok: false, error: 'Deliverability check failed' }, { status: 500 });
  }
}
