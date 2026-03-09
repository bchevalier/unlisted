/**
 * Email deliverability verification utilities for Knokio.
 *
 * Checks DNS records (MX, SPF, DKIM, DMARC) for the Knokio sending domain
 * to verify that outbound email infrastructure is correctly configured.
 *
 * Usage:
 *   import { checkDeliverability } from '@/lib/email-deliverability';
 *   const report = await checkDeliverability('knokio.io');
 */

import dns from 'node:dns/promises';
import { logger } from './logger';

const log = logger('email-deliverability');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  records?: string[];
}

export interface DeliverabilityReport {
  domain: string;
  checkedAt: string;
  overall: CheckStatus;
  checks: CheckResult[];
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

async function checkMX(domain: string): Promise<CheckResult> {
  try {
    const records = await dns.resolveMx(domain);
    if (records.length === 0) {
      return { name: 'MX', status: 'fail', detail: 'No MX records found' };
    }
    const formatted = records
      .sort((a, b) => a.priority - b.priority)
      .map((r) => `${r.priority} ${r.exchange}`);
    return {
      name: 'MX',
      status: 'pass',
      detail: `${records.length} MX record(s) found`,
      records: formatted,
    };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      return { name: 'MX', status: 'fail', detail: 'No MX records found' };
    }
    return { name: 'MX', status: 'fail', detail: `DNS lookup failed: ${code ?? 'unknown'}` };
  }
}

async function checkSPF(domain: string): Promise<CheckResult> {
  try {
    const records = await dns.resolveTxt(domain);
    const spfRecords = records
      .map((chunks) => chunks.join(''))
      .filter((r) => r.startsWith('v=spf1'));

    if (spfRecords.length === 0) {
      return { name: 'SPF', status: 'fail', detail: 'No SPF record found — emails may be rejected' };
    }
    if (spfRecords.length > 1) {
      return {
        name: 'SPF',
        status: 'warn',
        detail: 'Multiple SPF records found — only one is allowed per RFC 7208',
        records: spfRecords,
      };
    }

    const spf = spfRecords[0];
    // Check for common issues
    if (spf.includes('+all')) {
      return {
        name: 'SPF',
        status: 'warn',
        detail: 'SPF uses +all (permits any sender) — tighten to ~all or -all',
        records: spfRecords,
      };
    }

    return { name: 'SPF', status: 'pass', detail: 'Valid SPF record found', records: spfRecords };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      return { name: 'SPF', status: 'fail', detail: 'No TXT records found for SPF' };
    }
    return { name: 'SPF', status: 'fail', detail: `DNS lookup failed: ${code ?? 'unknown'}` };
  }
}

async function checkDKIM(domain: string, selectors: string[] = ['resend', 'default', 'google', 'k1', 'selector1', 'selector2']): Promise<CheckResult> {
  const found: string[] = [];

  for (const selector of selectors) {
    const dkimDomain = `${selector}._domainkey.${domain}`;
    try {
      const records = await dns.resolveTxt(dkimDomain);
      const dkimRecords = records
        .map((chunks) => chunks.join(''))
        .filter((r) => r.includes('v=DKIM1') || r.includes('p='));

      if (dkimRecords.length > 0) {
        found.push(`${selector}: ${dkimRecords[0].slice(0, 80)}…`);
      }
    } catch {
      // Expected for most selectors — not an error
    }
  }

  if (found.length === 0) {
    return {
      name: 'DKIM',
      status: 'warn',
      detail: `No DKIM records found for common selectors (${selectors.join(', ')}). This may be OK if using a custom selector.`,
    };
  }

  return {
    name: 'DKIM',
    status: 'pass',
    detail: `${found.length} DKIM selector(s) found`,
    records: found,
  };
}

async function checkDMARC(domain: string): Promise<CheckResult> {
  const dmarcDomain = `_dmarc.${domain}`;
  try {
    const records = await dns.resolveTxt(dmarcDomain);
    const dmarcRecords = records
      .map((chunks) => chunks.join(''))
      .filter((r) => r.startsWith('v=DMARC1'));

    if (dmarcRecords.length === 0) {
      return { name: 'DMARC', status: 'warn', detail: 'No DMARC record found — recommended for deliverability' };
    }

    const dmarc = dmarcRecords[0];
    // Check policy
    const policyMatch = dmarc.match(/;\s*p=(\w+)/);
    const policy = policyMatch?.[1] ?? 'unknown';

    if (policy === 'none') {
      return {
        name: 'DMARC',
        status: 'warn',
        detail: 'DMARC policy is "none" (monitoring only) — consider "quarantine" or "reject" for production',
        records: dmarcRecords,
      };
    }

    return { name: 'DMARC', status: 'pass', detail: `DMARC policy: ${policy}`, records: dmarcRecords };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      return { name: 'DMARC', status: 'warn', detail: 'No DMARC record found' };
    }
    return { name: 'DMARC', status: 'fail', detail: `DNS lookup failed: ${code ?? 'unknown'}` };
  }
}

async function checkReturnPath(domain: string): Promise<CheckResult> {
  // Check for a bounce/return-path subdomain (common with Resend, SendGrid, etc.)
  const bounceDomain = `bounces.${domain}`;
  try {
    const records = await dns.resolveCname(bounceDomain);
    if (records.length > 0) {
      return {
        name: 'Return-Path',
        status: 'pass',
        detail: 'Bounce subdomain CNAME configured',
        records,
      };
    }
    return { name: 'Return-Path', status: 'warn', detail: 'No bounce subdomain CNAME found (optional)' };
  } catch {
    return { name: 'Return-Path', status: 'warn', detail: 'No bounce subdomain CNAME found (optional)' };
  }
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------

export async function checkDeliverability(domain?: string): Promise<DeliverabilityReport> {
  const targetDomain = domain ?? extractDomainFromConfig();

  log.info('Running deliverability check', { domain: targetDomain });

  const checks = await Promise.all([
    checkMX(targetDomain),
    checkSPF(targetDomain),
    checkDKIM(targetDomain),
    checkDMARC(targetDomain),
    checkReturnPath(targetDomain),
  ]);

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const overall: CheckStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';

  const report: DeliverabilityReport = {
    domain: targetDomain,
    checkedAt: new Date().toISOString(),
    overall,
    checks,
  };

  log.info('Deliverability check complete', { domain: targetDomain, overall });
  return report;
}

function extractDomainFromConfig(): string {
  // Try to extract domain from the notification sender address
  const fromAddr = process.env.NOTIFICATION_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM ?? 'no-reply@knokio.io';
  const match = fromAddr.match(/@([a-z0-9.-]+)/i);
  return match?.[1] ?? 'knokio.io';
}
