#!/usr/bin/env tsx
/**
 * validate-launch.ts — Pre-launch readiness validator for Knokio
 *
 * Runs automated checks against the target environment to verify
 * infrastructure, configuration, and service health before go-live.
 *
 * Usage:
 *   npx tsx scripts/validate-launch.ts                # check against APP_URL from env
 *   npx tsx scripts/validate-launch.ts https://knokio.io   # check specific URL
 *   npx tsx scripts/validate-launch.ts --env-only     # only validate env vars (no network)
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = one or more checks failed
 */

import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  detail?: string;
}

const results: CheckResult[] = [];

function pass(category: string, name: string, detail?: string) {
  results.push({ name, category, status: 'pass', detail });
}
function fail(category: string, name: string, detail?: string) {
  results.push({ name, category, status: 'fail', detail });
}
function warn(category: string, name: string, detail?: string) {
  results.push({ name, category, status: 'warn', detail });
}
function skip(category: string, name: string, detail?: string) {
  results.push({ name, category, status: 'skip', detail });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function envPresent(key: string): boolean {
  return !!process.env[key]?.trim();
}

function envMinLength(key: string, min: number): boolean {
  return (process.env[key]?.trim()?.length ?? 0) >= min;
}

function dig(recordType: string, domain: string): string | null {
  try {
    return execSync(`dig ${recordType} ${domain} +short 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim();
  } catch {
    return null;
  }
}

async function httpGet(url: string, timeoutMs = 10_000): Promise<{ status: number; body: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const body = await res.text();
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 1. Environment variable checks
// ---------------------------------------------------------------------------

function checkEnvVars() {
  const CAT = 'Environment';

  // Required vars
  const required: Array<{ key: string; minLen?: number; desc: string }> = [
    { key: 'NODE_ENV', desc: 'Runtime environment' },
    { key: 'APP_URL', desc: 'Application URL' },
    { key: 'NEXTAUTH_URL', desc: 'NextAuth URL' },
    { key: 'NEXTAUTH_SECRET', minLen: 32, desc: 'NextAuth secret (32+ chars)' },
    { key: 'DATABASE_URL', desc: 'Database connection string' },
    { key: 'KEEPER_SESSION_SECRET', minLen: 32, desc: 'Keeper session secret (32+ chars)' },
    { key: 'AUTH_ENCRYPTION_SECRET', minLen: 32, desc: 'Auth encryption secret (32+ chars)' },
  ];

  for (const { key, minLen, desc } of required) {
    if (!envPresent(key)) {
      fail(CAT, `${key} set`, `Missing — ${desc}`);
    } else if (minLen && !envMinLength(key, minLen)) {
      fail(CAT, `${key} length`, `Must be ≥ ${minLen} chars — ${desc}`);
    } else {
      pass(CAT, `${key} set`);
    }
  }

  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    if (process.env.AUTH_DEBUG_RETURN_TOKENS === 'true') {
      fail(CAT, 'AUTH_DEBUG_RETURN_TOKENS off', 'Must be false in production');
    } else {
      pass(CAT, 'AUTH_DEBUG_RETURN_TOKENS off');
    }

    if (process.env.APP_URL?.startsWith('http://')) {
      warn(CAT, 'APP_URL uses HTTPS', 'APP_URL should use https:// in production');
    } else {
      pass(CAT, 'APP_URL uses HTTPS');
    }
  }

  // Billing vars (warn if missing)
  const billing = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'];
  for (const key of billing) {
    if (!envPresent(key)) {
      warn(CAT, `${key} set`, 'Billing features will be degraded');
    } else if (process.env.NODE_ENV === 'production' && process.env[key]?.includes('test')) {
      warn(CAT, `${key} is live-mode`, 'Appears to contain "test" — ensure live-mode keys for production');
    } else {
      pass(CAT, `${key} set`);
    }
  }

  // Email vars (warn if missing)
  const email = ['RESEND_API_KEY', 'INBOUND_EMAIL_WEBHOOK_SECRET'];
  for (const key of email) {
    if (!envPresent(key)) {
      warn(CAT, `${key} set`, 'Email features will be degraded');
    } else {
      pass(CAT, `${key} set`);
    }
  }

  // Admin vars (warn if missing)
  const admin = ['ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET'];
  for (const key of admin) {
    if (!envPresent(key)) {
      warn(CAT, `${key} set`, 'Admin panel will be inaccessible');
    } else {
      pass(CAT, `${key} set`);
    }
  }

  // Observability
  if (!envPresent('SENTRY_DSN')) {
    warn(CAT, 'SENTRY_DSN set', 'Error tracking will be disabled');
  } else {
    pass(CAT, 'SENTRY_DSN set');
  }

  // Cron
  if (!envPresent('CRON_SECRET')) {
    warn(CAT, 'CRON_SECRET set', 'Cron jobs will not authenticate');
  } else {
    pass(CAT, 'CRON_SECRET set');
  }
}

// ---------------------------------------------------------------------------
// 2. DNS checks
// ---------------------------------------------------------------------------

async function checkDNS(domain: string) {
  const CAT = 'DNS';

  // MX
  const mx = dig('MX', domain);
  if (mx) {
    pass(CAT, 'MX record exists', mx.split('\n')[0]);
  } else {
    fail(CAT, 'MX record exists', 'No MX record found — inbound email will not work');
  }

  // SPF
  const txt = dig('TXT', domain);
  if (txt?.includes('v=spf1')) {
    pass(CAT, 'SPF record exists', txt.split('\n').find((l) => l.includes('spf')) || '');
  } else {
    fail(CAT, 'SPF record exists', 'No SPF TXT record — outbound email may land in spam');
  }

  // DKIM
  const dkim = dig('TXT', `resend._domainkey.${domain}`);
  if (dkim && dkim.length > 10) {
    pass(CAT, 'DKIM record exists');
  } else {
    warn(CAT, 'DKIM record exists', 'No DKIM record at resend._domainkey — check provider config');
  }

  // DMARC
  const dmarc = dig('TXT', `_dmarc.${domain}`);
  if (dmarc?.includes('v=DMARC1')) {
    const policy = dmarc.includes('p=reject')
      ? 'reject'
      : dmarc.includes('p=quarantine')
        ? 'quarantine'
        : 'none';
    if (policy === 'none') {
      warn(CAT, 'DMARC policy', 'DMARC set to p=none — consider quarantine or reject');
    } else {
      pass(CAT, 'DMARC policy', `p=${policy}`);
    }
  } else {
    fail(CAT, 'DMARC record exists', 'No DMARC record — email spoofing protection missing');
  }
}

// ---------------------------------------------------------------------------
// 3. Service health checks
// ---------------------------------------------------------------------------

async function checkServiceHealth(baseUrl: string) {
  const CAT = 'Service';

  // Health endpoint
  const health = await httpGet(`${baseUrl}/api/reach/health`);
  if (health && health.status === 200) {
    pass(CAT, 'Health endpoint', `HTTP ${health.status}`);
  } else if (health) {
    fail(CAT, 'Health endpoint', `HTTP ${health.status}`);
  } else {
    fail(CAT, 'Health endpoint', 'Connection failed');
  }

  // Portal page
  const portal = await httpGet(`${baseUrl}/direct`);
  if (portal && portal.status === 200) {
    pass(CAT, 'Direct portal loads', `HTTP ${portal.status}`);
  } else if (portal) {
    warn(CAT, 'Direct portal loads', `HTTP ${portal.status}`);
  } else {
    fail(CAT, 'Direct portal loads', 'Connection failed');
  }

  // Signup page
  const signup = await httpGet(`${baseUrl}/direct/signup`);
  if (signup && signup.status === 200) {
    pass(CAT, 'Signup page loads', `HTTP ${signup.status}`);
  } else if (signup) {
    warn(CAT, 'Signup page loads', `HTTP ${signup.status}`);
  } else {
    fail(CAT, 'Signup page loads', 'Connection failed');
  }

  // Login page
  const login = await httpGet(`${baseUrl}/direct/login`);
  if (login && login.status === 200) {
    pass(CAT, 'Login page loads', `HTTP ${login.status}`);
  } else if (login) {
    warn(CAT, 'Login page loads', `HTTP ${login.status}`);
  } else {
    fail(CAT, 'Login page loads', 'Connection failed');
  }

  // Door page (uses seed slug)
  const door = await httpGet(`${baseUrl}/u/john`);
  if (door && door.status === 200) {
    pass(CAT, 'Door page loads (/u/john)', `HTTP ${door.status}`);
  } else if (door && door.status === 404) {
    warn(CAT, 'Door page loads (/u/john)', 'HTTP 404 — seed data may not be loaded');
  } else {
    warn(CAT, 'Door page loads (/u/john)', door ? `HTTP ${door.status}` : 'Connection failed');
  }

  // Invalid door shows 404
  const badDoor = await httpGet(`${baseUrl}/u/___nonexistent_slug___`);
  if (badDoor && badDoor.status === 404) {
    pass(CAT, 'Invalid door returns 404');
  } else if (badDoor) {
    warn(CAT, 'Invalid door returns 404', `Got HTTP ${badDoor.status}`);
  } else {
    warn(CAT, 'Invalid door returns 404', 'Connection failed');
  }

  // Auth API rejects unauthenticated
  const authMe = await httpGet(`${baseUrl}/api/direct/auth/me`);
  if (authMe && (authMe.status === 401 || authMe.status === 403)) {
    pass(CAT, 'Auth API protects /me', `HTTP ${authMe.status}`);
  } else if (authMe) {
    warn(CAT, 'Auth API protects /me', `HTTP ${authMe.status} — expected 401/403`);
  } else {
    warn(CAT, 'Auth API protects /me', 'Connection failed');
  }

  // HTTPS check
  if (baseUrl.startsWith('https://')) {
    pass(CAT, 'HTTPS enabled');
  } else {
    warn(CAT, 'HTTPS enabled', 'Not using HTTPS — required for production');
  }
}

// ---------------------------------------------------------------------------
// 4. Build artifact checks (local)
// ---------------------------------------------------------------------------

function checkBuildArtifacts() {
  const CAT = 'Build';
  const fs = require('fs');
  const path = require('path');

  const root = process.cwd();

  // .next directory exists
  const nextDir = path.join(root, '.next');
  if (fs.existsSync(nextDir)) {
    pass(CAT, '.next build output exists');
  } else {
    warn(CAT, '.next build output exists', 'Run `npm run build` before deploying');
  }

  // render.yaml exists
  if (fs.existsSync(path.join(root, 'render.yaml'))) {
    pass(CAT, 'render.yaml exists');
  } else {
    fail(CAT, 'render.yaml exists', 'Deployment blueprint missing');
  }

  // prisma schema exists
  if (fs.existsSync(path.join(root, 'prisma', 'schema.prisma'))) {
    pass(CAT, 'Prisma schema exists');
  } else {
    fail(CAT, 'Prisma schema exists', 'Database schema missing');
  }

  // No secrets in .env files tracked by git
  try {
    const gitFiles = execSync('git ls-files', { encoding: 'utf-8', cwd: root });
    const envFiles = gitFiles.split('\n').filter((f) => f.match(/\.env\.local$|\.env\.production$/));
    if (envFiles.length > 0) {
      fail(CAT, 'No .env secrets in git', `Found: ${envFiles.join(', ')}`);
    } else {
      pass(CAT, 'No .env secrets in git');
    }
  } catch {
    skip(CAT, 'No .env secrets in git', 'Could not run git ls-files');
  }

  // Key docs exist
  const requiredDocs = [
    'docs/E2E-Checklist.md',
    'docs/Production-Enablement.md',
    'docs/Pilot-Invite-Workflow.md',
    'docs/Privacy.md',
    'docs/Terms.md',
    'docs/FAQ.md',
    'docs/Onboarding.md',
    'docs/Email-Deliverability-Plan.md',
  ];
  for (const doc of requiredDocs) {
    if (fs.existsSync(path.join(root, doc))) {
      pass(CAT, `${doc} exists`);
    } else {
      fail(CAT, `${doc} exists`, 'Launch doc missing');
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Database connectivity (optional, needs DATABASE_URL)
// ---------------------------------------------------------------------------

async function checkDatabase() {
  const CAT = 'Database';
  if (!envPresent('DATABASE_URL')) {
    skip(CAT, 'Database connection', 'DATABASE_URL not set');
    return;
  }

  try {
    // Try to import prisma client and check connectivity
    // This is a lightweight check — just verifies the connection string format
    const dbUrl = process.env.DATABASE_URL!;
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      pass(CAT, 'DATABASE_URL format', 'PostgreSQL connection string');
    } else {
      fail(CAT, 'DATABASE_URL format', 'Expected postgresql:// or postgres:// prefix');
    }

    // Check if pooling is configured (recommended for serverless)
    if (dbUrl.includes('pgbouncer=true') || dbUrl.includes('connection_limit=')) {
      pass(CAT, 'Connection pooling configured');
    } else {
      warn(CAT, 'Connection pooling configured', 'Consider adding pgbouncer=true or connection_limit for production');
    }
  } catch (e) {
    fail(CAT, 'Database check', String(e));
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport() {
  console.log('\n' + '='.repeat(72));
  console.log('  KNOKIO LAUNCH READINESS REPORT');
  console.log('='.repeat(72));
  console.log(`  Generated: ${new Date().toISOString()}\n`);

  const categories = [...new Set(results.map((r) => r.category))];
  let totalPass = 0;
  let totalFail = 0;
  let totalWarn = 0;
  let totalSkip = 0;

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    console.log(`\n  [${ cat.toUpperCase() }]`);
    console.log('  ' + '-'.repeat(68));

    for (const r of catResults) {
      const icon =
        r.status === 'pass' ? '✅' :
        r.status === 'fail' ? '❌' :
        r.status === 'warn' ? '⚠️ ' :
        '⏭️ ';
      const detail = r.detail ? ` — ${r.detail}` : '';
      console.log(`  ${icon} ${r.name}${detail}`);

      if (r.status === 'pass') totalPass++;
      else if (r.status === 'fail') totalFail++;
      else if (r.status === 'warn') totalWarn++;
      else totalSkip++;
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log(`  SUMMARY: ${totalPass} passed | ${totalFail} failed | ${totalWarn} warnings | ${totalSkip} skipped`);

  if (totalFail > 0) {
    console.log('  VERDICT: ❌ NOT READY — fix failures before launch');
  } else if (totalWarn > 3) {
    console.log('  VERDICT: ⚠️  CONDITIONAL — review warnings before launch');
  } else {
    console.log('  VERDICT: ✅ READY');
  }
  console.log('='.repeat(72) + '\n');

  return totalFail;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const envOnly = args.includes('--env-only');
  const explicitUrl = args.find((a) => a.startsWith('http'));
  const baseUrl = (explicitUrl || process.env.APP_URL || 'http://localhost:3333').replace(/\/$/, '');

  console.log(`\nKnokio Launch Validator`);
  console.log(`Target: ${envOnly ? '(env-only mode)' : baseUrl}\n`);

  // Always run env + build checks
  checkEnvVars();
  checkBuildArtifacts();
  await checkDatabase();

  if (!envOnly) {
    // Extract domain from URL for DNS checks
    try {
      const url = new URL(baseUrl);
      if (url.hostname !== 'localhost' && !url.hostname.match(/^(\d+\.){3}\d+$/)) {
        await checkDNS(url.hostname);
      } else {
        skip('DNS', 'DNS checks', 'Skipped for localhost/IP');
      }
    } catch {
      skip('DNS', 'DNS checks', 'Could not parse URL');
    }

    await checkServiceHealth(baseUrl);
  }

  const failures = printReport();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Validator crashed:', err);
  process.exit(2);
});
