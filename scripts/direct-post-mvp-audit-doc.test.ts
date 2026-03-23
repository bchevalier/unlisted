import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Direct post-MVP audit doc', () => {
  it('captures the current 8+/10 status and the remaining backend coverage gaps', () => {
    const docPath = path.join(process.cwd(), 'KNOKIO_DIRECT_POST_MVP_AUDIT.md');
    const markdown = fs.readFileSync(docPath, 'utf8');

    expect(markdown).toContain('8+/10 MVP');
    expect(markdown).toContain('auth/recovery pages, auth/control widgets, reusable Direct UI helpers, and most server helpers now have direct tests');
    expect(markdown).toContain('Core auth orchestration now has dedicated unit coverage');
    expect(markdown).toContain('Core request orchestration now has dedicated unit coverage');
    expect(markdown).toContain('Admin/authz helper modules still lack dedicated coverage');
    expect(markdown).toContain('features/direct/server/auth.test.ts');
    expect(markdown).toContain('features/direct/server/requests.test.ts');
    expect(markdown).toContain('features/direct/server/admin.ts');
    expect(markdown).toContain('features/direct/server/admin-session.ts');
    expect(markdown).toContain('KNOKIO_DIRECT_MVP_TODO_8_PLUS.md');
  });
});
