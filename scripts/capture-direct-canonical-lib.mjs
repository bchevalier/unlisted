export function resolveCaptureRuntime(env = process.env) {
  const manageServer = env.CANONICAL_SCREENSHOT_USE_EXISTING !== '1';
  const defaultPort = env.CANONICAL_SCREENSHOT_PORT ?? (manageServer ? '3340' : '3333');
  const baseUrl = env.CANONICAL_SCREENSHOT_BASE_URL ?? env.APP_URL ?? `http://127.0.0.1:${defaultPort}`;

  return {
    manageServer,
    port: defaultPort,
    baseUrl,
    host: env.CANONICAL_SCREENSHOT_HOST ?? '127.0.0.1',
  };
}

export function buildManagedServerEnv(env = process.env, runtime = resolveCaptureRuntime(env)) {
  return {
    ...env,
    PORT: runtime.port,
    NEXT_PORT: runtime.port,
    NEXT_HOST: runtime.host,
    HOST: runtime.host,
    APP_URL: runtime.baseUrl,
    NEXTAUTH_URL: runtime.baseUrl,
    NEXT_PUBLIC_APP_URL: runtime.baseUrl,
  };
}

export async function waitForUrlReady(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const intervalMs = options.intervalMs ?? 500;
  const fetchImpl = options.fetchImpl ?? fetch;
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(url, { redirect: 'manual' });
      if (response.status < 500) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${url}.${suffix}`);
}
