#!/usr/bin/env npx tsx
/**
 * Load Sanity Harness — Knokio Direct
 *
 * Simulates 500 concurrent users performing core Knokio Direct operations:
 *   - Door page loads (GET /u/:slug)
 *   - Form request submissions (POST /api/direct/requests)
 *   - Knocker status checks (GET /r/:token)
 *   - Inbound email webhook deliveries (POST /api/direct/email/inbound)
 *
 * Usage:
 *   npx tsx scripts/load-sanity.ts                    # default: 500 users, http://localhost:3000
 *   npx tsx scripts/load-sanity.ts --users=100        # 100 users
 *   npx tsx scripts/load-sanity.ts --base=https://staging.knokio.io
 *   npx tsx scripts/load-sanity.ts --concurrency=50   # max 50 parallel requests
 *
 * Requirements:
 *   - The target server must be running
 *   - A seeded door slug must exist (default: "john")
 *
 * This is a sanity check, not a stress test. It verifies the system can
 * handle 500 users without errors, timeouts, or degraded response times.
 */

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    return [key, val ?? 'true'];
  })
);

const BASE_URL = args.base ?? 'http://localhost:3000';
const TOTAL_USERS = Number(args.users ?? 500);
const CONCURRENCY = Number(args.concurrency ?? 50);
const DOOR_SLUG = args.slug ?? 'john';
const WEBHOOK_SECRET = args.webhookSecret ?? process.env.INBOUND_EMAIL_WEBHOOK_SECRET ?? '';

// ---------------------------------------------------------------------------
// Metrics collection
// ---------------------------------------------------------------------------

interface RequestMetric {
  operation: string;
  status: number;
  durationMs: number;
  ok: boolean;
  error?: string;
}

const metrics: RequestMetric[] = [];

async function timedFetch(
  operation: string,
  url: string,
  init?: RequestInit
): Promise<RequestMetric> {
  const start = performance.now();
  let status = 0;
  let ok = false;
  let error: string | undefined;

  try {
    const resp = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(30_000), // 30s timeout per request
    });
    status = resp.status;
    ok = resp.ok;

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      error = body.slice(0, 200);
    }
  } catch (err) {
    status = 0;
    ok = false;
    error = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Math.round(performance.now() - start);
  const metric: RequestMetric = { operation, status, durationMs, ok, error };
  metrics.push(metric);
  return metric;
}

// ---------------------------------------------------------------------------
// Test scenarios
// ---------------------------------------------------------------------------

async function loadDoorPage(userId: number): Promise<void> {
  await timedFetch(
    'door_page',
    `${BASE_URL}/u/${DOOR_SLUG}`
  );
}

async function submitFormRequest(userId: number): Promise<void> {
  await timedFetch(
    'form_submit',
    `${BASE_URL}/api/direct/requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doorSlug: DOOR_SLUG,
        categoryKey: 'other',
        senderName: `LoadTest User ${userId}`,
        senderEmail: `loadtest-${userId}@example.com`,
        message: `Load test message from simulated user ${userId}. This is a sanity check to verify system stability under moderate concurrent load.`,
      }),
    }
  );
}

async function checkKnockerStatus(userId: number): Promise<void> {
  // Use a fake token — we expect a 404 but we're testing response time under load
  const fakeToken = `loadtest_${userId.toString(16).padStart(8, '0')}`;
  await timedFetch(
    'knocker_status',
    `${BASE_URL}/r/${fakeToken}`
  );
}

async function submitEmailWebhook(userId: number): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (WEBHOOK_SECRET) {
    headers['x-knokio-inbound-secret'] = WEBHOOK_SECRET;
  }

  await timedFetch(
    'email_webhook',
    `${BASE_URL}/api/direct/email/inbound`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: `${DOOR_SLUG}@knokio.io`,
        from: `loadtest-${userId}@example.com`,
        subject: `Load test ${userId}`,
        text: `Email load test from user ${userId}`,
      }),
    }
  );
}

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------

async function runPool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printReport(): void {
  const byOp = new Map<string, RequestMetric[]>();
  for (const m of metrics) {
    const arr = byOp.get(m.operation) ?? [];
    arr.push(m);
    byOp.set(m.operation, arr);
  }

  console.log('\n' + '='.repeat(80));
  console.log('LOAD SANITY REPORT');
  console.log('='.repeat(80));
  console.log(`Target:      ${BASE_URL}`);
  console.log(`Users:       ${TOTAL_USERS}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Door slug:   ${DOOR_SLUG}`);
  console.log(`Total reqs:  ${metrics.length}`);
  console.log('-'.repeat(80));

  let allPass = true;

  for (const [op, opMetrics] of byOp) {
    const durations = opMetrics.map((m) => m.durationMs).sort((a, b) => a - b);
    const successes = opMetrics.filter((m) => m.ok || m.status === 404).length; // 404 is ok for knocker status
    const failures = opMetrics.length - successes;
    const errorRate = (failures / opMetrics.length) * 100;

    console.log(`\n  ${op} (${opMetrics.length} requests)`);
    console.log(`    Success:  ${successes}/${opMetrics.length} (${(100 - errorRate).toFixed(1)}%)`);
    console.log(`    Failures: ${failures}`);
    console.log(`    p50:      ${percentile(durations, 0.5)}ms`);
    console.log(`    p95:      ${percentile(durations, 0.95)}ms`);
    console.log(`    p99:      ${percentile(durations, 0.99)}ms`);
    console.log(`    max:      ${durations[durations.length - 1]}ms`);

    // Sanity thresholds
    if (errorRate > 5) {
      console.log(`    ⚠️  ERROR RATE ABOVE 5%`);
      allPass = false;
    }
    if (percentile(durations, 0.95) > 5000) {
      console.log(`    ⚠️  p95 LATENCY ABOVE 5s`);
      allPass = false;
    }
  }

  // Errors summary
  const errors = metrics.filter((m) => !m.ok && m.status !== 404);
  if (errors.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('ERROR SAMPLES (up to 10):');
    for (const e of errors.slice(0, 10)) {
      console.log(`  [${e.operation}] status=${e.status} ${e.durationMs}ms — ${e.error?.slice(0, 120)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(allPass ? '✅ LOAD SANITY CHECK PASSED' : '❌ LOAD SANITY CHECK FAILED');
  console.log('='.repeat(80) + '\n');

  if (!allPass) {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n🚀 Knokio Load Sanity Harness`);
  console.log(`   ${TOTAL_USERS} users × 4 operations = ${TOTAL_USERS * 4} requests`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Target: ${BASE_URL}\n`);

  // Verify server is reachable
  try {
    const probe = await fetch(`${BASE_URL}/u/${DOOR_SLUG}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!probe.ok) {
      console.error(`❌ Server probe failed: ${probe.status} — is the server running?`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Cannot reach ${BASE_URL} — is the server running?`);
    process.exit(1);
  }

  console.log('✓ Server reachable\n');

  // Build task list: each user does all 4 operations
  const tasks: (() => Promise<void>)[] = [];
  for (let i = 0; i < TOTAL_USERS; i++) {
    tasks.push(() => loadDoorPage(i));
    tasks.push(() => submitFormRequest(i));
    tasks.push(() => checkKnockerStatus(i));
    tasks.push(() => submitEmailWebhook(i));
  }

  // Shuffle to simulate realistic mixed traffic
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  const startTime = performance.now();
  await runPool(tasks, CONCURRENCY);
  const totalMs = Math.round(performance.now() - startTime);

  console.log(`\nCompleted in ${(totalMs / 1000).toFixed(1)}s`);
  printReport();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
