import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:3333/direct';
const out = process.argv[3] || 'direct-screenshot.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
await page.goto(url, { waitUntil: 'networkidle' });

// Scroll down in increments to trigger IntersectionObserver for ScrollReveal
const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < scrollHeight; y += 400) {
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(150);
}
// Scroll back to top
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

await page.screenshot({ path: out, fullPage: true });
console.log(`Screenshot saved to ${out}`);
await browser.close();
