import { ZodError, z } from 'zod';
import { captureException } from '../../../../../lib/error-tracking';
import { isReachEnabled } from '../../../../../lib/flags';
import { logger } from '../../../../../lib/logger';
import { EmbeddingError } from '../../../../../lib/reach/embeddings';
import { searchReachDemoIdentities } from '../../../../../lib/reach/demo-identities';
import {
  getClientIp,
  rateLimitResponse,
  reachReadLimiter,
} from '../../../../../lib/reach/rate-limit';

const log = logger('reach:demo-request');

const ReachDemoRequestSchema = z
  .object({
    request: z.string().trim().min(1).max(2000),
    topK: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isReachEnabled()) {
    return Response.json({ ok: false, error: 'Reach is disabled' }, { status: 404 });
  }

  const ipCheck = reachReadLimiter.check(getClientIp(request));
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  try {
    const body = await request.json();
    const parsed = ReachDemoRequestSchema.parse(body);
    const result = await searchReachDemoIdentities(parsed);

    return Response.json({
      ok: true,
      matches: result.hits,
      debug: result.debug,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { ok: false, error: 'Invalid request payload', issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof EmbeddingError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.code === 'EMBEDDING_NO_PROVIDER_CONFIGURED' ? 503 : 502 },
      );
    }

    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:demo-request' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
