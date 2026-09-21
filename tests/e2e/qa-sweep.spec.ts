import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * סריקת QA רוחבית (M10): כל המסכים, עם נתונים, בשלושה מצבים —
 * ברירת המחדל של המכשיר · מסך צר (320px) בערכה בהירה ובטקסט הגדול ביותר · מסך לרוחב.
 * בכל מסך: אין גלילה אופקית, אין שגיאות בקונסול, ו-axe נקי.
 */
const ROUTES = [
  '/',
  '/checkin',
  '/shift',
  '/journey',
  '/journey/w00',
  '/insights',
  '/journal',
  '/journal/evening',
  '/practice',
  '/diagnosis',
  '/library',
  '/library/five-channels',
  '/library/physics-quantum-basics',
  '/settings',
  '/help',
  '/backup',
  '/install',
  '/session/t1',
];

async function prepare(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/design');
  await page.getByRole('button', { name: 'לטעון נתוני דמה' }).click();
  await expect(page.getByText('נתוני הדמה נטענו')).toBeVisible({ timeout: 30_000 });
  return errors;
}

async function sweep(page: Page, { axe }: { axe: boolean }) {
  for (const route of ROUTES) {
    await page.goto(`/#${route}`);
    await expect(page.locator('h1').first(), route).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `גלילה אופקית ב-${route}`).toBeLessThanOrEqual(0);
    if (axe) {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(result.violations.map((v) => `${route} — ${v.id}: ${v.nodes[0]?.target.join(' ')} — ${v.nodes[0]?.any[0]?.message ?? ''}`)).toEqual([]);
    }
  }
}

test.describe('סריקת QA @sweep', () => {
  test.describe.configure({ timeout: 420_000 });

  test('כל המסכים עם נתונים: בלי גלילה אופקית, בלי שגיאות, axe נקי', async ({ page }) => {
    const errors = await prepare(page);
    await sweep(page, { axe: true });
    expect(errors).toEqual([]);
  });

  test('מסך צר (320px), ערכה בהירה וטקסט ענק', async ({ page }) => {
    const errors = await prepare(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/#/settings');
    await page.getByRole('radio', { name: 'בהיר' }).click();
    await page.getByRole('radio', { name: 'ענק' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await sweep(page, { axe: true });

    // חמשת פריטי הניווט נכנסים במלואם — אף תווית לא נחתכת בקצה המסך
    await page.goto('/#/insights');
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      for (const label of ['היום', 'בדיקה', 'מעבר', 'מסע', 'תובנות']) {
        const link = page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link', { name: label, exact: true });
        const box = await link.boundingBox();
        expect(box, label).not.toBeNull();
        expect(box!.x, label).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, label).toBeLessThanOrEqual(320);
        // גם התוכן עצמו (אייקון + תווית) אינו רחב מהפריט
        expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth), `${label}: התוכן גולש`).toBe(true);
      }
    }

    await page.screenshot({ path: `test-results/screens/${test.info().project.name}-81-insights-320-light-xl.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test('מסך לרוחב: הפריסה נשארת שמישה', async ({ page }) => {
    const errors = await prepare(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await sweep(page, { axe: false });
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 2, name: 'עוגני היום' })).toBeVisible();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}-82-today-landscape.png` });
    expect(errors).toEqual([]);
  });
});
