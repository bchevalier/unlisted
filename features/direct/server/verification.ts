/**
 * Requester verification helpers for Knokio Direct V1.
 *
 * Verification is request-scoped and deterministic — no external KYC.
 *
 * Levels:
 *   UNVERIFIED       — missing email or email on blocked free/disposable domain
 *   BASIC_VERIFIED   — valid email on a non-free, non-disposable domain
 *   ORG_VERIFIED     — BASIC_VERIFIED + org details + email domain matches org website domain + DNS confirms domain
 */

import dns from 'node:dns/promises';
import { getDomain } from 'tldts';

// ---------------------------------------------------------------------------
// Free / disposable email domain blocklist
// ---------------------------------------------------------------------------

/**
 * Curated list of the most common free and disposable email providers.
 * Kept as a flat Set for O(1) lookup. Extend as needed.
 */
const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // Major free providers
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'yahoo.ca',
  'yahoo.com.au',
  'yahoo.co.jp',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.it',
  'yahoo.es',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.it',
  'hotmail.es',
  'live.com',
  'live.co.uk',
  'live.fr',
  'live.de',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'zoho.com',
  'zohomail.com',
  'mail.com',
  'email.com',
  'usa.com',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'gmx.at',
  'web.de',
  'freenet.de',
  't-online.de',
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  'inbox.ru',
  'list.ru',
  'bk.ru',
  'rambler.ru',
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'naver.com',
  'daum.net',
  'hanmail.net',

  // Disposable / temporary email providers
  'guerrillamail.com',
  'guerrillamail.de',
  'grr.la',
  'guerrillamailblock.com',
  'sharklasers.com',
  'mailinator.com',
  'maildrop.cc',
  'dispostable.com',
  'yopmail.com',
  'yopmail.fr',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'getnada.com',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'fakeinbox.com',
  'mailnesia.com',
  'tempail.com',
  'mohmal.com',
  'discard.email',
  'mintmail.com',
  'mytemp.email',
  '10minutemail.com',
  'minutemail.com',
  'tempr.email',
  'burnermail.io',
  'mailcatch.com',
  'inboxalias.com',
]);

// ---------------------------------------------------------------------------
// Domain parsing helpers
// ---------------------------------------------------------------------------

/**
 * Extract the domain part from an email address (lowercased).
 * Returns null if the email is invalid or has no domain.
 */
export function extractEmailDomain(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1) return null;
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/**
 * Extract the registrable domain (eTLD+1) from a raw domain or URL.
 * e.g. "mail.example.co.uk" → "example.co.uk"
 *      "https://www.acme.com/about" → "acme.com"
 *
 * Returns null if extraction fails.
 */
export function getRegistrableDomain(input: string): string | null {
  // Normalize: if it looks like a bare domain (no protocol), prefix it
  let normalized = input.trim().toLowerCase();
  if (!normalized.includes('://')) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    const result = getDomain(url.hostname);
    return result ?? null;
  } catch {
    // Fallback: try getDomain directly on the input
    const result = getDomain(normalized);
    return result ?? null;
  }
}

/**
 * Check whether an email domain is in the free/disposable blocklist.
 */
export function isFreeDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

// ---------------------------------------------------------------------------
// DNS legitimacy check
// ---------------------------------------------------------------------------

/** Timeout for DNS lookups (ms). */
const DNS_TIMEOUT_MS = 5_000;

/**
 * Check whether a domain has legitimate DNS records.
 * Prefers MX records; falls back to A/AAAA if no MX found.
 *
 * Returns { hasDns: boolean; method: string } for auditability.
 */
export async function checkDomainDns(
  domain: string
): Promise<{ hasDns: boolean; method: 'MX' | 'A' | 'AAAA' | 'NONE' }> {
  const withTimeout = <T>(promise: Promise<T>): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DNS_TIMEOUT_MS)),
    ]);

  try {
    const mxRecords = await withTimeout(dns.resolveMx(domain));
    if (mxRecords && mxRecords.length > 0) {
      return { hasDns: true, method: 'MX' };
    }
  } catch {
    // MX lookup failed — try fallbacks
  }

  try {
    const aRecords = await withTimeout(dns.resolve4(domain));
    if (aRecords && aRecords.length > 0) {
      return { hasDns: true, method: 'A' };
    }
  } catch {
    // A lookup failed — try AAAA
  }

  try {
    const aaaaRecords = await withTimeout(dns.resolve6(domain));
    if (aaaaRecords && aaaaRecords.length > 0) {
      return { hasDns: true, method: 'AAAA' };
    }
  } catch {
    // All lookups failed
  }

  return { hasDns: false, method: 'NONE' };
}

// ---------------------------------------------------------------------------
// Verification status computation
// ---------------------------------------------------------------------------

export type RequesterInput = {
  senderEmail: string | null;
  requesterType: 'INDIVIDUAL' | 'ORGANIZATION';
  requesterOrgName?: string | null;
  requesterOrgWebsite?: string | null;
  requesterRoleTitle?: string | null;
};

export type VerificationResult = {
  status: 'UNVERIFIED' | 'BASIC_VERIFIED' | 'ORG_VERIFIED';
  reason: string;
};

/**
 * Compute requester verification status deterministically from the submitted inputs.
 *
 * Policy (V1):
 *   BASIC_VERIFIED:
 *     - senderEmail exists and is valid
 *     - sender domain is NOT a blocked free/disposable domain
 *
 *   ORG_VERIFIED:
 *     - BASIC_VERIFIED
 *     - requesterType = ORGANIZATION
 *     - orgName, orgWebsite, roleTitle all provided
 *     - sender email registrable domain matches org website registrable domain
 *     - domain has DNS (MX preferred, fallback A/AAAA)
 */
export async function computeVerificationStatus(
  input: RequesterInput
): Promise<VerificationResult> {
  // --- No email → UNVERIFIED ---
  if (!input.senderEmail || input.senderEmail.trim().length === 0) {
    return { status: 'UNVERIFIED', reason: 'No sender email provided' };
  }

  const email = input.senderEmail.trim().toLowerCase();

  // --- Extract domain ---
  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) {
    return { status: 'UNVERIFIED', reason: 'Invalid sender email format' };
  }

  // --- Free/disposable domain check ---
  if (isFreeDomain(emailDomain)) {
    return {
      status: 'UNVERIFIED',
      reason: `Email domain "${emailDomain}" is a free/disposable provider`,
    };
  }

  // At this point, BASIC_VERIFIED criteria are met.

  // --- Check for ORG_VERIFIED ---
  if (input.requesterType !== 'ORGANIZATION') {
    return { status: 'BASIC_VERIFIED', reason: 'Valid email on non-free domain' };
  }

  const orgName = input.requesterOrgName?.trim();
  const orgWebsite = input.requesterOrgWebsite?.trim();
  const roleTitle = input.requesterRoleTitle?.trim();

  if (!orgName || orgName.length === 0) {
    return { status: 'BASIC_VERIFIED', reason: 'Organization name not provided' };
  }

  if (!orgWebsite || orgWebsite.length === 0) {
    return { status: 'BASIC_VERIFIED', reason: 'Organization website not provided' };
  }

  if (!roleTitle || roleTitle.length === 0) {
    return { status: 'BASIC_VERIFIED', reason: 'Role title not provided' };
  }

  // --- Domain match: email registrable domain must match website registrable domain ---
  const emailRegistrable = getRegistrableDomain(emailDomain);
  const websiteRegistrable = getRegistrableDomain(orgWebsite);

  if (!emailRegistrable || !websiteRegistrable) {
    return {
      status: 'BASIC_VERIFIED',
      reason: 'Unable to extract registrable domain from email or website',
    };
  }

  if (emailRegistrable !== websiteRegistrable) {
    return {
      status: 'BASIC_VERIFIED',
      reason: `Email domain "${emailRegistrable}" does not match website domain "${websiteRegistrable}"`,
    };
  }

  // --- DNS legitimacy check ---
  const dnsResult = await checkDomainDns(emailDomain);
  if (!dnsResult.hasDns) {
    return {
      status: 'BASIC_VERIFIED',
      reason: `Domain "${emailDomain}" has no DNS records (MX/A/AAAA)`,
    };
  }

  return {
    status: 'ORG_VERIFIED',
    reason: `Organization verified: ${orgName} (${emailRegistrable}), DNS confirmed via ${dnsResult.method}`,
  };
}
