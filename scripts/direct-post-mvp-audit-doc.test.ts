import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Direct post-MVP audit doc', () => {
  it('captures the current 8+/10 status and the closed Direct hardening backlog', () => {
    const docPath = path.join(process.cwd(), 'KNOKIO_DIRECT_POST_MVP_AUDIT.md');
    const markdown = fs.readFileSync(docPath, 'utf8');

    expect(markdown).toContain('8+/10 MVP');
    expect(markdown).toContain('auth/recovery pages, auth/control widgets, reusable Direct UI helpers, and most server helpers now have direct tests');
    expect(markdown).toContain('No remaining tracked Direct hardening gaps were found in this audit pass');
    expect(markdown).toContain('features/direct/server/auth.ts`, `requests.ts`, `admin.ts`, and `admin-session.ts` now have dedicated unit coverage');
    expect(markdown).toContain('app/api/direct/**/route.ts` has matching route-level regression coverage');
    expect(markdown).toContain('request-detail surface covered by `app/direct/inbox/request-detail.test.ts`');
    expect(markdown).toContain('fully tracked against the current Direct MVP hardening backlog');
  });
});
