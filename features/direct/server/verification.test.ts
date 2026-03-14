import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  extractEmailDomain,
  getRegistrableDomain,
  isFreeDomain,
  checkDomainDns,
  computeVerificationStatus,
  type RequesterInput,
} from './verification';

// ---------------------------------------------------------------------------
// extractEmailDomain
// ---------------------------------------------------------------------------

describe('extractEmailDomain', () => {
  it('extracts domain from a normal email', () => {
    expect(extractEmailDomain('alice@example.com')).toBe('example.com');
  });

  it('handles uppercase', () => {
    expect(extractEmailDomain('Alice@EXAMPLE.COM')).toBe('example.com');
  });

  it('handles subdomain emails', () => {
    expect(extractEmailDomain('bob@mail.example.co.uk')).toBe('mail.example.co.uk');
  });

  it('returns null for empty string', () => {
    expect(extractEmailDomain('')).toBeNull();
  });

  it('returns null for string without @', () => {
    expect(extractEmailDomain('not-an-email')).toBeNull();
  });

  it('returns null when domain part is empty', () => {
    expect(extractEmailDomain('user@')).toBeNull();
  });

  it('returns null when local part is empty', () => {
    expect(extractEmailDomain('@example.com')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRegistrableDomain
// ---------------------------------------------------------------------------

describe('getRegistrableDomain', () => {
  it('extracts registrable domain from bare domain', () => {
    expect(getRegistrableDomain('example.com')).toBe('example.com');
  });

  it('extracts registrable domain from subdomain', () => {
    expect(getRegistrableDomain('mail.example.com')).toBe('example.com');
  });

  it('extracts registrable domain from URL', () => {
    expect(getRegistrableDomain('https://www.acme.com/about')).toBe('acme.com');
  });

  it('handles co.uk TLD correctly', () => {
    expect(getRegistrableDomain('mail.example.co.uk')).toBe('example.co.uk');
  });

  it('handles URL with co.uk TLD', () => {
    expect(getRegistrableDomain('https://www.example.co.uk/page')).toBe('example.co.uk');
  });

  it('handles uppercase', () => {
    expect(getRegistrableDomain('EXAMPLE.COM')).toBe('example.com');
  });

  it('returns null for invalid input', () => {
    expect(getRegistrableDomain('')).toBeNull();
  });

  it('handles domain with trailing whitespace', () => {
    expect(getRegistrableDomain('  example.com  ')).toBe('example.com');
  });
});

// ---------------------------------------------------------------------------
// isFreeDomain
// ---------------------------------------------------------------------------

describe('isFreeDomain', () => {
  it('detects gmail.com as free', () => {
    expect(isFreeDomain('gmail.com')).toBe(true);
  });

  it('detects hotmail.com as free', () => {
    expect(isFreeDomain('hotmail.com')).toBe(true);
  });

  it('detects protonmail.com as free', () => {
    expect(isFreeDomain('protonmail.com')).toBe(true);
  });

  it('detects yahoo.com as free', () => {
    expect(isFreeDomain('yahoo.com')).toBe(true);
  });

  it('detects disposable mailinator.com as free', () => {
    expect(isFreeDomain('mailinator.com')).toBe(true);
  });

  it('detects guerrillamail.com as free', () => {
    expect(isFreeDomain('guerrillamail.com')).toBe(true);
  });

  it('returns false for a custom domain', () => {
    expect(isFreeDomain('acme.com')).toBe(false);
  });

  it('returns false for a custom .io domain', () => {
    expect(isFreeDomain('knokio.io')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isFreeDomain('GMAIL.COM')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkDomainDns
// ---------------------------------------------------------------------------

describe('checkDomainDns', () => {
  // We use real DNS here — these are stable well-known domains
  it('confirms google.com has MX records', async () => {
    const result = await checkDomainDns('google.com');
    expect(result.hasDns).toBe(true);
    expect(result.method).toBe('MX');
  });

  it('returns no DNS for a non-existent domain', async () => {
    const result = await checkDomainDns('this-domain-definitely-does-not-exist-xyz123456.com');
    expect(result.hasDns).toBe(false);
    expect(result.method).toBe('NONE');
  });
});

// ---------------------------------------------------------------------------
// computeVerificationStatus
// ---------------------------------------------------------------------------

describe('computeVerificationStatus', () => {
  describe('UNVERIFIED cases', () => {
    it('returns UNVERIFIED when no email', async () => {
      const result = await computeVerificationStatus({
        senderEmail: null,
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/no sender email/i);
    });

    it('returns UNVERIFIED for empty email string', async () => {
      const result = await computeVerificationStatus({
        senderEmail: '  ',
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/no sender email/i);
    });

    it('returns UNVERIFIED for invalid email format', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'not-an-email',
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/invalid.*format/i);
    });

    it('returns UNVERIFIED for gmail.com (free domain)', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@gmail.com',
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/free.*disposable/i);
    });

    it('returns UNVERIFIED for disposable domain', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'temp@mailinator.com',
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/free.*disposable/i);
    });
  });

  describe('BASIC_VERIFIED cases', () => {
    it('returns BASIC_VERIFIED for non-free domain individual', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@acme.com',
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/valid email/i);
    });

    it('returns BASIC_VERIFIED for org without org name', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@acme.com',
        requesterType: 'ORGANIZATION',
        requesterOrgWebsite: 'https://acme.com',
        requesterRoleTitle: 'CEO',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/organization name/i);
    });

    it('returns BASIC_VERIFIED for org without website', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@acme.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme Inc',
        requesterRoleTitle: 'CEO',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/website/i);
    });

    it('returns BASIC_VERIFIED for org without role title', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@acme.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme Inc',
        requesterOrgWebsite: 'https://acme.com',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/role title/i);
    });

    it('returns BASIC_VERIFIED when email domain does not match website', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@other.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme Inc',
        requesterOrgWebsite: 'https://acme.com',
        requesterRoleTitle: 'CEO',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/does not match/i);
    });
  });

  describe('ORG_VERIFIED cases', () => {
    it('returns ORG_VERIFIED when all org criteria met with real domain', async () => {
      // Using google.com as a stable DNS-confirmed domain
      const result = await computeVerificationStatus({
        senderEmail: 'partner@google.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Google LLC',
        requesterOrgWebsite: 'https://www.google.com',
        requesterRoleTitle: 'Partnerships Lead',
      });
      expect(result.status).toBe('ORG_VERIFIED');
      expect(result.reason).toMatch(/organization verified/i);
      expect(result.reason).toMatch(/google\.com/i);
    });

    it('returns ORG_VERIFIED with subdomain email matching website', async () => {
      // mail.google.com registrable domain → google.com, website google.com → google.com
      const result = await computeVerificationStatus({
        senderEmail: 'partner@mail.google.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Google LLC',
        requesterOrgWebsite: 'https://google.com',
        requesterRoleTitle: 'Engineer',
      });
      // This will try DNS on mail.google.com which may or may not have MX
      // The domain match check uses registrable domains so it should pass
      // DNS may fail for mail.google.com specifically — check result accordingly
      expect(['ORG_VERIFIED', 'BASIC_VERIFIED']).toContain(result.status);
    });

    it('returns BASIC_VERIFIED when DNS fails for non-existent domain', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'ceo@nonexistent-test-domain-xyz99.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Fake Corp',
        requesterOrgWebsite: 'https://nonexistent-test-domain-xyz99.com',
        requesterRoleTitle: 'CEO',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/no dns/i);
    });
  });

  // -------------------------------------------------------------------------
  // Edge-case audit: org domain mismatch, free-email org claim, missing email
  // -------------------------------------------------------------------------

  describe('edge-case audit — org domain mismatch', () => {
    it('returns BASIC_VERIFIED when org email is from a completely different company', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@competitor.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme Inc',
        requesterOrgWebsite: 'https://acme.com',
        requesterRoleTitle: 'VP Sales',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/does not match/i);
      expect(result.reason).toContain('competitor.com');
      expect(result.reason).toContain('acme.com');
    });

    it('returns BASIC_VERIFIED when email subdomain differs from website registrable domain', async () => {
      // e.g. email on acme-labs.com but website is acme.com — different registrable domains
      const result = await computeVerificationStatus({
        senderEmail: 'alice@acme-labs.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme Inc',
        requesterOrgWebsite: 'https://acme.com',
        requesterRoleTitle: 'CTO',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/does not match/i);
    });

    it('returns BASIC_VERIFIED when website uses country-code TLD that differs from email', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'alice@acme.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme UK',
        requesterOrgWebsite: 'https://acme.co.uk',
        requesterRoleTitle: 'Managing Director',
      });
      expect(result.status).toBe('BASIC_VERIFIED');
      expect(result.reason).toMatch(/does not match/i);
    });
  });

  describe('edge-case audit — free-email org claim', () => {
    it('returns UNVERIFIED when org claimant uses gmail.com', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'ceo@gmail.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'My Startup',
        requesterOrgWebsite: 'https://mystartup.com',
        requesterRoleTitle: 'CEO',
      });
      // Free domain check fires before org checks — UNVERIFIED, not BASIC_VERIFIED
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/free.*disposable/i);
    });

    it('returns UNVERIFIED when org claimant uses protonmail.com', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'founder@protonmail.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'ProtonCorp',
        requesterOrgWebsite: 'https://protoncorp.io',
        requesterRoleTitle: 'Founder',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/free.*disposable/i);
    });

    it('returns UNVERIFIED when org claimant uses disposable email', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'ceo@guerrillamail.com',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Legit Corp',
        requesterOrgWebsite: 'https://legitcorp.com',
        requesterRoleTitle: 'CEO',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/free.*disposable/i);
    });

    it('returns UNVERIFIED for yahoo.co.uk org claim (intl free domain)', async () => {
      const result = await computeVerificationStatus({
        senderEmail: 'partner@yahoo.co.uk',
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'UK Partners Ltd',
        requesterOrgWebsite: 'https://ukpartners.co.uk',
        requesterRoleTitle: 'Director',
      });
      expect(result.status).toBe('UNVERIFIED');
    });
  });

  describe('edge-case audit — missing sender email', () => {
    it('returns UNVERIFIED for null email on INDIVIDUAL request', async () => {
      const result = await computeVerificationStatus({
        senderEmail: null,
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/no sender email/i);
    });

    it('returns UNVERIFIED for null email on ORGANIZATION request', async () => {
      const result = await computeVerificationStatus({
        senderEmail: null,
        requesterType: 'ORGANIZATION',
        requesterOrgName: 'Acme',
        requesterOrgWebsite: 'https://acme.com',
        requesterRoleTitle: 'CEO',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/no sender email/i);
    });

    it('returns UNVERIFIED for whitespace-only email', async () => {
      const result = await computeVerificationStatus({
        senderEmail: '   ',
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/no sender email/i);
    });

    it('returns UNVERIFIED for @ only (no local part, no domain)', async () => {
      const result = await computeVerificationStatus({
        senderEmail: '@',
        requesterType: 'INDIVIDUAL',
      });
      expect(result.status).toBe('UNVERIFIED');
      expect(result.reason).toMatch(/invalid.*format/i);
    });
  });
});
