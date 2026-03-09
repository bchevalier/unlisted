import { ZodError } from 'zod';
import {
  DirectValidationError,
  updateCategoryForKeeper
} from '../../../../../features/direct/server/requests';
import { getKeeperSessionFromRequest } from '../../../../../lib/keeper-auth';
import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';

const log = logger('settings:category');

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    await updateCategoryForKeeper(session.userId, payload);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof DirectValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    log.error('Category update failed', { error });
    await captureException(error, { component: 'settings:category', userId: session.userId });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
