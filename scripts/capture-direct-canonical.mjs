import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { directCanonicalScreenshotTargets } from './direct-canonical-screenshots.config.mjs';
import {
  buildManagedServerEnv,
  resolveCaptureRuntime,
  waitForUrlReady,
} from './capture-direct-canonical-lib.mjs';

const runtime = resolveCaptureRuntime(process.env);
const outputDir = path.join(process.cwd(), 'artifacts', 'canonical', 'direct');
const readinessUrl = new URL('/direct', runtime.baseUrl).toString();

fs.mkdirSync(outputDir, { recursive: true });

let managedServer = null;

async function stopManagedServer() {
  if (!managedServer || managedServer.killed) {
    return;
  }

  await new Promise((resolve) => {
    const child = managedServer;
    const timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 10_000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill('SIGTERM');
  });
}

try {
  if (runtime.manageServer) {
    console.log(`Starting managed screenshot server -> ${runtime.baseUrl}`);
    managedServer = spawn('npx', ['next', 'dev', '-H', runtime.host, '-p', runtime.port], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: buildManagedServerEnv(process.env, runtime),
    });

    await waitForUrlReady(readinessUrl);
  } else {
    console.log(`Using existing app server -> ${runtime.baseUrl}`);
    await waitForUrlReady(readinessUrl, { timeoutMs: 15_000 });
  }

  execFileSync('npm', ['run', 'demo:reset'], { cwd: process.cwd(), stdio: 'inherit' });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const capturedAt = new Date().toISOString();
  const manifest = [];

  for (const target of directCanonicalScreenshotTargets) {
    const url = new URL(target.path, runtime.baseUrl).toString();
    const outputPath = path.join(outputDir, target.output);

    await page.goto(url, { waitUntil: 'networkidle' });
    if (target.waitForText) {
      await page.getByText(target.waitForText, { exact: false }).waitFor({ state: 'visible', timeout: 15_000 });
    }
    await page.screenshot({ path: outputPath, fullPage: true });

    manifest.push({
      key: target.key,
      label: target.label,
      url,
      outputPath,
      capturedAt,
    });

    console.log(`Captured ${target.label} -> ${outputPath}`);
  }

  await browser.close();

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ capturedAt, baseUrl: runtime.baseUrl, targets: manifest }, null, 2)}\n`,
    'utf8'
  );
  console.log(`Wrote manifest -> ${manifestPath}`);
} finally {
  await stopManagedServer();
}
