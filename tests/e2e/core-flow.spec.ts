import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** צילומי מסך לבדיקה ויזואלית נשמרים ב-test-results/screens (לא נכנסים ל-git). */
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: false });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'גלילה אופקית').toBeLessThanOrEqual(0);
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

async function completeOnboarding(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/welcome$/);
  await expect(page.getByRole('heading', { level: 1, name: 'מצפן המימדים' })).toBeVisible();
  // ממתינים לכותרת של כל מסך לפני ההקשה הבאה: הקשה בזמן אנימציית המעבר (AnimatePresence mode=wait) נבלעת תחת עומס
  for (const next of ['קודם כול, ביושר', 'שלושה מצבים', 'גבולות', 'מאיפה מתחילים?']) {
    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(page.getByRole('heading', { level: 1, name: next })).toBeVisible();
  }
  await page.getByRole('button', { name: /בדיקה ראשונה/ }).click();
  await expect(page).toHaveURL(/#\/checkin$/);
}

test.describe('הזרימה המרכזית', () => {
  test('Onboarding → בדיקת מימד → תוצאה מוסברת → היום', async ({ page }) => {
    test.slow(); // שלוש סריקות נגישות + צילומי מסך; WebKit על Windows איטי
    await page.goto('/');
    await expect(page).toHaveURL(/#\/welcome$/);
    await expectAccessible(page);
    await shot(page, '01-welcome');

    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'קודם כול, ביושר' })).toBeVisible();
    await expect(page.getByText('מימד כאן הוא מצב תודעה, לא מקום ביקום.')).toBeVisible();
    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'שלושה מצבים' })).toBeVisible();
    await shot(page, '02-states');
    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'גבולות' })).toBeVisible();
    await page.getByRole('button', { name: 'המשך' }).click();
    await shot(page, '03-start');
    await page.getByRole('button', { name: /בדיקה ראשונה/ }).click();

    // --- בדיקת מימד: חמישה צעדים, הקשה אחת בכל שאלה ---
    const startedAt = Date.now();
    await expect(page.getByRole('heading', { level: 1, name: 'נשימה' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await shot(page, '04-breath');
    await page.getByRole('button', { name: 'בחזה' }).click();
    await page.getByRole('button', { name: 'עצורה' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'כיווץ' })).toBeVisible();
    await page.getByRole('slider').fill('8');
    await page.getByRole('button', { name: 'כתפיים' }).click();
    await shot(page, '05-contraction');
    await page.getByRole('button', { name: 'המשך' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'מחשבה אחרונה' })).toBeVisible();
    await shot(page, '06-thought');
    await page.getByRole('button', { name: 'מי אשם' }).click();
    await page.getByRole('button', { name: /הרגישה כמו עובדה/ }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'טון רגשי' })).toBeVisible();
    await shot(page, '07-emotion');
    await page.getByRole('button', { name: 'כעס' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'זמן' })).toBeVisible();
    await page.getByRole('button', { name: 'בעתיד' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'באיזה תחום חיים זה קרה?' })).toBeVisible();
    await page.getByRole('button', { name: 'עבודה' }).click();
    await page.getByRole('button', { name: 'צוות' }).click();
    await shot(page, '08-context');
    await page.getByRole('button', { name: 'לתוצאה' }).click();

    // --- תוצאה מוסברת ---
    await expect(page.getByRole('heading', { level: 1, name: '3D עכשיו' })).toBeVisible();
    const elapsedSec = (Date.now() - startedAt) / 1000;
    expect(elapsedSec, 'בדיקה מלאה בפחות מ-75 שניות').toBeLessThan(75);
    await expect(page.getByText('הגוף הצביע על 3D')).toBeVisible();
    await expect(page.getByRole('button', { name: 'לעבור מכאן' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await shot(page, '09-result');

    await page.getByRole('button', { name: 'רק לרשום' }).click();

    // --- היום ---
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { level: 2, name: 'עוגני היום' })).toBeVisible();
    await expect(page.getByText('עוד 11 בדיקות, ותופיע כאן מפת החום שלך.')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await shot(page, '10-today');
  });

  test('בדיקה שנעצרה באמצע נמשכת מאותו מקום אחרי רענון', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('button', { name: 'בבטן' }).click();
    await page.getByRole('button', { name: 'זורמת' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'כיווץ' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'כיווץ' })).toBeVisible();
    await page.getByRole('button', { name: 'חזרה' }).click();
    await expect(page.getByRole('button', { name: 'בבטן' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('רישום מהיר: תחום + הקשה על גליף, והילת הרקע מקבלת את צבע המצב', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'דלג' }).click();
    await expect(page).toHaveURL(/#\/$/);

    await page.getByRole('button', { name: 'רישום מהיר' }).click();
    const sheet = page.getByRole('dialog', { name: 'רישום מהיר' });
    await sheet.getByRole('button', { name: 'יצירה' }).click();
    await shot(page, '11-quick');
    await sheet.getByRole('button', { name: '5D' }).click();

    await expect(sheet).toBeHidden();
    await expect(page.getByText('נרשם: 5D')).toBeVisible();
    await expect(page.locator('.aurora')).toHaveAttribute('data-dim', 'd5');
  });

  test('מצב בהיר ו-reduced motion: המסכים נשארים שמישים', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await completeOnboarding(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'בבטן' }).click();
    await page.getByRole('button', { name: 'זורמת' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'כיווץ' })).toBeVisible();
    await expectAccessible(page);
    await shot(page, '12-light-contraction');
  });
});
