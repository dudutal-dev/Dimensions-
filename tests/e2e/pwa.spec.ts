import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true });

async function skipOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

test.describe('PWA', () => {
  test('manifest מלא, אייקונים (כולל maskable), אייקון ומסכי פתיחה ל-iOS', async ({ page, request }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await (await request.get(new URL(manifestHref!, page.url()).toString())).json();

    expect(manifest).toMatchObject({ name: 'מצפן המימדים', short_name: 'מצפן', lang: 'he', dir: 'rtl', display: 'standalone', orientation: 'portrait', start_url: './', scope: './' });
    expect(manifest.icons.map((i: { purpose: string }) => i.purpose).sort()).toEqual(['any', 'any', 'maskable']);
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const response = await request.get(new URL(icon.src, new URL(manifestHref!, page.url())).toString());
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
    expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['./#/checkin', './#/sos']);

    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', './icons/apple-touch-icon.png');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('link[rel="apple-touch-startup-image"]')).toHaveCount(20);
    const splash = await page.locator('link[rel="apple-touch-startup-image"]').first().getAttribute('href');
    expect((await request.get(new URL(splash!, page.url()).toString())).status()).toBe(200);
  });

  test('"איך מתקינים": ההוראות של המכשיר הזה קודם, והקישור מ"היום" נסגר לתמיד', async ({ page }) => {
    await skipOnboarding(page);
    const hint = page.getByRole('link', { name: /להתקין למסך הבית/ });
    await expect(hint).toBeVisible();
    await hint.click();
    await expect(page).toHaveURL(/#\/install$/);
    await expect(page.getByRole('heading', { level: 1, name: 'התקנה למסך הבית' })).toBeVisible();
    const first = page.getByRole('heading', { level: 2 }).first();
    await expect(first).toContainText('המכשיר הזה');
    await expect(first).toContainText(test.info().project.name === 'iphone' ? 'iPhone' : test.info().project.name === 'pixel' ? 'Android' : 'מחשב');
    await shot(page, '80-install');

    await page.goto('/#/');
    await page.getByRole('button', { name: /להסתיר את ההצעה/ }).click();
    await expect(hint).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'עוגני היום' })).toBeVisible();
    await expect(hint).toBeHidden();
  });

  test('מצב טיסה: אחרי טעינה ראשונה כל המסכים נפתחים בלי רשת, והנתונים נשמרים', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright אינו מדמה ניתוק רשת מול service worker ב-WebKit; offline ב-iPhone נבדק על מכשיר פיזי');
    test.slow();
    await skipOnboarding(page);
    // ה-service worker סיים לשמור את כל הקבצים
    await page.goto('/#/install');
    await expect(page.getByText('הקבצים כבר שמורים במכשיר', { exact: false })).toBeVisible({ timeout: 30_000 });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'התקנה למסך הבית' })).toBeVisible();

    // מסכים שנטענים בעצלתיים — כולם מגיעים מה-cache
    const screens: Array<[string, string]> = [
      ['/#/', 'עוגני היום'],
      ['/#/shift', 'מעבר'],
      ['/#/journey', 'המסע'],
      ['/#/insights', 'תובנות'],
      ['/#/journal', 'יומן'],
      ['/#/library/five-channels', 'חמשת ערוצי הזיהוי'],
      ['/#/settings', 'הגדרות'],
      ['/#/help', 'צריך עזרה?'],
      ['/#/backup', 'גיבוי'],
    ];
    for (const [url, heading] of screens) {
      await page.goto(url);
      await expect(page.getByRole('heading', { name: heading }).first(), url).toBeVisible();
    }

    // בדיקת מימד מהירה נשמרת גם בלי רשת
    await page.goto('/#/checkin');
    await expect(page.getByRole('heading', { level: 1, name: 'נשימה' })).toBeVisible();
    await page.getByRole('button', { name: 'בבטן' }).click();
    await page.getByRole('button', { name: 'זורמת' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'כיווץ' })).toBeVisible();

    // נגן התרגולים נפתח בלי רשת (הצלילים מסונתזים — אין קובצי אודיו להוריד)
    await page.goto('/#/session/t1');
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();

    // הגופנים הגיעו מה-cache ולא נפלו לגופן המערכת
    await page.goto('/#/');
    expect(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('16px "Heebo Variable"')))).toBe(true);
    await context.setOffline(false);
  });
});

/**
 * Lighthouse הסיר את קטגוריית ה-PWA (גרסה 12), ולכן בודקים ישירות את מה שהיא בדקה:
 * Chromium עצמו מדווח אם האפליקציה ניתנת להתקנה, ואם ה-manifest תקין. לצד זה — מדדי טעינה בסיסיים.
 */
test.describe('התקנה וביצועים (Chromium)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP זמין רק ב-Chromium');

  test('Chromium מאשר: האפליקציה ניתנת להתקנה, וה-manifest בלי שגיאות', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await page.context().newCDPSession(page);
    const manifest = await cdp.send('Page.getAppManifest');
    expect(manifest.errors).toEqual([]);
    expect(manifest.url).toContain('manifest.webmanifest');
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
  });

  // רץ רק ב-npm run e2e:qa, ב-worker יחיד — מדידה לצד בדיקות אחרות על אותה מכונה חסרת משמעות.
  // הסף הוא "טוב" לפי Web Vitals (LCP עד 2.5 שניות), עם מעבד מואט פי 4 כמו בפרופיל הנייד של Lighthouse.
  test('@perf טעינה ראשונה עם מעבד מואט פי 4: ציור ראשון מיידי, LCP טוב, ובלי קפיצות פריסה', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'דלג' })).toBeVisible();
    const metrics = await page.evaluate(
      () =>
        new Promise<{ lcp: number; cls: number; fcp: number }>((resolve) => {
          let lcp = 0;
          let cls = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
              if (!entry.hadRecentInput) cls += entry.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
          setTimeout(() => resolve({ lcp, cls, fcp }), 1500);
        }),
    );
    console.log(`[perf:${test.info().project.name}] FCP ${Math.round(metrics.fcp)}ms · LCP ${Math.round(metrics.lcp)}ms · CLS ${metrics.cls.toFixed(3)}`);
    expect(metrics.lcp).toBeGreaterThan(0);
    expect(metrics.fcp).toBeLessThan(1000);
    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.cls).toBeLessThan(0.1);
  });
});
