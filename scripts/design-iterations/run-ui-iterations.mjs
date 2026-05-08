#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { chromium, firefox } from 'playwright';

const ROOT = process.cwd();
const BASE_URL = process.env.DESIGN_ITERATION_BASE_URL ?? 'http://localhost:3333';
const ARTIFACTS_ROOT = path.join(ROOT, 'artifacts/design-iterations');
const ITERATION_LOG = path.join(ARTIFACTS_ROOT, 'ITERATION_LOG.md');
const SERVER_LOG = path.join(ARTIFACTS_ROOT, 'dev-server.log');
const SERVER_PID_FILE = path.join(ARTIFACTS_ROOT, 'dev-server.pid');
const CSS_PATH = path.join(ROOT, 'app/globals.css');

const DEFAULT_SLOT_COUNT = 30;
const DEFAULT_INTERVAL_MS = 4 * 60 * 1000;

const VIEWPORTS = [
  {
    name: 'mobile',
    viewport: { width: 390, height: 844 },
  },
  {
    name: 'desktop-square',
    viewport: { width: 1200, height: 1200 },
  },
  {
    name: 'desktop-landscape',
    viewport: { width: 1440, height: 900 },
  },
];

const ROUTES = [
  { slug: 'landing', path: '/' },
  { slug: 'direct', path: '/direct' },
  { slug: 'reach', path: '/reach' },
];

const EXPECTED_SCREENSHOTS_PER_CAPTURE = ROUTES.length * VIEWPORTS.length;

const SLOT_PLANS = [
  {
    issue: {
      landing: 'Hero line length feels too wide on desktop landscape.',
      direct: 'Primary message block reads broad at first glance.',
      reach: 'Intro paragraph scans dense in large viewport.',
    },
    change: 'Narrowed hero and subtitle widths for tighter reading rhythm.',
    updates: {
      '--iter-hero-content-max': '790px',
      '--iter-subtitle-max': '620px',
    },
  },
  {
    issue: {
      landing: 'Top bar contrast against hero felt slightly low.',
      direct: 'Header/chip edge needed a bit more separation.',
      reach: 'Top-row controls needed stronger presence.',
    },
    change: 'Raised top bar opacity and shadow definition for clearer layering.',
    updates: {
      '--iter-topbar-alpha': '0.94',
      '--iter-topbar-shadow': '0.08',
    },
  },
  {
    issue: {
      landing: 'Mobile hero content still felt vertically compressed.',
      direct: 'Hero section could breathe more before action row.',
      reach: 'Hero heading + body spacing felt tight.',
    },
    change: 'Added vertical hero breathing room and increased minimum hero height.',
    updates: {
      '--iter-hero-content-pad-y': '96px',
      '--iter-hero-min-height': '540px',
    },
  },
  {
    issue: {
      landing: 'Gap between hero actions looked slightly loose.',
      direct: 'Card stack separation read uneven.',
      reach: 'Panel rhythm felt airy for core dashboard content.',
    },
    change: 'Reduced global section spacing and tightened button clusters.',
    updates: {
      '--iter-home-gap': '28px',
      '--iter-button-gap': '12px',
    },
  },
  {
    issue: {
      landing: 'Pillar blocks felt oversized relative to text volume.',
      direct: 'Feature panels looked deeper than needed.',
      reach: 'Summary + actions blocks carried excess internal whitespace.',
    },
    change: 'Trimmed panel padding and slightly reduced large panel corner radius.',
    updates: {
      '--iter-panel-padding': '24px',
      '--iter-panel-radius': '20px',
    },
  },
  {
    issue: {
      landing: 'Background treatment pulled focus from headline.',
      direct: 'Decorative texture competed with body copy.',
      reach: 'Accent noise reduced quick stat scanning.',
    },
    change: 'Softened background grid and gradient intensity.',
    updates: {
      '--iter-grid-opacity': '0.13',
      '--iter-gradient-opacity': '0.68',
    },
  },
  {
    issue: {
      landing: 'Headline looked one step too dominant on square desktop.',
      direct: 'Heading competed with key CTA row.',
      reach: 'Hero title overwhelmed dashboard context.',
    },
    change: 'Reduced hero title size for better hierarchy balance.',
    updates: {
      '--iter-title-size': '54px',
    },
  },
  {
    issue: {
      landing: 'Subtitle read small relative to body density.',
      direct: 'Value paragraph could be easier to parse quickly.',
      reach: 'Intro copy needed slightly stronger readability.',
    },
    change: 'Raised subtitle size slightly to improve readability.',
    updates: {
      '--iter-subtitle-size': '19px',
    },
  },
  {
    issue: {
      landing: 'Hero metadata looked visually heavy in uppercase.',
      direct: 'Supporting notes felt high-contrast for secondary text.',
      reach: 'Small labels could be less dominant.',
    },
    change: 'Reduced metadata type size for subtler support copy.',
    updates: {
      '--iter-meta-size': '12px',
    },
  },
  {
    issue: {
      landing: 'Primary/secondary button text sat close to edges.',
      direct: 'Action pills looked cramped for longer labels.',
      reach: 'Quick links needed slightly better click affordance.',
    },
    change: 'Expanded horizontal button padding for cleaner hit area.',
    updates: {
      '--iter-button-pad-x': '24px',
    },
  },
  {
    issue: {
      landing: 'Lane and pillar groups still showed extra horizontal spread.',
      direct: 'Split panels felt too detached at mid widths.',
      reach: 'Summary/action sections needed tighter grouping.',
    },
    change: 'Reduced lane grid gap across card and panel stacks.',
    updates: {
      '--iter-lane-grid-gap': '16px',
    },
  },
  {
    issue: {
      landing: 'Lane cards had slightly too much internal padding.',
      direct: 'Panel internals could be denser for scannability.',
      reach: 'Stat summary block looked over-padded.',
    },
    change: 'Trimmed lane-panel padding to sharpen information density.',
    updates: {
      '--iter-lane-panel-padding': '22px',
    },
  },
  {
    issue: {
      landing: 'Card corners were inconsistent between sections.',
      direct: 'Panel silhouette felt softer than action buttons.',
      reach: 'Stat card radius differed from panel rhythm.',
    },
    change: 'Aligned lane panel corner radius with tighter surface style.',
    updates: {
      '--iter-lane-panel-radius': '16px',
    },
  },
  {
    issue: {
      landing: 'Numerical emphasis in Reach previews looked understated.',
      direct: 'Key values needed stronger visual anchors.',
      reach: 'Contract metrics lacked punch in quick scan.',
    },
    change: 'Increased stat value type size to improve metric legibility.',
    updates: {
      '--iter-stat-size': '30px',
    },
  },
  {
    issue: {
      landing: 'Topbar blur made edges look slightly fuzzy on Firefox.',
      direct: 'Chip boundaries looked softer than intended.',
      reach: 'Header details needed crisper rendering.',
    },
    change: 'Reduced topbar blur strength for sharper edge rendering.',
    updates: {
      '--iter-topbar-blur': '10px',
    },
  },
  {
    issue: {
      landing: 'Panel boundaries still blended into white surfaces.',
      direct: 'Card separation from background felt mild.',
      reach: 'Block outlines needed clearer differentiation.',
    },
    change: 'Lowered border alpha to a cleaner, less hazy value.',
    updates: {
      '--iter-panel-border-alpha': '0.84',
    },
  },
  {
    issue: {
      landing: 'Pill buttons looked oversized compared to cards.',
      direct: 'Action controls could feel less bulky.',
      reach: 'Mixed controls needed more modern compact radius.',
    },
    change: 'Shifted button corner radius from full-pill to soft-round.',
    updates: {
      '--iter-button-radius': '20px',
    },
  },
  {
    issue: {
      landing: 'Buttons remained slightly tall in dense stacks.',
      direct: 'Action rows looked heavy at 3-button layout.',
      reach: 'Quick controls consumed vertical space.',
    },
    change: 'Reduced vertical button padding for denser action rows.',
    updates: {
      '--iter-button-pad-y': '11px',
    },
  },
  {
    issue: {
      landing: 'Hero container shape felt too flat after previous tightening.',
      direct: 'Primary panel lacked enough visual prominence.',
      reach: 'Hero block silhouette could stand out more.',
    },
    change: 'Increased hero radius to restore premium panel silhouette.',
    updates: {
      '--iter-hero-radius': '24px',
    },
  },
  {
    issue: {
      landing: 'Hero side padding clipped long lines on square viewport.',
      direct: 'Action groups could use extra horizontal room.',
      reach: 'Dashboard intro looked slightly cramped.',
    },
    change: 'Expanded hero horizontal padding for safer text wrapping.',
    updates: {
      '--iter-hero-content-pad-x': '30px',
    },
  },
  {
    issue: {
      landing: 'Hero consumed too much vertical space on smaller laptops.',
      direct: 'Below-fold content started too late.',
      reach: 'Summary content visibility below hero needed lift.',
    },
    change: 'Reduced hero minimum height to pull useful content above fold.',
    updates: {
      '--iter-hero-min-height': '500px',
    },
  },
  {
    issue: {
      landing: 'Headline still felt one step loud after spacing changes.',
      direct: 'Large title dominated panel body.',
      reach: 'Dashboard heading emphasis remained too strong.',
    },
    change: 'Reduced title size again for steadier visual hierarchy.',
    updates: {
      '--iter-title-size': '52px',
    },
  },
  {
    issue: {
      landing: 'Long subtitle lines exceeded comfortable scan length.',
      direct: 'Body copy had occasional long wraps in landscape.',
      reach: 'Intro text could be more concise in width.',
    },
    change: 'Further constrained subtitle max width.',
    updates: {
      '--iter-subtitle-max': '600px',
    },
  },
  {
    issue: {
      landing: 'Overall page rhythm still had spare vertical air.',
      direct: 'Panel spacing could be more decisive.',
      reach: 'Action + summary blocks needed tighter cadence.',
    },
    change: 'Reduced global home section gap to improve narrative flow.',
    updates: {
      '--iter-home-gap': '24px',
    },
  },
  {
    issue: {
      landing: 'Panels looked slightly oversized relative to new spacing.',
      direct: 'Detail panels could remain compact without losing clarity.',
      reach: 'Summary blocks needed compact body spacing.',
    },
    change: 'Reduced panel padding one more step for compact density.',
    updates: {
      '--iter-panel-padding': '22px',
    },
  },
  {
    issue: {
      landing: 'Multi-card sections still had minor gutter drift.',
      direct: 'Two-column splits looked spread on square desktop.',
      reach: 'Metric cards and links felt slightly disconnected.',
    },
    change: 'Tightened lane grid gaps for stronger grouping.',
    updates: {
      '--iter-lane-grid-gap': '14px',
    },
  },
  {
    issue: {
      landing: 'Topbar remained too opaque over bright hero patches.',
      direct: 'Header transition into content felt heavy.',
      reach: 'Header needed lighter glass effect.',
    },
    change: 'Adjusted topbar opacity and blur for cleaner translucency.',
    updates: {
      '--iter-topbar-alpha': '0.92',
      '--iter-topbar-blur': '8px',
    },
  },
  {
    issue: {
      landing: 'Gradient layer still drew focus from hero copy.',
      direct: 'Surface accents looked over-saturated on Chromium.',
      reach: 'Background energy competed with stats.',
    },
    change: 'Lowered gradient opacity for calmer visual hierarchy.',
    updates: {
      '--iter-gradient-opacity': '0.64',
    },
  },
  {
    issue: {
      landing: 'Grid texture remained visible in compressed mobile crop.',
      direct: 'Line texture flickered at small scales.',
      reach: 'Fine background grid added subtle noise.',
    },
    change: 'Reduced grid opacity for cleaner small-screen rendering.',
    updates: {
      '--iter-grid-opacity': '0.10',
    },
  },
  {
    issue: {
      landing: 'Final pass needed rounded-action consistency with polished spacing.',
      direct: 'Buttons should regain soft-pill personality for brand tone.',
      reach: 'Action affordance felt better with rounded controls.',
    },
    change: 'Final polish: restored rounded button style and balanced subtitle size.',
    updates: {
      '--iter-button-radius': '999px',
      '--iter-subtitle-size': '18px',
      '--iter-title-size': '53px',
    },
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    slots: DEFAULT_SLOT_COUNT,
    intervalMs: DEFAULT_INTERVAL_MS,
    startSlot: 1,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--slots') {
      parsed.slots = Number(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--interval-ms') {
      parsed.intervalMs = Number(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--start-slot') {
      parsed.startSlot = Number(args[i + 1]);
      i += 1;
      continue;
    }
  }

  if (!Number.isFinite(parsed.slots) || parsed.slots <= 0) {
    throw new Error(`Invalid --slots value: ${parsed.slots}`);
  }

  if (!Number.isFinite(parsed.intervalMs) || parsed.intervalMs <= 0) {
    throw new Error(`Invalid --interval-ms value: ${parsed.intervalMs}`);
  }

  if (!Number.isFinite(parsed.startSlot) || parsed.startSlot <= 0) {
    throw new Error(`Invalid --start-slot value: ${parsed.startSlot}`);
  }

  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function padSlot(slot) {
  return String(slot).padStart(2, '0');
}

function nowIso() {
  return new Date().toISOString();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function clearDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
  await ensureDir(dirPath);
}

async function countPngFiles(dirPath) {
  let count = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      count += await countPngFiles(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      count += 1;
    }
  }

  return count;
}

async function initArtifacts() {
  await ensureDir(ARTIFACTS_ROOT);

  if (!existsSync(ITERATION_LOG)) {
    const header = `# Knokio UI Design Iteration Log\n\n- Started: ${nowIso()}\n- Cadence: 30 slots, every 4 minutes\n- Pages: /, /direct, /reach\n- Formats: mobile, desktop-square, desktop-landscape\n- Browsers: Chromium first, Firefox follow-up\n\n---\n`;

    await fs.writeFile(ITERATION_LOG, header, 'utf8');
  }
}

async function checkServerHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(BASE_URL, { signal: controller.signal });
    clearTimeout(timer);

    return {
      healthy: response.status < 500,
      status: response.status,
    };
  } catch {
    return {
      healthy: false,
      status: null,
    };
  }
}

function restartDevServer() {
  const escapedRoot = ROOT.replace(/"/g, '\\"');
  const escapedLog = SERVER_LOG.replace(/"/g, '\\"');
  const escapedPid = SERVER_PID_FILE.replace(/"/g, '\\"');

  const command = [
    `cd "${escapedRoot}"`,
    `export PATH="${escapedRoot}/node_modules/.bin:$PATH"`,
    `(pkill -f "next dev .*3333" || true)`,
    `nohup next dev -H 0.0.0.0 -p 3333 >> "${escapedLog}" 2>&1 & echo $! > "${escapedPid}"`,
  ].join(' && ');

  execSync(`bash -lc '${command}'`, { stdio: 'ignore' });
}

async function ensureServerReadyForSlot() {
  const before = await checkServerHealth();

  if (before.healthy) {
    return {
      restarted: false,
      health: `OK (${before.status ?? 'unknown'})`,
    };
  }

  restartDevServer();

  const waitStart = Date.now();
  const timeoutMs = 90 * 1000;

  while (Date.now() - waitStart < timeoutMs) {
    await sleep(2000);
    const probe = await checkServerHealth();

    if (probe.healthy) {
      return {
        restarted: true,
        health: `Restarted (status ${probe.status ?? 'unknown'})`,
      };
    }
  }

  return {
    restarted: true,
    health: 'Restart attempted, health check still failing',
  };
}

async function captureMatrix(browserName, outputDir) {
  const launcher = browserName === 'firefox' ? firefox : chromium;
  const browser = await launcher.launch();

  try {
    for (const view of VIEWPORTS) {
      const context = await browser.newContext({ viewport: view.viewport });
      try {
        for (const route of ROUTES) {
          const page = await context.newPage();
          try {
            await page.goto(`${BASE_URL}${route.path}`, {
              waitUntil: 'networkidle',
              timeout: 45_000,
            });
            await page.waitForTimeout(900);

            const filePath = path.join(outputDir, `${route.slug}-${view.name}.png`);
            await page.screenshot({
              path: filePath,
              fullPage: true,
            });
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }

    return {
      ok: true,
      message: 'pass',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await browser.close();
  }
}

async function applySlotTokenUpdates(slotNumber, updates) {
  const css = await fs.readFile(CSS_PATH, 'utf8');
  let nextCss = css;

  const mergedUpdates = {
    '--iter-slot': String(slotNumber),
    ...updates,
  };

  for (const [token, value] of Object.entries(mergedUpdates)) {
    const tokenRegex = new RegExp(`(${escapeRegExp(token)}\\s*:\\s*)([^;]+)(;)`);

    if (!tokenRegex.test(nextCss)) {
      throw new Error(`Could not locate token ${token} in ${CSS_PATH}`);
    }

    nextCss = nextCss.replace(tokenRegex, `$1${value}$3`);
  }

  await fs.writeFile(CSS_PATH, nextCss, 'utf8');
}

function formatIssueLines(issue) {
  return [`- Landing: ${issue.landing}`, `- Direct: ${issue.direct}`, `- Reach: ${issue.reach}`].join('\n');
}

function formatUpdateMap(updates) {
  return Object.entries(updates)
    .map(([token, value]) => `  - ${token} → ${value}`)
    .join('\n');
}

async function appendSlotLog(slotNumber, details) {
  const slotLabel = padSlot(slotNumber);
  const attemptsLine = details.attempts ? `- Attempts: ${details.attempts}\n` : '';
  const failureLine = details.recoveryReason ? `- Recovery note: ${details.recoveryReason}\n` : '';
  const preventionLine = details.prevention ? `- Prevention added: ${details.prevention}\n` : '';

  const logEntry = `\n## Slot ${slotLabel} — ${details.timestamp}\n\n- Health check: ${details.health}\n${attemptsLine}${failureLine}${preventionLine}- Issues observed:\n${formatIssueLines(details.issue)}\n- Improvement applied: ${details.change}\n- Token updates:\n${formatUpdateMap(details.updates)}\n- Chromium check: ${details.chromium}\n- Firefox check: ${details.firefox}\n- Artifacts: \`artifacts/design-iterations/slot-${slotLabel}\`\n`;

  await fs.appendFile(ITERATION_LOG, logEntry, 'utf8');
}

async function writeSlotJson(slotNumber, details) {
  const slotLabel = padSlot(slotNumber);
  const slotDir = path.join(ARTIFACTS_ROOT, `slot-${slotLabel}`);
  const reportPath = path.join(slotDir, 'slot-report.json');

  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        slot: slotNumber,
        ...details,
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function run() {
  const { slots, intervalMs, startSlot } = parseArgs();
  await initArtifacts();

  if (startSlot > SLOT_PLANS.length) {
    throw new Error(`start-slot ${startSlot} exceeds configured plan length ${SLOT_PLANS.length}`);
  }

  const effectiveSlots = Math.min(slots, SLOT_PLANS.length - startSlot + 1);
  const runStart = Date.now();

  for (let i = 0; i < effectiveSlots; i += 1) {
    const slotNumber = startSlot + i;
    const plan = SLOT_PLANS[slotNumber - 1];
    const scheduledAt = runStart + i * intervalMs;
    const waitMs = scheduledAt - Date.now();

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const slotLabel = padSlot(slotNumber);
    const slotDir = path.join(ARTIFACTS_ROOT, `slot-${slotLabel}`);
    const chromiumDir = path.join(slotDir, 'chromium');
    const chromiumPreDir = path.join(chromiumDir, 'pre');
    const chromiumPostDir = path.join(chromiumDir, 'post');
    const firefoxDir = path.join(slotDir, 'firefox');
    const firefoxPostDir = path.join(firefoxDir, 'post');

    await ensureDir(chromiumPreDir);
    await ensureDir(chromiumPostDir);
    await ensureDir(firefoxPostDir);

    let attempts = 0;
    let slotSucceeded = false;
    let lastFailureReason = '';
    let serverHealthSummary = 'unknown';
    let chromiumSummary = 'pre=fail (not run), post=fail (not run)';
    let firefoxSummary = 'post=fail (not run)';

    while (!slotSucceeded) {
      attempts += 1;

      if (attempts > 1) {
        await sleep(2500);
      }

      await clearDir(chromiumPreDir);
      await clearDir(chromiumPostDir);
      await clearDir(firefoxPostDir);

      const serverStatus = await ensureServerReadyForSlot();
      serverHealthSummary = serverStatus.health;

      const chromiumPreResult = await captureMatrix('chromium', chromiumPreDir);
      const chromiumPreCount = await countPngFiles(chromiumPreDir);
      const chromiumPreOk = chromiumPreResult.ok && chromiumPreCount === EXPECTED_SCREENSHOTS_PER_CAPTURE;

      if (!chromiumPreOk) {
        lastFailureReason = `chromium pre failed (result=${chromiumPreResult.message}; files=${chromiumPreCount}/${EXPECTED_SCREENSHOTS_PER_CAPTURE})`;
        restartDevServer();
        continue;
      }

      await applySlotTokenUpdates(slotNumber, plan.updates);

      const chromiumPostResult = await captureMatrix('chromium', chromiumPostDir);
      const chromiumPostCount = await countPngFiles(chromiumPostDir);
      const chromiumPostOk = chromiumPostResult.ok && chromiumPostCount === EXPECTED_SCREENSHOTS_PER_CAPTURE;

      chromiumSummary = [
        `pre=${chromiumPreOk ? 'pass' : `fail (${chromiumPreResult.message})`}`,
        `post=${chromiumPostOk ? 'pass' : `fail (${chromiumPostResult.message}; files=${chromiumPostCount}/${EXPECTED_SCREENSHOTS_PER_CAPTURE})`}`,
      ].join(', ');

      if (!chromiumPostOk) {
        lastFailureReason = `chromium post failed (result=${chromiumPostResult.message}; files=${chromiumPostCount}/${EXPECTED_SCREENSHOTS_PER_CAPTURE})`;
        restartDevServer();
        continue;
      }

      const firefoxPostResult = await captureMatrix('firefox', firefoxPostDir);
      const firefoxPostCount = await countPngFiles(firefoxPostDir);
      const firefoxPostOk = firefoxPostResult.ok && firefoxPostCount === EXPECTED_SCREENSHOTS_PER_CAPTURE;
      firefoxSummary = firefoxPostOk
        ? 'post=pass'
        : `post=fail (${firefoxPostResult.message}; files=${firefoxPostCount}/${EXPECTED_SCREENSHOTS_PER_CAPTURE})`;

      if (!firefoxPostOk) {
        lastFailureReason = `firefox post failed (result=${firefoxPostResult.message}; files=${firefoxPostCount}/${EXPECTED_SCREENSHOTS_PER_CAPTURE})`;
        restartDevServer();
        continue;
      }

      slotSucceeded = true;
    }

    const timestamp = nowIso();

    const slotDetails = {
      timestamp,
      health: serverHealthSummary,
      attempts,
      recoveryReason: attempts > 1 ? lastFailureReason || 'retry loop resolved transient failure' : undefined,
      prevention:
        attempts > 1
          ? 'Auto-restart + screenshot-count validation kept this slot from advancing until stable.'
          : 'Server health checks and screenshot-count validation active.',
      issue: plan.issue,
      change: plan.change,
      updates: {
        '--iter-slot': String(slotNumber),
        ...plan.updates,
      },
      chromium: chromiumSummary,
      firefox: firefoxSummary,
    };

    await appendSlotLog(slotNumber, slotDetails);
    await writeSlotJson(slotNumber, slotDetails);

    const statusLine = `[slot ${slotLabel}] health=${serverHealthSummary} | attempts=${attempts} | chromium=${chromiumSummary} | firefox=${firefoxSummary}`;
    await fs.appendFile(path.join(ARTIFACTS_ROOT, 'runner-status.log'), `${nowIso()} ${statusLine}\n`, 'utf8');

    console.log(statusLine);
  }

  console.log(`Completed ${effectiveSlots} slot(s).`);
}

run().catch(async (error) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  try {
    await ensureDir(ARTIFACTS_ROOT);
    await fs.appendFile(path.join(ARTIFACTS_ROOT, 'runner-errors.log'), `${nowIso()} ${message}\n`, 'utf8');
  } catch {
    // no-op
  }
  console.error(message);
  process.exit(1);
});
