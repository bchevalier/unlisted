import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { directCanonicalScreenshotTargets } from './direct-canonical-screenshots.config.mjs';

const baseUrl = process.env.CANONICAL_SCREENSHOT_BASE_URL ?? process.env.APP_URL ?? 'http://127.0.0.1:3333';
const outputDir = path.join(process.cwd(), 'artifacts', 'canonical', 'direct');

fs.mkdirSync(outputDir, { recursive: true });
execFileSync('npm', ['run', 'demo:reset'], { cwd: process.cwd(), stdio: 'inherit' });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const capturedAt = new Date().toISOString();
const manifest = [];

for (const target of directCanonicalScreenshotTargets) {
  const url = new URL(target.path, baseUrl).toString();
  const outputPath = path.join(outputDir, target.output);

  await page.goto(url, { waitUntil: 'networkidle' });
  if (target.waitForText) {
    await page.getByText(target.waitForText, { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
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
fs.writeFileSync(manifestPath, `${JSON.stringify({ capturedAt, baseUrl, targets: manifest }, null, 2)}\n`, 'utf8');
console.log(`Wrote manifest -> ${manifestPath}`);
