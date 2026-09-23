/**
 * בדיקת עשן מול האתר הפרוס (npm run live:smoke), להרצה אחרי כל פריסה.
 * בדיקות ה-e2e הרגילות רצות מול build מקומי בשורש הדומיין; באתר האמיתי האפליקציה יושבת בתת-נתיב (/Dimensions-/),
 * ולכן כאן משתמשים בכתובות מלאות. נבדק ב-Pixel 7 (Chromium) — כולל service worker ו-manifest, שרק Chromium חושף דרך CDP.
 */
import { devices, chromium } from '@playwright/test';

const SITE = process.argv[2] ?? 'https://dudutal-dev.github.io/Dimensions-/';
const failures = [];
/** הבדיקות ממתינות לאלמנט (waitFor) — isVisible אינו ממתין ומחזיר false לפני שהמסך צויר. */
const check = (ok, what) => {
  console.log(`${ok ? 'ok ' : 'X  '} ${what}`);
  if (!ok) failures.push(what);
};

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => message.type() === 'error' && errors.push(`console: ${message.text()}`));
page.on('response', (response) => response.status() >= 400 && errors.push(`HTTP ${response.status()} ${response.url()}`));

try {
  const response = await page.goto(SITE, { waitUntil: 'load' });
  check(response?.status() === 200, `הדף הראשי נטען (${response?.status()})`);
  check(await page.getByRole('button', { name: 'דלג' }).waitFor({ timeout: 15_000 }).then(() => true, () => false), 'מסך ההיכרות מופיע');

  // manifest ו-service worker
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await page.evaluate(async (href) => (await fetch(href)).json(), manifestHref);
  check(manifest?.name === 'מצפן המימדים' && manifest.display === 'standalone', 'manifest תקין');
  const swState = await page.evaluate(async () => {
    const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(() => resolve(null), 20_000))]);
    return registration ? { scope: registration.scope, active: Boolean(registration.active) } : null;
  });
  check(swState?.active && swState.scope === SITE, `service worker פעיל בטווח ${swState?.scope ?? '—'}`);
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  check(installabilityErrors.length === 0, `Chromium: ניתן להתקנה (${installabilityErrors.map((e) => e.errorId).join(', ') || 'בלי שגיאות'})`);

  // זרימה: דילוג על ההיכרות → בדיקת מימד מהירה → תוצאה → היום
  await page.getByRole('button', { name: 'דלג' }).click();
  await page.waitForURL(/#\/$/);
  await page.goto(`${SITE}#/checkin`);
  await page.getByRole('button', { name: 'בבטן' }).click();
  await page.getByRole('button', { name: 'זורמת' }).click();
  await page.getByRole('slider').fill('1');
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('button', { name: 'שקט, כמעט בלי מחשבות' }).click();
  await page.getByRole('button', { name: 'היא כבר חלפה' }).click();
  await page.getByRole('button', { name: 'שלווה' }).click();
  await page.getByRole('button', { name: 'כאן', exact: true }).click();
  await page.getByRole('button', { name: 'לבד', exact: true }).first().click();
  await page.getByRole('button', { name: 'לתוצאה' }).click();
  check(await page.getByRole('heading', { level: 1, name: '5D עכשיו' }).waitFor({ timeout: 10_000 }).then(() => true, () => false), 'בדיקת מימד מלאה מגיעה לתוצאה');
  await page.getByRole('button', { name: 'סיום' }).click();
  await page.waitForURL(/#\/$/);
  check(await page.getByRole('heading', { level: 2, name: 'עוגני היום' }).waitFor({ timeout: 10_000 }).then(() => true, () => false), 'הבדיקה נרשמה ו"היום" מוצג');

  // מסכים שנטענים בעצלתיים, ומסך שאינו קיים
  for (const [route, heading] of [
    ['shift', 'מעבר'],
    ['journey', 'המסע'],
    ['insights', 'תובנות'],
    ['journal', 'יומן'],
    ['library/fake-5d', 'זיוף 5D — מצבים מטעים'],
    ['settings', 'הגדרות'],
    ['help', 'צריך עזרה?'],
    ['install', 'התקנה למסך הבית'],
  ]) {
    await page.goto(`${SITE}#/${route}`);
    check(await page.getByRole('heading', { level: 1, name: heading }).waitFor({ timeout: 10_000 }).then(() => true, () => false), `#/${route}`);
  }

  // רענון אחרי שה-service worker פעיל: הכול מגיע מה-cache גם בלי רשת
  await context.setOffline(true);
  await page.goto(`${SITE}#/library`);
  check(await page.getByRole('heading', { level: 1, name: 'ספרייה' }).waitFor({ timeout: 10_000 }).then(() => true, () => false), 'הספרייה נפתחת במצב טיסה');
  await context.setOffline(false);

  check(errors.length === 0, `בלי שגיאות בקונסול וברשת${errors.length ? `:\n     ${errors.slice(0, 6).join('\n     ')}` : ''}`);
} finally {
  await browser.close();
}

console.log(failures.length ? `\nנכשל: ${failures.length}` : '\nהאתר הפרוס תקין.');
process.exit(failures.length ? 1 : 0);
