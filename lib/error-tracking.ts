/**
 * Error tracking adapter for Knokio.
 *
 * Provider-agnostic entrypoint with safe fallback to structured logging.
 * Supported providers:
 * - none (default): logs-only, no external SDK
 * - sentry: uses @sentry/nextjs (optional dependency)
 * - bugsink/glitchtip: sentry-compatible DSN, still uses @sentry/nextjs SDK
 *
 * Usage:
 *   import { captureException, captureMessage, withErrorTracking } from '@/lib/error-tracking';
 */

import { logger } from './logger';

const log = logger('error-tracking');

export const ERROR_TRACKING_PROVIDER_NAMES = ['none', 'sentry', 'bugsink', 'glitchtip'] as const;

export type ErrorTrackingProvider = (typeof ERROR_TRACKING_PROVIDER_NAMES)[number];

interface ErrorContext {
  component?: string;
  userId?: string;
  doorId?: string;
  requestId?: string;
  [key: string]: unknown;
}

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info';

interface SentryLike {
  captureException(
    error: unknown,
    context?: { extra?: Record<string, unknown>; tags?: Record<string, string> },
  ): string;
  captureMessage(message: string, level?: string): string;
  init(options: Record<string, unknown>): void;
}

interface ErrorTrackerClient {
  provider: ErrorTrackingProvider;
  active: boolean;
  captureException(error: unknown, context?: ErrorContext): void;
  captureMessage(message: string, level?: SeverityLevel, context?: ErrorContext): void;
}

let clientPromise: Promise<ErrorTrackerClient> | null = null;

function getConfiguredProvider(): ErrorTrackingProvider {
  const raw = (process.env.ERROR_TRACKING_PROVIDER ?? '').trim().toLowerCase();

  if (raw && ERROR_TRACKING_PROVIDER_NAMES.includes(raw as ErrorTrackingProvider)) {
    return raw as ErrorTrackingProvider;
  }

  // Backward compatibility: if legacy SENTRY_DSN exists, default to sentry.
  if (getTrackingDsn()) return 'sentry';

  return 'none';
}

function getTrackingDsn(): string | undefined {
  return process.env.ERROR_TRACKING_DSN?.trim() || process.env.SENTRY_DSN?.trim();
}

function getSdkPackageName(): string {
  return process.env.ERROR_TRACKING_SDK_PACKAGE?.trim() || '@sentry/nextjs';
}

function isSentryBackedProvider(provider: ErrorTrackingProvider): boolean {
  return provider === 'sentry' || provider === 'bugsink' || provider === 'glitchtip';
}

function toSentryLike(mod: unknown): SentryLike | null {
  if (!mod || typeof mod !== 'object') return null;

  const asRecord = mod as Record<string, unknown>;
  const candidate =
    asRecord.default && typeof asRecord.default === 'object'
      ? (asRecord.default as Record<string, unknown>)
      : asRecord;

  if (
    typeof candidate.init === 'function' &&
    typeof candidate.captureException === 'function' &&
    typeof candidate.captureMessage === 'function'
  ) {
    return candidate as unknown as SentryLike;
  }

  return null;
}

async function importOptionalModule(specifier: string): Promise<unknown | null> {
  try {
    return await import(/* webpackIgnore: true */ specifier);
  } catch {
    return null;
  }
}

function redactDsn(dsn: string): string {
  return dsn.replace(/\/\/.*@/, '//***@');
}

async function initializeClient(): Promise<ErrorTrackerClient> {
  const provider = getConfiguredProvider();

  if (provider === 'none') {
    log.info('Error tracking provider disabled — using structured logging only');
    return {
      provider,
      active: false,
      captureException: () => {},
      captureMessage: () => {},
    };
  }

  if (!isSentryBackedProvider(provider)) {
    log.warn('Unknown error tracking provider; falling back to logs-only', { provider });
    return {
      provider: 'none',
      active: false,
      captureException: () => {},
      captureMessage: () => {},
    };
  }

  const dsn = getTrackingDsn();
  if (!dsn) {
    log.warn('Error tracking DSN missing — using structured logging only', {
      provider,
      hint: 'Set ERROR_TRACKING_DSN (or legacy SENTRY_DSN)',
    });
    return {
      provider,
      active: false,
      captureException: () => {},
      captureMessage: () => {},
    };
  }

  const sdkPackage = getSdkPackageName();
  const sdkModule = await importOptionalModule(sdkPackage);
  const sentry = toSentryLike(sdkModule);

  if (!sentry) {
    log.warn('Error tracking SDK unavailable; falling back to logs-only', {
      provider,
      sdkPackage,
      hint: `Install ${sdkPackage} or set ERROR_TRACKING_PROVIDER=none`,
    });
    return {
      provider,
      active: false,
      captureException: () => {},
      captureMessage: () => {},
    };
  }

  sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii: false,
  });

  log.info('Error tracking initialized', {
    provider,
    sdkPackage,
    dsn: redactDsn(dsn),
  });

  return {
    provider,
    active: true,
    captureException: (error, context) => {
      const tags: Record<string, string> = {};
      if (context?.component) tags.component = context.component;
      if (context?.userId) tags.userId = context.userId;
      if (context?.doorId) tags.doorId = context.doorId;

      sentry.captureException(error, {
        extra: context as Record<string, unknown> | undefined,
        tags,
      });
    },
    captureMessage: (message, level, context) => {
      sentry.captureMessage(message, level);
      if (context && Object.keys(context).length > 0) {
        // Lightweight context trace in local logs for parity with exception events.
        log.debug('Captured message context', { message, ...context });
      }
    },
  };
}

async function getClient(): Promise<ErrorTrackerClient> {
  if (!clientPromise) {
    clientPromise = initializeClient();
  }
  return clientPromise;
}

export async function captureException(
  error: unknown,
  context?: ErrorContext,
  severity: SeverityLevel = 'error',
): Promise<void> {
  const logMethod = severity === 'fatal' || severity === 'error' ? 'error' : 'warn';
  log[logMethod]('Captured exception', {
    error,
    ...context,
  });

  const client = await getClient();
  if (client.active) {
    client.captureException(error, context);
  }
}

export async function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: ErrorContext,
): Promise<void> {
  const logMethod =
    level === 'fatal' || level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
  log[logMethod](message, context);

  const client = await getClient();
  if (client.active) {
    client.captureMessage(message, level, context);
  }
}

export function withErrorTracking<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  component?: string,
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
 * True when an external provider is configured (provider != none + DSN present).
 * Note: this does not guarantee SDK package is installed.
 */
export function isErrorTrackingConfigured(): boolean {
  const provider = getConfiguredProvider();
  return provider !== 'none' && !!getTrackingDsn();
}

export function getErrorTrackingProvider(): ErrorTrackingProvider {
  return getConfiguredProvider();
}
