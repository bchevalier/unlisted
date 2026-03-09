/**
 * Request lifecycle metrics for Knokio Direct.
 *
 * Tracks in-process counters and timing for request lifecycle events.
 * Exposes a snapshot endpoint for admin/observability dashboards.
 *
 * Metrics are in-memory and reset on process restart — suitable for single-
 * instance deployments. For multi-instance, pipe structured logs to an
 * external aggregator (Datadog, Grafana Cloud, etc.).
 */

import { logger } from './logger';

const log = logger('metrics');

// ---------------------------------------------------------------------------
// Counter registry
// ---------------------------------------------------------------------------

interface MetricSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramSnapshot>;
  startedAt: string;
  snapshotAt: string;
}

interface HistogramSnapshot {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

const counters = new Map<string, number>();
const histogramBuckets = new Map<string, number[]>();
const startedAt = new Date().toISOString();

// Max samples per histogram to bound memory
const MAX_HISTOGRAM_SAMPLES = 10_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Increment a counter by the given amount (default 1). */
export function increment(name: string, amount = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + amount);
}

/** Record a numeric observation (e.g. response time in ms). */
export function observe(name: string, value: number): void {
  let samples = histogramBuckets.get(name);
  if (!samples) {
    samples = [];
    histogramBuckets.set(name, samples);
  }
  // Ring-buffer: drop oldest when at capacity
  if (samples.length >= MAX_HISTOGRAM_SAMPLES) {
    samples.shift();
  }
  samples.push(value);
}

/** Start a timer; returns a function that records elapsed ms when called. */
export function startTimer(histogramName: string): () => number {
  const start = performance.now();
  return () => {
    const elapsed = Math.round(performance.now() - start);
    observe(histogramName, elapsed);
    return elapsed;
  };
}

/** Return a point-in-time snapshot of all metrics. */
export function snapshot(): MetricSnapshot {
  const counterObj: Record<string, number> = {};
  for (const [k, v] of counters) counterObj[k] = v;

  const histogramObj: Record<string, HistogramSnapshot> = {};
  for (const [k, samples] of histogramBuckets) {
    histogramObj[k] = computeHistogram(samples);
  }

  return {
    counters: counterObj,
    histograms: histogramObj,
    startedAt,
    snapshotAt: new Date().toISOString(),
  };
}

/** Reset all metrics (useful in tests). */
export function resetMetrics(): void {
  counters.clear();
  histogramBuckets.clear();
}

// ---------------------------------------------------------------------------
// Predefined metric names for request lifecycle
// ---------------------------------------------------------------------------

export const METRIC = {
  // Request creation
  REQUEST_FORM_CREATED: 'request.form.created',
  REQUEST_EMAIL_CREATED: 'request.email.created',
  REQUEST_COMPLETION_CREATED: 'request.completion.created',

  // Request state transitions
  REQUEST_ACCEPTED: 'request.accepted',
  REQUEST_DECLINED: 'request.declined',
  REQUEST_EXPIRED: 'request.expired',

  // Abuse controls
  RATE_LIMIT_HIT: 'abuse.rate_limit_hit',
  BLOCKLIST_HIT: 'abuse.blocklist_hit',
  CAPTCHA_FAILED: 'abuse.captcha_failed',
  HONEYPOT_TRIGGERED: 'abuse.honeypot_triggered',

  // Email infra
  EMAIL_INBOUND_RECEIVED: 'email.inbound.received',
  EMAIL_INBOUND_REJECTED: 'email.inbound.rejected',
  EMAIL_OUTBOUND_SENT: 'email.outbound.sent',
  EMAIL_OUTBOUND_FAILED: 'email.outbound.failed',

  // Notifications
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_FAILED: 'notification.failed',

  // Timing histograms
  REQUEST_CREATION_MS: 'timing.request_creation_ms',
  NOTIFICATION_SEND_MS: 'timing.notification_send_ms',
  EMAIL_PARSE_MS: 'timing.email_parse_ms',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeHistogram(samples: number[]): HistogramSnapshot {
  if (samples.length === 0) {
    return { count: 0, sum: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);

  return {
    count,
    sum,
    min: sorted[0],
    max: sorted[count - 1],
    avg: Math.round(sum / count),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Auto-log metrics on interval in production
// ---------------------------------------------------------------------------

const METRICS_LOG_INTERVAL_MS = 60_000; // 1 minute

let metricsLogInterval: ReturnType<typeof setInterval> | null = null;

export function startMetricsLogging(): void {
  if (metricsLogInterval) return;
  metricsLogInterval = setInterval(() => {
    const snap = snapshot();
    log.info('metrics_snapshot', {
      counters: snap.counters,
      histograms: snap.histograms,
    });
  }, METRICS_LOG_INTERVAL_MS);

  // Don't prevent process exit
  if (metricsLogInterval.unref) metricsLogInterval.unref();
}

export function stopMetricsLogging(): void {
  if (metricsLogInterval) {
    clearInterval(metricsLogInterval);
    metricsLogInterval = null;
  }
}
