import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reachDisabledResponse, unauthorizedResponse } from './auth';

// ---------------------------------------------------------------------------
// reachDisabledResponse
// ---------------------------------------------------------------------------

describe('reachDisabledResponse', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when Reach is enabled (default)', () => {
    vi.stubEnv('ENABLE_REACH', 'true');
    // Re-import to pick up env change — but since isReachEnabled reads env directly, it works.
    const result = reachDisabledResponse();
    expect(result).toBeNull();
  });

  it('returns 403 response when Reach is disabled', () => {
    vi.stubEnv('ENABLE_REACH', 'false');
    const result = reachDisabledResponse();
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// unauthorizedResponse
// ---------------------------------------------------------------------------

describe('unauthorizedResponse', () => {
  it('returns a 401 JSON response', async () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Authentication required');
  });
});
