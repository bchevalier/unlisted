/**
 * POST /api/reach/actors — Register a new Reach actor.
 *
 * For human users: requires keeper session; links actor to user.
 * For headless actors: no auth required (returns API key on creation).
 */

import { ZodError } from 'zod';
import { createActor, ReachError } from '../../../../lib/reach';
import { ReachActorCreateSchema } from '../../../../lib/reach/contracts';
import { getKeeperSessionFromRequest } from '../../../../lib/keeper-auth';
import { reachDisabledResponse } from '../../../../lib/reach/auth';

export async function POST(request: Request) {
  const blocked = reachDisabledResponse();
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const data = ReachActorCreateSchema.parse(body);

    // If the actor type is HUMAN, require keeper session to link.
    let userId: string | undefined;
    if (data.type === 'HUMAN') {
      const session = getKeeperSessionFromRequest(request);
      if (!session) {
        return Response.json(
          { ok: false, error: 'Keeper session required to register a human actor' },
          { status: 401 },
        );
      }
      userId = session.userId;
    }

    const { actor, apiKey } = await createActor(data, userId);

    return Response.json(
      {
        ok: true,
        actor: {
          id: actor.id,
          type: actor.type,
          handle: actor.handle,
          displayName: actor.displayName,
          isActive: actor.isActive,
          endpoint: actor.endpoint,
          createdAt: actor.createdAt,
        },
        // Only returned once, for headless actors.
        ...(apiKey ? { apiKey } : {}),
      },
      { status: 201 },
    );
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
    console.error('[reach/actors POST]', error);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
