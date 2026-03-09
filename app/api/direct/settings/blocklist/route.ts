import { ZodError } from 'zod';
import {
  addBlockedSenderForKeeper,
  DirectValidationError,
  listBlockedSendersForKeeper,
  removeBlockedSenderForKeeper
} from '../../../../../features/direct/server/requests';
import { getKeeperSessionFromRequest } from '../../../../../lib/keeper-auth';
import { logger } from '../../../../../lib/logger';
import { captureException } from '../../../../../lib/error-tracking';

const log = logger('settings:blocklist');

export async function GET(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const doorSlug = url.searchParams.get('slug');

  if (!doorSlug) {
    return Response.json({ ok: false, error: 'Missing slug parameter' }, { status: 400 });
  }

  try {
    const blockedSenders = await listBlockedSendersForKeeper(session.userId, doorSlug);
    return Response.json({ ok: true, blockedSenders });
  } catch (error) {
    if (error instanceof DirectValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    log.error('Blocklist fetch failed', { error, doorSlug });
    await captureException(error, { component: 'settings:blocklist', userId: session.userId });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await addBlockedSenderForKeeper(session.userId, payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof DirectValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    log.error('Blocklist add failed', { error });
    await captureException(error, { component: 'settings:blocklist', userId: session.userId });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await removeBlockedSenderForKeeper(session.userId, payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof DirectValidationError) {
      return Response.json({ ok: false, error: error.message }, { status: error.statusCode });
    }

    log.error('Blocklist remove failed', { error });
    await captureException(error, { component: 'settings:blocklist', userId: session.userId });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
