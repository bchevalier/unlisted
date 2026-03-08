/**
 * Unit tests for Reach pilot metrics computation.
 *
 * Tests the pure computation functions — no DB required.
 */

import { describe, it, expect } from 'vitest';
import { computeMetrics, computeDistribution } from './metrics';
import type { ContractMetricRow } from './metrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<ContractMetricRow> & { id: string }): ContractMetricRow {
  return {
    type: 'HUMAN_HUMAN',
    status: 'PROPOSED',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    routedAt: null,
    resolvedAt: null,
    events: [],
    ...overrides,
  };
}

function makeEvent(type: string, offsetMs = 0, base = new Date('2026-01-01T00:00:00Z')) {
  return { type, createdAt: new Date(base.getTime() + offsetMs) };
}

// ---------------------------------------------------------------------------
// computeDistribution
// ---------------------------------------------------------------------------

describe('computeDistribution', () => {
  it('returns zeros for empty array', () => {
    const result = computeDistribution([]);
    expect(result).toEqual({ count: 0, min: 0, max: 0, mean: 0, median: 0, p90: 0 });
  });

  it('handles single value', () => {
    const result = computeDistribution([42]);
    expect(result).toEqual({ count: 1, min: 42, max: 42, mean: 42, median: 42, p90: 42 });
  });

  it('computes correct stats for multiple values', () => {
    const result = computeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.count).toBe(10);
    expect(result.min).toBe(1);
    expect(result.max).toBe(10);
    expect(result.mean).toBe(5.5);
    expect(result.median).toBe(5.5);
    expect(result.p90).toBe(9.1);
  });

  it('sorts input values', () => {
    const result = computeDistribution([10, 1, 5, 3, 7]);
    expect(result.min).toBe(1);
    expect(result.max).toBe(10);
    expect(result.median).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// computeMetrics — empty input
// ---------------------------------------------------------------------------

describe('computeMetrics', () => {
  it('returns empty metrics for no contracts', () => {
    const result = computeMetrics([]);
    expect(result.totalContracts).toBe(0);
    expect(result.resolvedContracts).toBe(0);
    expect(result.inFlightContracts).toBe(0);
    expect(result.pathLength).toBeNull();
    expect(result.timeToCounterparty).toBeNull();
    expect(result.oneHopSuccess.rate).toBeNull();
    expect(result.window.from).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Status & type breakdown
  // ---------------------------------------------------------------------------

  it('counts status and type breakdowns correctly', () => {
    const rows: ContractMetricRow[] = [
      makeRow({ id: '1', status: 'PROPOSED', type: 'HUMAN_HUMAN' }),
      makeRow({ id: '2', status: 'ACTIVE', type: 'HUMAN_AI' }),
      makeRow({ id: '3', status: 'FULFILLED', type: 'HUMAN_HUMAN' }),
      makeRow({ id: '4', status: 'REJECTED', type: 'AI_HUMAN' }),
      makeRow({ id: '5', status: 'EXPIRED', type: 'AI_AI' }),
    ];
    const result = computeMetrics(rows);
    expect(result.totalContracts).toBe(5);
    expect(result.resolvedContracts).toBe(3); // FULFILLED + REJECTED + EXPIRED
    expect(result.inFlightContracts).toBe(2); // PROPOSED + ACTIVE
    expect(result.statusBreakdown).toEqual({
      PROPOSED: 1,
      ACTIVE: 1,
      FULFILLED: 1,
      REJECTED: 1,
      EXPIRED: 1,
    });
    expect(result.typeBreakdown).toEqual({
      HUMAN_HUMAN: 2,
      HUMAN_AI: 1,
      AI_HUMAN: 1,
      AI_AI: 1,
    });
  });

  // ---------------------------------------------------------------------------
  // Path length
  // ---------------------------------------------------------------------------

  it('computes path length for resolved contracts', () => {
    const rows: ContractMetricRow[] = [
      makeRow({
        id: '1',
        status: 'FULFILLED',
        events: [makeEvent('CREATED'), makeEvent('ROUTED'), makeEvent('ACCEPTED'), makeEvent('FULFILLED')],
      }),
      makeRow({
        id: '2',
        status: 'REJECTED',
        events: [makeEvent('CREATED'), makeEvent('REJECTED')],
      }),
      // In-flight contract should not count
      makeRow({
        id: '3',
        status: 'ACTIVE',
        events: [makeEvent('CREATED'), makeEvent('ROUTED'), makeEvent('ACCEPTED')],
      }),
    ];
    const result = computeMetrics(rows);
    expect(result.pathLength).not.toBeNull();
    expect(result.pathLength!.count).toBe(2);
    expect(result.pathLength!.min).toBe(2);
    expect(result.pathLength!.max).toBe(4);
    expect(result.pathLength!.mean).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Time-to-qualified-counterparty
  // ---------------------------------------------------------------------------

  it('computes time-to-counterparty from ACCEPTED events', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const rows: ContractMetricRow[] = [
      makeRow({
        id: '1',
        status: 'FULFILLED',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 60_000, base), // 60 seconds later
          makeEvent('FULFILLED', 120_000, base),
        ],
      }),
      makeRow({
        id: '2',
        status: 'ACTIVE',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 300_000, base), // 300 seconds later
        ],
      }),
      // Rejected — no ACCEPTED event, should not count
      makeRow({
        id: '3',
        status: 'REJECTED',
        createdAt: base,
        events: [makeEvent('CREATED', 0, base), makeEvent('REJECTED', 10_000, base)],
      }),
    ];
    const result = computeMetrics(rows);
    expect(result.timeToCounterparty).not.toBeNull();
    expect(result.timeToCounterparty!.count).toBe(2);
    expect(result.timeToCounterparty!.min).toBe(60);
    expect(result.timeToCounterparty!.max).toBe(300);
    expect(result.timeToCounterparty!.mean).toBe(180);
  });

  // ---------------------------------------------------------------------------
  // One-hop success rate
  // ---------------------------------------------------------------------------

  it('computes one-hop success for clean resolutions', () => {
    const rows: ContractMetricRow[] = [
      // One-hop success: FULFILLED without escalation
      makeRow({
        id: '1',
        status: 'FULFILLED',
        events: [makeEvent('CREATED'), makeEvent('ACCEPTED'), makeEvent('FULFILLED')],
      }),
      // One-hop success: REJECTED but had ACCEPTED first (counted as one-hop since accepted)
      makeRow({
        id: '2',
        status: 'CANCELLED',
        events: [makeEvent('CREATED'), makeEvent('ACCEPTED'), makeEvent('CANCELLED')],
      }),
      // Not one-hop: had ESCALATED event
      makeRow({
        id: '3',
        status: 'FULFILLED',
        events: [
          makeEvent('CREATED'),
          makeEvent('ESCALATED'),
          makeEvent('ACCEPTED'),
          makeEvent('FULFILLED'),
        ],
      }),
      // Not one-hop: had OVERRIDDEN event
      makeRow({
        id: '4',
        status: 'FULFILLED',
        events: [
          makeEvent('CREATED'),
          makeEvent('REJECTED'),
          makeEvent('OVERRIDDEN'),
          makeEvent('ACCEPTED'),
          makeEvent('FULFILLED'),
        ],
      }),
      // Not counted: REJECTED without ACCEPTED (policy reject, not a one-hop success)
      makeRow({
        id: '5',
        status: 'REJECTED',
        events: [makeEvent('CREATED'), makeEvent('REJECTED')],
      }),
    ];
    const result = computeMetrics(rows);
    expect(result.oneHopSuccess.resolvedCount).toBe(5);
    expect(result.oneHopSuccess.oneHopCount).toBe(2); // rows 1 and 2
    expect(result.oneHopSuccess.rate).toBeCloseTo(0.4);
  });

  it('returns null rate when no resolved contracts', () => {
    const rows: ContractMetricRow[] = [
      makeRow({ id: '1', status: 'PROPOSED' }),
      makeRow({ id: '2', status: 'ACTIVE' }),
    ];
    const result = computeMetrics(rows);
    expect(result.oneHopSuccess.rate).toBeNull();
    expect(result.oneHopSuccess.resolvedCount).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Window
  // ---------------------------------------------------------------------------

  it('computes correct time window', () => {
    const rows: ContractMetricRow[] = [
      makeRow({ id: '1', createdAt: new Date('2026-01-05') }),
      makeRow({ id: '2', createdAt: new Date('2026-01-01') }),
      makeRow({ id: '3', createdAt: new Date('2026-01-10') }),
    ];
    const result = computeMetrics(rows);
    expect(result.window.from).toEqual(new Date('2026-01-01'));
    expect(result.window.to).toEqual(new Date('2026-01-10'));
  });
});
