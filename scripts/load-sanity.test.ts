import { describe, it, expect, beforeEach } from 'vitest';
import {
  type RequestMetric,
  runPool,
  percentile,
  evaluateThresholds,
  resetMetrics,
  getMetrics,
} from './load-sanity';

// ---------------------------------------------------------------------------
// Unit tests for the load sanity harness internals.
// These validate concurrency pool, percentile calculation, metrics
// collection, and threshold evaluation — without any running server.
// ---------------------------------------------------------------------------

describe('load sanity harness', () => {
  beforeEach(() => {
    resetMetrics();
  });

  // -----------------------------------------------------------------------
  // percentile()
  // -----------------------------------------------------------------------

  describe('percentile', () => {
    it('returns the single element for a one-element array', () => {
      expect(percentile([42], 0.5)).toBe(42);
      expect(percentile([42], 0.99)).toBe(42);
    });

    it('computes p50 of a sorted array', () => {
      const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      expect(percentile(sorted, 0.5)).toBe(50);
    });

    it('computes p95 of a sorted array', () => {
      const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(sorted, 0.95)).toBe(95);
    });

    it('computes p99 of a sorted array', () => {
      const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(percentile(sorted, 0.99)).toBe(99);
    });

    it('handles a two-element array', () => {
      expect(percentile([100, 200], 0.5)).toBe(100);
      expect(percentile([100, 200], 1.0)).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // runPool()
  // -----------------------------------------------------------------------

  describe('runPool', () => {
    it('runs all tasks to completion', async () => {
      const results: number[] = [];
      const tasks = Array.from({ length: 10 }, (_, i) => async () => {
        results.push(i);
        return i;
      });

      const output = await runPool(tasks, 3);
      expect(output).toHaveLength(10);
      expect(results).toHaveLength(10);
    });

    it('returns results in order despite concurrency', async () => {
      const tasks = Array.from({ length: 20 }, (_, i) => async () => {
        // Add small random delay to exercise concurrency ordering
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        return i * 10;
      });

      const output = await runPool(tasks, 5);
      expect(output).toHaveLength(20);
      for (let i = 0; i < 20; i++) {
        expect(output[i]).toBe(i * 10);
      }
    });

    it('handles empty task list', async () => {
      const output = await runPool([], 5);
      expect(output).toHaveLength(0);
    });

    it('works with concurrency=1 (sequential)', async () => {
      const order: number[] = [];
      const tasks = Array.from({ length: 5 }, (_, i) => async () => {
        order.push(i);
        return i;
      });

      const output = await runPool(tasks, 1);
      expect(output).toEqual([0, 1, 2, 3, 4]);
      expect(order).toEqual([0, 1, 2, 3, 4]);
    });

    it('concurrency exceeding task count works', async () => {
      const tasks = [async () => 'a', async () => 'b'];
      const output = await runPool(tasks, 100);
      expect(output).toEqual(['a', 'b']);
    });
  });

  // -----------------------------------------------------------------------
  // evaluateThresholds()
  // -----------------------------------------------------------------------

  describe('evaluateThresholds', () => {
    it('passes when all metrics are healthy', () => {
      const healthyMetrics: RequestMetric[] = Array.from({ length: 100 }, (_, i) => ({
        operation: 'door_page',
        status: 200,
        durationMs: 50 + (i % 50), // 50-99ms range
        ok: true,
      }));

      const result = evaluateThresholds(healthyMetrics);
      expect(result.passed).toBe(true);
      expect(result.operationResults).toHaveLength(1);
      expect(result.operationResults[0].errorRate).toBe(0);
      expect(result.operationResults[0].errorRateOk).toBe(true);
      expect(result.operationResults[0].latencyOk).toBe(true);
    });

    it('fails when error rate exceeds 5%', () => {
      const metrics: RequestMetric[] = [];
      // 90 successes + 10 failures = 10% error rate
      for (let i = 0; i < 90; i++) {
        metrics.push({ operation: 'form_submit', status: 200, durationMs: 50, ok: true });
      }
      for (let i = 0; i < 10; i++) {
        metrics.push({ operation: 'form_submit', status: 500, durationMs: 50, ok: false, error: 'Server error' });
      }

      const result = evaluateThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.operationResults[0].errorRateOk).toBe(false);
    });

    it('fails when p95 latency exceeds 5s', () => {
      const metrics: RequestMetric[] = [];
      // 90 fast requests + 10 extremely slow ones
      for (let i = 0; i < 90; i++) {
        metrics.push({ operation: 'door_page', status: 200, durationMs: 100, ok: true });
      }
      for (let i = 0; i < 10; i++) {
        metrics.push({ operation: 'door_page', status: 200, durationMs: 6000, ok: true });
      }

      const result = evaluateThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.operationResults[0].latencyOk).toBe(false);
    });

    it('treats 404 as success (knocker_status with fake tokens)', () => {
      const metrics: RequestMetric[] = Array.from({ length: 50 }, () => ({
        operation: 'knocker_status',
        status: 404,
        durationMs: 30,
        ok: false, // fetch reports 404 as not ok
      }));

      const result = evaluateThresholds(metrics);
      expect(result.passed).toBe(true);
      expect(result.operationResults[0].successes).toBe(50);
      expect(result.operationResults[0].failures).toBe(0);
    });

    it('evaluates multiple operations independently', () => {
      const metrics: RequestMetric[] = [
        // door_page: healthy
        ...Array.from({ length: 100 }, () => ({
          operation: 'door_page', status: 200, durationMs: 50, ok: true,
        })),
        // email_webhook: failing
        ...Array.from({ length: 100 }, () => ({
          operation: 'email_webhook', status: 500, durationMs: 50, ok: false, error: 'error',
        })),
      ];

      const result = evaluateThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.operationResults).toHaveLength(2);

      const doorResult = result.operationResults.find((r) => r.operation === 'door_page')!;
      const emailResult = result.operationResults.find((r) => r.operation === 'email_webhook')!;

      expect(doorResult.errorRateOk).toBe(true);
      expect(emailResult.errorRateOk).toBe(false);
    });

    it('passes at exactly 5% error rate', () => {
      const metrics: RequestMetric[] = [];
      for (let i = 0; i < 95; i++) {
        metrics.push({ operation: 'test', status: 200, durationMs: 50, ok: true });
      }
      for (let i = 0; i < 5; i++) {
        metrics.push({ operation: 'test', status: 500, durationMs: 50, ok: false });
      }

      const result = evaluateThresholds(metrics);
      expect(result.passed).toBe(true);
      expect(result.operationResults[0].errorRate).toBe(5);
      expect(result.operationResults[0].errorRateOk).toBe(true);
    });

    it('passes at exactly 5000ms p95 latency', () => {
      const metrics: RequestMetric[] = [];
      // 95 requests at 100ms, 5 at exactly 5000ms → p95 = 5000ms
      for (let i = 0; i < 95; i++) {
        metrics.push({ operation: 'test', status: 200, durationMs: 100, ok: true });
      }
      for (let i = 0; i < 5; i++) {
        metrics.push({ operation: 'test', status: 200, durationMs: 5000, ok: true });
      }

      const result = evaluateThresholds(metrics);
      expect(result.passed).toBe(true);
      expect(result.operationResults[0].latencyOk).toBe(true);
    });

    it('reports correct p50/p95/p99/max statistics', () => {
      const metrics: RequestMetric[] = Array.from({ length: 100 }, (_, i) => ({
        operation: 'test',
        status: 200,
        durationMs: (i + 1) * 10, // 10, 20, ..., 1000
        ok: true,
      }));

      const result = evaluateThresholds(metrics);
      const r = result.operationResults[0];
      expect(r.p50).toBe(500);
      expect(r.p95).toBe(950);
      expect(r.p99).toBe(990);
      expect(r.max).toBe(1000);
    });
  });

  // -----------------------------------------------------------------------
  // resetMetrics / getMetrics
  // -----------------------------------------------------------------------

  describe('metrics collection', () => {
    it('starts empty after reset', () => {
      expect(getMetrics()).toHaveLength(0);
    });

    it('getMetrics returns readonly snapshot', () => {
      const snapshot = getMetrics();
      expect(Array.isArray(snapshot)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Full dry-run simulation (500 users)
  // -----------------------------------------------------------------------

  describe('dry-run simulation (500 users)', () => {
    it('generates 2000 metrics for 500 users × 4 operations and passes thresholds', () => {
      const totalUsers = 500;
      const operations = ['door_page', 'form_submit', 'knocker_status', 'email_webhook'];
      const syntheticMetrics: RequestMetric[] = [];

      for (let i = 0; i < totalUsers; i++) {
        for (const op of operations) {
          const baseDuration = 20 + Math.random() * 80;
          const jitter = Math.random() < 0.05 ? Math.random() * 1500 : 0;
          const durationMs = Math.round(baseDuration + jitter);
          const isError = Math.random() < 0.01;
          const status = op === 'knocker_status' ? 404 : isError ? 500 : 200;

          syntheticMetrics.push({
            operation: op,
            status,
            durationMs,
            ok: status >= 200 && status < 300,
            error: isError ? 'Simulated error' : undefined,
          });
        }
      }

      expect(syntheticMetrics).toHaveLength(2000);

      const result = evaluateThresholds(syntheticMetrics);
      expect(result.operationResults).toHaveLength(4);
      expect(result.passed).toBe(true);

      // Verify each operation has 500 entries
      for (const r of result.operationResults) {
        expect(r.total).toBe(500);
        expect(r.p95).toBeLessThanOrEqual(5000);
        expect(r.errorRate).toBeLessThanOrEqual(5);
      }
    });
  });
});
