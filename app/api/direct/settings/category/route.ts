import { ZodError } from 'zod';
import {
  DirectValidationError,
  updateCategoryForKeeper
} from '../../../../../features/direct/server/requests';
import { getKeeperSessionFromRequest } from '../../../../../lib/keeper-auth';

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

    console.error(error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
