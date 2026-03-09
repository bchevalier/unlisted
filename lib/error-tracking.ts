/**
 * Error tracking configuration for Knokio.
 *
 * Integrates with Sentry when SENTRY_DSN is set. Degrades gracefully to
 * structured logging when Sentry is not configured (the default in dev).
 *
 * Usage:
 *   import { captureException, captureMessage, withErrorTracking } from '@/lib/error-tracking';
 *
 *   // Capture an error with context
 *   captureException(error, { component: 'email-proxy', doorId: 'd_123' });
 *
 *   // Wrap an async handler to auto-capture unhandled errors
 *   export const POST = withErrorTracking(async (req) => { ... });
 */

import { logger } from './logger';

const log = logger('error-tracking');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorContext {
  component?: string;
  userId?: string;
  doorId?: string;
  requestId?: string;
  [key: string]: unknown;
}

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info';

// ---------------------------------------------------------------------------
// Sentry-compatible interface (lazy-loaded to avoid import cost when unused)
// ---------------------------------------------------------------------------

interface SentryLike {
  captureException(error: unknown, context?: { extra?: Record<string, unknown>; tags?: Record<string, string> }): string;
  captureMessage(message: string, level?: string): string;
  init(options: Record<string, unknown>): void;
}

let sentryModule: SentryLike | null = null;
let initialized = false;

function getSentryDsn(): string | undefined {
  return process.env.SENTRY_DSN;
}

async function ensureInitialized(): Promise<SentryLike | null> {
  if (initialized) return sentryModule;
  initialized = true;

  const dsn = getSentryDsn();
  if (!dsn) {
    log.debug('Sentry DSN not configured — errors will be logged only');
    return null;
  }

  try {
    // Dynamic import so the Sentry package is only required when DSN is set
    // @ts-expect-error — @sentry/nextjs is an optional dependency; installed only when SENTRY_DSN is configured
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      // Don't send PII by default
      sendDefaultPii: false,
    });
    sentryModule = Sentry as unknown as SentryLike;
    log.info('Sentry initialized', { dsn: dsn.replace(/\/\/.*@/, '//***@') });
    return sentryModule;
  } catch {
    log.warn('Sentry package not installed — install @sentry/nextjs to enable error tracking');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture an exception. Sends to Sentry if configured, always logs.
 */
export async function captureException(
  error: unknown,
  context?: ErrorContext,
  severity: SeverityLevel = 'error'
): Promise<void> {
  // Always log the error with structured context
  const logMethod = severity === 'fatal' || severity === 'error' ? 'error' : 'warn';
  log[logMethod]('Captured exception', {
    error,
    ...context,
  });

  const sentry = await ensureInitialized();
  if (sentry) {
    const tags: Record<string, string> = {};
    if (context?.component) tags.component = context.component;
    if (context?.userId) tags.userId = context.userId;
    if (context?.doorId) tags.doorId = context.doorId;

    sentry.captureException(error, {
      extra: context as Record<string, unknown>,
      tags,
    });
  }
}

/**
 * Capture a message (non-exception event).
 */
export async function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: ErrorContext
): Promise<void> {
  const logMethod = level === 'fatal' || level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
  log[logMethod](message, context);

  const sentry = await ensureInitialized();
  if (sentry) {
    sentry.captureMessage(message, level);
  }
}

/**
 * Wrap a Next.js route handler to auto-capture unhandled exceptions.
 * The original error is re-thrown after capture so Next.js error handling
 * still applies.
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  component?: string
): T {
  const wrapped = async (...args: Parameters<T>): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      await captureException(error, { component: component ?? 'api' });
      throw error;
    }
  };
  return wrapped as T;
}

/**
 * Report whether error tracking is active (Sentry DSN is configured).
 */
export function isErrorTrackingConfigured(): boolean {
  return !!getSentryDsn();
}
