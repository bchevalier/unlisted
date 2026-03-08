/**
 * Unit tests for Reach pilot metrics computation.
 *
 * Tests the pure computation functions — no DB required.
 */

import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  computeDistribution,
  computeFunnel,
  computeSla,
  computeByType,
  computeTrend,
  makeDelta,
  DEFAULT_SLA_THRESHOLD_SECONDS,
} from './metrics';
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
    expect(result.funnel.proposed).toBe(0);
    expect(result.sla.total).toBe(0);
    expect(result.byType).toEqual([]);
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
      // One-hop success: CANCELLED but had ACCEPTED first (counted as one-hop since accepted)
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

  // ---------------------------------------------------------------------------
  // Funnel, SLA, byType are populated
  // ---------------------------------------------------------------------------

  it('populates funnel, sla, and byType in computed metrics', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const rows: ContractMetricRow[] = [
      makeRow({
        id: '1',
        status: 'FULFILLED',
        type: 'HUMAN_HUMAN',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 60_000, base),
          makeEvent('FULFILLED', 120_000, base),
        ],
      }),
      makeRow({ id: '2', status: 'PROPOSED', type: 'AI_HUMAN' }),
      makeRow({
        id: '3',
        status: 'REJECTED',
        type: 'HUMAN_HUMAN',
        events: [makeEvent('CREATED'), makeEvent('REJECTED')],
      }),
    ];
    const result = computeMetrics(rows);

    // Funnel
    expect(result.funnel.proposed).toBe(3);
    expect(result.funnel.active).toBe(1);
    expect(result.funnel.fulfilled).toBe(1);
    expect(result.funnel.overallRate).toBeCloseTo(1 / 3);

    // SLA (default 300s, 60s acceptance should pass)
    expect(result.sla.total).toBe(1);
    expect(result.sla.withinSla).toBe(1);
    expect(result.sla.rate).toBe(1);

    // byType
    expect(result.byType.length).toBe(2);
    const hh = result.byType.find((s) => s.type === 'HUMAN_HUMAN');
    expect(hh).toBeDefined();
    expect(hh!.total).toBe(2);
    expect(hh!.resolved).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeFunnel
// ---------------------------------------------------------------------------

describe('computeFunnel', () => {
  it('returns null rates for empty input', () => {
    const result = computeFunnel([]);
    expect(result.proposed).toBe(0);
    expect(result.proposedToActiveRate).toBeNull();
    expect(result.activeToFulfilledRate).toBeNull();
    expect(result.overallRate).toBeNull();
  });

  it('counts all stages correctly', () => {
    const rows: ContractMetricRow[] = [
      // Fulfilled (passed through all stages)
      makeRow({
        id: '1',
        status: 'FULFILLED',
        events: [makeEvent('CREATED'), makeEvent('ACCEPTED'), makeEvent('FULFILLED')],
      }),
      // Active (accepted but not fulfilled)
      makeRow({
        id: '2',
        status: 'ACTIVE',
        events: [makeEvent('CREATED'), makeEvent('ACCEPTED')],
      }),
      // Rejected before acceptance
      makeRow({
        id: '3',
        status: 'REJECTED',
        events: [makeEvent('CREATED'), makeEvent('REJECTED')],
      }),
      // Still proposed
      makeRow({ id: '4', status: 'PROPOSED' }),
    ];

    const funnel = computeFunnel(rows);
    expect(funnel.proposed).toBe(4);
    expect(funnel.active).toBe(2); // rows 1 and 2
    expect(funnel.fulfilled).toBe(1); // row 1
    expect(funnel.proposedToActiveRate).toBe(0.5);
    expect(funnel.activeToFulfilledRate).toBe(0.5);
    expect(funnel.overallRate).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// computeSla
// ---------------------------------------------------------------------------

describe('computeSla', () => {
  it('returns null rate for empty values', () => {
    const sla = computeSla([], 300);
    expect(sla.total).toBe(0);
    expect(sla.rate).toBeNull();
  });

  it('computes compliance correctly', () => {
    // 3 values: 60s, 200s, 400s with threshold 300s
    const sla = computeSla([60, 200, 400], 300);
    expect(sla.total).toBe(3);
    expect(sla.withinSla).toBe(2);
    expect(sla.rate).toBeCloseTo(2 / 3);
    expect(sla.thresholdSeconds).toBe(300);
  });

  it('all within SLA', () => {
    const sla = computeSla([10, 20, 30], 100);
    expect(sla.rate).toBe(1);
  });

  it('none within SLA', () => {
    const sla = computeSla([500, 600], 100);
    expect(sla.withinSla).toBe(0);
    expect(sla.rate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeByType
// ---------------------------------------------------------------------------

describe('computeByType', () => {
  it('returns empty array for no rows', () => {
    expect(computeByType([])).toEqual([]);
  });

  it('segments metrics by contract type', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const rows: ContractMetricRow[] = [
      makeRow({
        id: '1',
        status: 'FULFILLED',
        type: 'HUMAN_HUMAN',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 60_000, base),
          makeEvent('FULFILLED', 120_000, base),
        ],
      }),
      makeRow({
        id: '2',
        status: 'REJECTED',
        type: 'HUMAN_HUMAN',
        events: [makeEvent('CREATED'), makeEvent('REJECTED')],
      }),
      makeRow({
        id: '3',
        status: 'FULFILLED',
        type: 'AI_AI',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 10_000, base),
          makeEvent('FULFILLED', 20_000, base),
        ],
      }),
    ];

    const segments = computeByType(rows);
    expect(segments.length).toBe(2);

    // Sorted by total desc — HUMAN_HUMAN has 2, AI_AI has 1
    expect(segments[0].type).toBe('HUMAN_HUMAN');
    expect(segments[0].total).toBe(2);
    expect(segments[0].resolved).toBe(2);
    expect(segments[0].oneHopRate).toBe(0.5); // 1 of 2 resolved had acceptance without escalation

    expect(segments[1].type).toBe('AI_AI');
    expect(segments[1].total).toBe(1);
    expect(segments[1].timeToCounterparty).not.toBeNull();
    expect(segments[1].timeToCounterparty!.median).toBe(10); // 10 seconds
  });
});

// ---------------------------------------------------------------------------
// makeDelta
// ---------------------------------------------------------------------------

describe('makeDelta', () => {
  it('returns no_data when both null', () => {
    const d = makeDelta(null, null);
    expect(d.direction).toBe('no_data');
    expect(d.delta).toBeNull();
  });

  it('returns no_data when one is null', () => {
    const d = makeDelta(10, null);
    expect(d.direction).toBe('no_data');
    expect(d.current).toBe(10);
    expect(d.previous).toBeNull();
  });

  it('detects upward trend', () => {
    const d = makeDelta(20, 10);
    expect(d.direction).toBe('up');
    expect(d.delta).toBe(10);
    expect(d.changeRate).toBe(1); // 100% increase
  });

  it('detects downward trend', () => {
    const d = makeDelta(5, 10);
    expect(d.direction).toBe('down');
    expect(d.delta).toBe(-5);
    expect(d.changeRate).toBe(-0.5);
  });

  it('detects flat (no change)', () => {
    const d = makeDelta(10, 10);
    expect(d.direction).toBe('flat');
    expect(d.delta).toBe(0);
    expect(d.changeRate).toBe(0);
  });

  it('handles previous=0 gracefully', () => {
    const d = makeDelta(5, 0);
    expect(d.direction).toBe('up');
    expect(d.delta).toBe(5);
    expect(d.changeRate).toBeNull(); // division by zero guard
  });
});

// ---------------------------------------------------------------------------
// computeTrend
// ---------------------------------------------------------------------------

describe('computeTrend', () => {
  it('compares two metric snapshots', () => {
    const base = new Date('2026-01-01T00:00:00Z');

    // Current period: 3 contracts, 2 resolved, 1 fulfilled
    const currentRows: ContractMetricRow[] = [
      makeRow({
        id: 'c1',
        status: 'FULFILLED',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 30_000, base),
          makeEvent('FULFILLED', 60_000, base),
        ],
      }),
      makeRow({
        id: 'c2',
        status: 'REJECTED',
        events: [makeEvent('CREATED'), makeEvent('REJECTED')],
      }),
      makeRow({ id: 'c3', status: 'PROPOSED' }),
    ];

    // Previous period: 2 contracts, 1 resolved
    const prevRows: ContractMetricRow[] = [
      makeRow({
        id: 'p1',
        status: 'FULFILLED',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 120_000, base), // slower
          makeEvent('FULFILLED', 240_000, base),
        ],
      }),
      makeRow({ id: 'p2', status: 'PROPOSED' }),
    ];

    const current = computeMetrics(currentRows);
    const previous = computeMetrics(prevRows);
    const trend = computeTrend(current, previous);

    expect(trend.totalContracts.direction).toBe('up');
    expect(trend.totalContracts.delta).toBe(1); // 3 vs 2
    expect(trend.resolvedContracts.direction).toBe('up');
    expect(trend.resolvedContracts.delta).toBe(1); // 2 vs 1

    // Median TTC: 30s (current) vs 120s (previous) → down is better
    expect(trend.medianTimeToCounterparty.direction).toBe('down');
    expect(trend.medianTimeToCounterparty.current).toBe(30);
    expect(trend.medianTimeToCounterparty.previous).toBe(120);
  });

  it('handles empty previous period', () => {
    const rows: ContractMetricRow[] = [
      makeRow({ id: '1', status: 'PROPOSED' }),
    ];
    const current = computeMetrics(rows);
    const previous = computeMetrics([]);
    const trend = computeTrend(current, previous);

    expect(trend.totalContracts.direction).toBe('up');
    expect(trend.totalContracts.current).toBe(1);
    expect(trend.totalContracts.previous).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeMetrics with custom SLA threshold
// ---------------------------------------------------------------------------

describe('computeMetrics with SLA options', () => {
  it('uses custom SLA threshold', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    const rows: ContractMetricRow[] = [
      makeRow({
        id: '1',
        status: 'FULFILLED',
        createdAt: base,
        events: [
          makeEvent('CREATED', 0, base),
          makeEvent('ACCEPTED', 120_000, base), // 120 seconds
          makeEvent('FULFILLED', 240_000, base),
        ],
      }),
    ];

    // With 60s threshold — should fail SLA
    const result60 = computeMetrics(rows, { slaThresholdSeconds: 60 });
    expect(result60.sla.thresholdSeconds).toBe(60);
    expect(result60.sla.withinSla).toBe(0);
    expect(result60.sla.rate).toBe(0);

    // With 300s threshold — should pass SLA
    const result300 = computeMetrics(rows, { slaThresholdSeconds: 300 });
    expect(result300.sla.withinSla).toBe(1);
    expect(result300.sla.rate).toBe(1);
  });

  it('uses default threshold when not specified', () => {
    const result = computeMetrics([makeRow({ id: '1' })]);
    expect(result.sla.thresholdSeconds).toBe(DEFAULT_SLA_THRESHOLD_SECONDS);
  });
});
