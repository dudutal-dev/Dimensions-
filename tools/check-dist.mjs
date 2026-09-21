/**
 * בדיקות על תוצר ה-build, לפני פריסה (SPEC פרק 11 + CLAUDE.md):
 *  1. הטעינה הראשונית (מה ש-index.html טוען מיד: סקריפט, modulepreload, סגנון) קטנה מ-250KB gzip.
 *  2. אין ב-dist/ שום דבר שנראה כמו מפתח API.
 *  3. נכסי ה-PWA קיימים: service worker, manifest עם אייקונים (כולל maskable), אייקון ל-iOS.
 * הרצה:  npm run build && npm run dist:check
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET_KB = 250;
const failures = [];

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('אין dist/index.html — להריץ קודם npm run build');
  process.exit(1);
}

// ---------- 1. טעינה ראשונית ----------
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const initial = new Set();
for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
  const tag = match[0];
  const isInitial = tag.startsWith('<script') || /rel="(?:modulepreload|stylesheet)"/.test(tag);
  const url = /(?:src|href)="\.\/([^"]+)"/.exec(tag)?.[1];
  if (isInitial && url && /\.(?:js|css)$/.test(url)) initial.add(url);
}
let totalBytes = 0;
for (const file of initial) {
  const bytes = gzipSync(readFileSync(join(DIST, file))).length;
  totalBytes += bytes;
  console.log(`  ${(bytes / 1024).toFixed(1).padStart(7)} KB gzip  ${file}`);
}
const totalKb = totalBytes / 1024;
console.log(`טעינה ראשונית: ${totalKb.toFixed(1)} KB gzip (תקציב ${BUDGET_KB} KB)`);
if (initial.size === 0) failures.push('לא נמצאו קובצי טעינה ראשונית ב-index.html');
if (totalKb > BUDGET_KB) failures.push(`הטעינה הראשונית חורגת מהתקציב: ${totalKb.toFixed(1)} KB`);

// ---------- 2. מפתחות ----------
const SECRET_PATTERNS = [/sk_[A-Za-z0-9]{20,}/, /xi-api-key/i, /ELEVENLABS_API_KEY/, /api[_-]?key\s*[:=]\s*["'][A-Za-z0-9_-]{16,}/i];
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}
for (const path of walk(DIST)) {
  if (!/\.(?:js|css|html|json|webmanifest|svg|txt|map)$/.test(path)) continue;
  const text = readFileSync(path, 'utf8');
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) failures.push(`חשד למפתח ב-${relative(DIST, path)} (${pattern})`);
  }
}

// ---------- 3. נכסי PWA ----------
for (const file of ['sw.js', 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/favicon.svg']) {
  if (!existsSync(join(DIST, file))) failures.push(`חסר ${file}`);
}
if (existsSync(join(DIST, 'manifest.webmanifest'))) {
  const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'));
  if (manifest.display !== 'standalone') failures.push('manifest: display אינו standalone');
  if (!manifest.icons?.some((icon) => icon.purpose === 'maskable')) failures.push('manifest: חסר אייקון maskable');
  for (const icon of manifest.icons ?? []) {
    if (!existsSync(join(DIST, icon.src))) failures.push(`manifest: האייקון ${icon.src} לא קיים`);
  }
}
if (existsSync(join(DIST, 'sw.js')) && /splash\//.test(readFileSync(join(DIST, 'sw.js'), 'utf8'))) {
  failures.push('מסכי הפתיחה נכנסו ל-precache (משקל מיותר)');
}

if (failures.length > 0) {
  console.error(`\nנכשל:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('dist תקין: תקציב, מפתחות, PWA.');
