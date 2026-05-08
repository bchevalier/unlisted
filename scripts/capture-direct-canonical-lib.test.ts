import { describe, expect, it, vi } from 'vitest';
import {
  buildManagedServerEnv,
  resolveCaptureRuntime,
  waitForUrlReady,
} from './capture-direct-canonical-lib.mjs';

describe('capture-direct-canonical runtime helpers', () => {
  it('defaults to a self-managed local server for canonical screenshots', () => {
    const runtime = resolveCaptureRuntime({});

    expect(runtime.manageServer).toBe(true);
    expect(runtime.port).toBe('3340');
    expect(runtime.baseUrl).toBe('http://127.0.0.1:3340');
  });

  it('supports opting into an existing running app', () => {
    const runtime = resolveCaptureRuntime({
      CANONICAL_SCREENSHOT_USE_EXISTING: '1',
      CANONICAL_SCREENSHOT_BASE_URL: 'http://127.0.0.1:3333',
    });

    expect(runtime.manageServer).toBe(false);
    expect(runtime.baseUrl).toBe('http://127.0.0.1:3333');
  });

  it('builds managed server env overrides from the runtime', () => {
    const runtime = resolveCaptureRuntime({ CANONICAL_SCREENSHOT_PORT: '4455' });
    const env = buildManagedServerEnv({}, runtime);

    expect(env.PORT).toBe('4455');
    expect(env.NEXT_PORT).toBe('4455');
    expect(env.APP_URL).toBe('http://127.0.0.1:4455');
    expect(env.NEXTAUTH_URL).toBe('http://127.0.0.1:4455');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://127.0.0.1:4455');
  });

  it('waits until the target URL responds without a server error', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });

    await expect(
      waitForUrlReady('http://127.0.0.1:3340/direct', {
        fetchImpl,
        timeoutMs: 5_000,
        intervalMs: 1,
      })
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
