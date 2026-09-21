/**
 * מפיק את קובצי ה-PNG של האייקונים ושל מסכי הפתיחה ל-public/, מתוך הציור שב-tools/pwa-assets.mjs.
 * הרינדור נעשה ב-Chromium של Playwright (שכבר מותקן לבדיקות) — בלי תלות נוספת.
 * הקבצים נשמרים ב-git; מריצים שוב רק כשמשנים את הציור:  npm run icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ICONS, SCHEMES, SPLASH_DEVICES, iconSvg, splashFile, splashSvg } from './pwa-assets.mjs';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

async function renderPng(page, svg, width, height, transparent) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`);
  return page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await mkdir(join(PUBLIC, 'icons'), { recursive: true });
await mkdir(join(PUBLIC, 'splash'), { recursive: true });

for (const icon of ICONS) {
  const png = await renderPng(page, iconSvg({ fullBleed: icon.fullBleed }), icon.size, icon.size, !icon.fullBleed);
  await writeFile(join(PUBLIC, 'icons', icon.file), png);
  console.log(`icons/${icon.file}  ${png.length} bytes`);
}
await writeFile(join(PUBLIC, 'icons', 'favicon.svg'), iconSvg({ fullBleed: false }));

let splashBytes = 0;
for (const device of SPLASH_DEVICES) {
  for (const scheme of SCHEMES) {
    const width = device.w * device.dpr;
    const height = device.h * device.dpr;
    const png = await renderPng(page, splashSvg({ width, height, scheme }), width, height, false);
    await writeFile(join(PUBLIC, splashFile(device, scheme)), png);
    splashBytes += png.length;
  }
}
console.log(`splash: ${SPLASH_DEVICES.length * SCHEMES.length} files, ${Math.round(splashBytes / 1024)} KB`);
await browser.close();
