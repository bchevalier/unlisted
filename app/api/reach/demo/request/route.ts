import { ZodError, z } from 'zod';
import { captureException } from '../../../../../lib/error-tracking';
import { isReachEnabled } from '../../../../../lib/flags';
import { logger } from '../../../../../lib/logger';
import { EmbeddingError } from '../../../../../lib/reach/embeddings';
import {
  ensureReachDemoIdentityStorage,
  searchReachDemoIdentities,
} from '../../../../../lib/reach/demo-identities';
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

function getReachDemoSetupError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);

  if (/Database `[^`]+` does not exist/.test(message)) {
    return 'Local database from DATABASE_URL does not exist. Create it, then run npm run reach:seed-identities.';
  }

  if (message.includes("Can't reach database server")) {
    return 'Local database server is not reachable. Start Postgres from DATABASE_URL, then run npm run reach:seed-identities.';
  }

  if (message.includes('extension "vector" is not available')) {
    return 'Postgres pgvector is not available. Enable the vector extension before seeding Reach identities.';
  }

  return null;
}

export async function POST(request: Request) {
  if (!isReachEnabled()) {
    return Response.json({ ok: false, error: 'Reach is disabled' }, { status: 404 });
  }

  const ipCheck = reachReadLimiter.check(getClientIp(request));
  if (!ipCheck.allowed) return rateLimitResponse(ipCheck);

  try {
    const body = await request.json();
    const parsed = ReachDemoRequestSchema.parse(body);
    await ensureReachDemoIdentityStorage();
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
        { status: 400 }
      );
    }

    if (error instanceof EmbeddingError) {
      return Response.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.code === 'EMBEDDING_NO_PROVIDER_CONFIGURED' ? 503 : 502 }
      );
    }

    const setupError = getReachDemoSetupError(error);
    if (setupError) {
      return Response.json({ ok: false, error: setupError }, { status: 503 });
    }

    log.error('Request failed', { error });
    void captureException(error, { component: 'reach:demo-request' });
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
