import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Direct post-MVP audit doc', () => {
  it('captures the current 8+/10 status and the concrete hardening gaps', () => {
    const docPath = path.join(process.cwd(), 'KNOKIO_DIRECT_POST_MVP_AUDIT.md');
    const markdown = fs.readFileSync(docPath, 'utf8');

    expect(markdown).toContain('8+/10 MVP');
    expect(markdown).toContain('Route-level billing/settings coverage is still thin');
    expect(markdown).toContain('Request-detail regression coverage is weaker than inbox-level coverage');
    expect(markdown).toContain('Canonical screenshot capture still assumes a running app');
    expect(markdown).toContain('Auth route regression coverage is incomplete for MVP signoff depth');
    expect(markdown).toContain('KNOKIO_DIRECT_MVP_TODO_8_PLUS.md');
  });
});
