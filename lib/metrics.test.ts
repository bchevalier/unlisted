import { describe, it, expect, beforeEach } from 'vitest';
import { increment, observe, startTimer, snapshot, resetMetrics, METRIC } from './metrics';

describe('metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('increments counters', () => {
    increment('test.counter');
    increment('test.counter');
    increment('test.counter', 3);

    const snap = snapshot();
    expect(snap.counters['test.counter']).toBe(5);
  });

  it('records histogram observations', () => {
    observe('test.hist', 10);
    observe('test.hist', 20);
    observe('test.hist', 30);
    observe('test.hist', 40);
    observe('test.hist', 50);

    const snap = snapshot();
    const h = snap.histograms['test.hist'];
    expect(h.count).toBe(5);
    expect(h.sum).toBe(150);
    expect(h.min).toBe(10);
    expect(h.max).toBe(50);
    expect(h.avg).toBe(30);
    expect(h.p50).toBe(30);
  });

  it('startTimer records elapsed time', async () => {
    const end = startTimer('test.timing');

    // Small busy-wait to ensure non-zero elapsed time
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }

    const elapsed = end();
    expect(elapsed).toBeGreaterThanOrEqual(0);

    const snap = snapshot();
    expect(snap.histograms['test.timing'].count).toBe(1);
  });

  it('snapshot includes startedAt and snapshotAt', () => {
    const snap = snapshot();
    expect(snap.startedAt).toBeDefined();
    expect(snap.snapshotAt).toBeDefined();
    expect(new Date(snap.startedAt).getTime()).toBeLessThanOrEqual(new Date(snap.snapshotAt).getTime());
  });

  it('resetMetrics clears all data', () => {
    increment('a');
    observe('b', 100);
    resetMetrics();

    const snap = snapshot();
    expect(Object.keys(snap.counters)).toHaveLength(0);
    expect(Object.keys(snap.histograms)).toHaveLength(0);
  });

  it('METRIC constants are defined', () => {
    expect(METRIC.REQUEST_FORM_CREATED).toBe('request.form.created');
    expect(METRIC.REQUEST_ACCEPTED).toBe('request.accepted');
    expect(METRIC.EMAIL_OUTBOUND_SENT).toBe('email.outbound.sent');
  });
});
