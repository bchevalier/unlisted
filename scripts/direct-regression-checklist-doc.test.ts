import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Direct MVP regression checklist doc', () => {
  it('locks the review commands, canonical screenshot set, and signoff gates in one place', () => {
    const docPath = path.join(process.cwd(), 'KNOKIO_DIRECT_MVP_REGRESSION_CHECKLIST.md');
    const markdown = fs.readFileSync(docPath, 'utf8');

    expect(markdown).toContain('npm run demo:reset');
    expect(markdown).toContain('npm run screenshots:direct');
    expect(markdown).toContain('npm run test:all');

    expect(markdown).toContain('artifacts/canonical/direct/direct-landing.png');
    expect(markdown).toContain('artifacts/canonical/direct/direct-signup-launch.png');
    expect(markdown).toContain('artifacts/canonical/direct/direct-public-door.png');
    expect(markdown).toContain('artifacts/canonical/direct/direct-settings.png');
    expect(markdown).toContain('artifacts/canonical/direct/direct-inbox-proof-of-value.png');

    expect(markdown).toContain('Billing card makes Paid unlocks visibly billing-authoritative.');
    expect(markdown).toContain('Paid-only controls are disabled or explicitly gated when entitlement is absent.');
    expect(markdown).toContain('MVP can be presented as an 8+/10 Direct-first review build.');
  });
});
