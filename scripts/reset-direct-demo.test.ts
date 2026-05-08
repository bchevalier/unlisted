import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('reset-direct-demo script', () => {
  it('restores the checked-in default demo state into the target state file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'direct-demo-reset-script-'));
    const defaultFile = path.join(tempDir, 'direct-demo-default.json');
    const stateFile = path.join(tempDir, 'direct-demo-state.json');

    fs.writeFileSync(
      defaultFile,
      JSON.stringify(
        {
          slug: 'john',
          displayName: 'John',
          plan: 'FREE',
          settings: {
            autoReplyEnabled: true,
            autoReplyMessage: 'Demo reset state',
            weeklyRequestCap: 50,
            revealMethod: 'EMAIL',
            revealValue: 'john@knokio.example',
            notifyNewRequest: true,
            notifyDigest: false,
            paidQuoteAmountCents: 15000,
            paidQuoteCurrency: 'USD',
            paidQuoteNote: 'Reset demo state',
            quoteVisibleToVerifiedOrgsOnly: true,
            openToNonTargetedPaidReach: false,
          },
          categories: [],
          emailAliases: [{ alias: 'john', isEnabled: true }],
          requests: [
            { id: 'accepted', status: 'ACCEPTED' },
            { id: 'auto', status: 'AUTO_REPLIED' },
            { id: 'awaiting', status: 'AWAITING_COMPLETION' },
            { id: 'paid', status: 'ACCEPTED' },
          ],
        },
        null,
        2,
      ),
    );

    fs.writeFileSync(stateFile, JSON.stringify({ slug: 'broken-demo', requests: [] }, null, 2));

    const output = execFileSync('node', ['scripts/reset-direct-demo.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DIRECT_DEMO_DEFAULT_FILE: defaultFile,
        DIRECT_DEMO_STATE_FILE: stateFile,
      },
      encoding: 'utf8',
    });

    const resetState = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as {
      slug: string;
      requests: Array<{ status: string }>;
    };

    expect(output).toContain('Reset Direct demo state');
    expect(output).toContain(`Requests: ${resetState.requests.length}`);
    expect(resetState.slug).toBe('john');
    expect(resetState.requests.map((request) => request.status)).toEqual([
      'ACCEPTED',
      'AUTO_REPLIED',
      'AWAITING_COMPLETION',
      'ACCEPTED',
    ]);
  });
});
