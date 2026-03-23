import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RequestStatus } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DIRECT_DEMO_SLUG,
  getDefaultDirectDemoState,
  getDirectDemoInboxFixture,
  getDirectDemoRequestFixture,
  isDirectDemoFixture,
  readDirectDemoState,
  resetDirectDemoState,
  writeDirectDemoState,
} from './demo-fixtures';

const originalDefaultFile = process.env.DIRECT_DEMO_DEFAULT_FILE;
const originalStateFile = process.env.DIRECT_DEMO_STATE_FILE;

afterEach(() => {
  if (originalDefaultFile === undefined) {
    delete process.env.DIRECT_DEMO_DEFAULT_FILE;
  } else {
    process.env.DIRECT_DEMO_DEFAULT_FILE = originalDefaultFile;
  }

  if (originalStateFile === undefined) {
    delete process.env.DIRECT_DEMO_STATE_FILE;
  } else {
    process.env.DIRECT_DEMO_STATE_FILE = originalStateFile;
  }
});

describe('direct demo fixtures', () => {
  it('builds a deterministic inbox fixture with accepted, auto-replied, awaiting-completion, and paid-intent states', () => {
    const fixture = getDirectDemoInboxFixture();

    expect(fixture.slug).toBe(DIRECT_DEMO_SLUG);
    expect(fixture.requests).toHaveLength(4);
    expect(fixture.requests.map((request) => request.status)).toEqual([
      'ACCEPTED',
      'AUTO_REPLIED',
      'AWAITING_COMPLETION',
      'ACCEPTED',
    ]);
    expect(fixture.requests.filter((request) => (request.paidAmountCents ?? 0) > 0)).toHaveLength(1);
    expect(fixture.statusCounts).toMatchObject({
      ACCEPTED: 2,
      AUTO_REPLIED: 1,
      AWAITING_COMPLETION: 1,
    });
  });

  it('supports filtered inbox views and detailed request fixtures', () => {
    const filtered = getDirectDemoInboxFixture({ status: RequestStatus.AWAITING_COMPLETION });
    const detail = getDirectDemoRequestFixture('demo-paid-intent');

    expect(filtered.requests).toHaveLength(1);
    expect(filtered.requests[0]?.id).toBe('demo-awaiting-completion');
    expect(filtered.pagination.totalCount).toBe(1);

    expect(detail).toMatchObject({
      id: 'demo-paid-intent',
      status: 'ACCEPTED',
      keeperQuoteAmountCents: 15000,
      requesterVerificationStatus: 'ORG_VERIFIED',
      door: {
        slug: DIRECT_DEMO_SLUG,
      },
    });
  });

  it('resets file-backed demo state to the checked-in default payload', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'direct-demo-fixtures-'));
    const defaultFile = path.join(tempDir, 'direct-demo-default.json');
    const stateFile = path.join(tempDir, 'direct-demo-state.json');

    fs.writeFileSync(defaultFile, JSON.stringify(getDefaultDirectDemoState(), null, 2));
    process.env.DIRECT_DEMO_DEFAULT_FILE = defaultFile;
    process.env.DIRECT_DEMO_STATE_FILE = stateFile;

    const mutated = getDefaultDirectDemoState();
    mutated.slug = 'custom-demo';
    mutated.requests = mutated.requests.slice(0, 1);
    writeDirectDemoState(mutated);

    expect(readDirectDemoState().slug).toBe('custom-demo');
    expect(readDirectDemoState().requests).toHaveLength(1);

    const reset = resetDirectDemoState();
    const restored = readDirectDemoState();

    expect(reset.stateFile).toBe(stateFile);
    expect(restored.slug).toBe(DIRECT_DEMO_SLUG);
    expect(restored.requests).toHaveLength(4);
    expect(restored.requests[1]?.status).toBe('AUTO_REPLIED');
  });

  it('recognizes the explicit demo fixture query flag', () => {
    expect(isDirectDemoFixture('demo')).toBe(true);
    expect(isDirectDemoFixture('anything-else')).toBe(false);
    expect(isDirectDemoFixture(undefined)).toBe(false);
  });
});
