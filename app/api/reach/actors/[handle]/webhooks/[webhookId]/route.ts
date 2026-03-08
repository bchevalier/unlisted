/**
 * GET    /api/reach/actors/:handle/webhooks/:webhookId — Get webhook details.
 * PATCH  /api/reach/actors/:handle/webhooks/:webhookId — Update webhook config.
 * DELETE /api/reach/actors/:handle/webhooks/:webhookId — Delete a webhook.
 * POST   /api/reach/actors/:handle/webhooks/:webhookId — Rotate secret (action=rotate-secret).
 *
 * Auth required. Caller must own the actor or have ACTOR_UPDATE permission.
 */

import { ZodError } from 'zod';
import {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from '../../../../../../../lib/reach/auth';
import { resolveAuthz, requirePermission } from '../../../../../../../lib/reach/permissions';
import {
  getActorByHandle,
  ReachError,
} from '../../../../../../../lib/reach/service';
import {
  getWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  listDeliveries,
  pingWebhook,
  ReachWebhookUpdateSchema,
} from '../../../../../../../lib/reach/webhooks';

type Params = { handle: string; webhookId: string };

type ResolvedOk = {
  ok: true;
  webhookId: string;
  webhook: Awaited<ReturnType<typeof getWebhook>>;
};
type ResolvedErr = { ok: false; response: Response };
type Resolved = ResolvedOk | ResolvedErr;

async function resolveActorAndAuth(
  request: Request,
  params: Promise<Params>,
): Promise<Resolved> {
  const blocked = reachDisabledResponse();
  if (blocked) return { ok: false, response: blocked };

  const auth = await authenticateReachRequest(request);
  if (!auth) return { ok: false, response: unauthorizedResponse() };

  const { handle, webhookId } = await params;
  const actor = await getActorByHandle(handle);
  if (!actor) {
    return { ok: false, response: Response.json({ ok: false, error: 'Actor not found' }, { status: 404 }) };
  }

  // Verify ownership or permission.
  if (actor.id !== auth.actorId) {
    const authz = await resolveAuthz(auth, actor.id);
    const denied = requirePermission(authz, 'ACTOR_UPDATE');
    if (denied) return { ok: false, response: denied };
  }

  // Verify webhook belongs to this actor.
  const webhook = await getWebhook(webhookId);
  if (!webhook || webhook.actorId !== actor.id) {
    return { ok: false, response: Response.json({ ok: false, error: 'Webhook not found' }, { status: 404 }) };
  }

  return { ok: true, webhookId, webhook };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  const resolved = await resolveActorAndAuth(request, params);
  if (!resolved.ok) return resolved.response;

  try {
    const url = new URL(request.url);

    // ?deliveries=true to include recent delivery logs.
    if (url.searchParams.get('deliveries') === 'true') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
      const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
      const deliveries = await listDeliveries(resolved.webhookId, limit, offset);
      return Response.json({ ok: true, webhook: resolved.webhook, deliveries });
    }

    return Response.json({ ok: true, webhook: resolved.webhook });
  } catch (error) {
    console.error('[reach/webhooks/:id GET]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  const resolved = await resolveActorAndAuth(request, params);
  if (!resolved.ok) return resolved.response;

  try {
    const body = await request.json();
    const data = ReachWebhookUpdateSchema.parse(body);
    const updated = await updateWebhook(resolved.webhookId, data);
    return Response.json({ ok: true, webhook: updated });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid payload', issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/webhooks/:id PATCH]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  const resolved = await resolveActorAndAuth(request, params);
  if (!resolved.ok) return resolved.response;

  try {
    await deleteWebhook(resolved.webhookId);
    return Response.json({ ok: true, deleted: true });
  } catch (error) {
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/webhooks/:id DELETE]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  const resolved = await resolveActorAndAuth(request, params);
  if (!resolved.ok) return resolved.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = (body as Record<string, unknown>).action;

    if (action === 'rotate-secret') {
      const result = await rotateWebhookSecret(resolved.webhookId);
      return Response.json({ ok: true, secret: result.secret });
    }

    if (action === 'ping') {
      const result = await pingWebhook(resolved.webhookId);
      return Response.json({ ok: true, ping: result });
    }

    return Response.json(
      { ok: false, error: 'Unknown action. Supported: rotate-secret, ping' },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof ReachError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('[reach/webhooks/:id POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
