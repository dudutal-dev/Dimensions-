import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png` });

async function skipOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

/** מריץ את הכלי עד הסוף (בשעון מדומה), מסמן לפני/אחרי, ושומר. */
async function runSession(page: Page, durationSec: number, before: string | null, after: string) {
  await page.getByRole('button', { name: 'התחל' }).click();
  await page.clock.runFor((durationSec + 3) * 1000);
  await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeVisible();
  if (before) await page.getByRole('button', { name: `איפה הייתי לפני: ${before}` }).click();
  await page.getByRole('button', { name: `איפה אני עכשיו: ${after}` }).click();
  await page.getByRole('button', { name: 'סיום' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeHidden();
}

test.describe('מעבר — ארגז הכלים', () => {
  test('שלוש כניסות: מאיפה אני בא, לפי טריגר, לפי תחום', async ({ page }) => {
    await skipOnboarding(page);
    await page.getByRole('navigation', { name: 'ניווט ראשי' }).first().getByRole('link', { name: 'מעבר' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'מעבר' })).toBeVisible();

    // מאיפה אני בא: 6 כלים ל-3D, 7 ל-4D, 6 קיצורי דרך, ו"נפלתי"
    await expect(page.getByRole('link', { name: /^התחל:/ })).toHaveCount(6);
    await expect(page.getByText('אפשר להתחיל מכאן')).toBeVisible();
    await shot(page, '30-shift-from');
    await page.getByRole('button', { name: 'אני ב-4D' }).click();
    await expect(page.getByRole('link', { name: /^התחל:/ })).toHaveCount(7);
    await expect(page.getByRole('heading', { level: 3, name: 'ירידה מהראש ללב' })).toBeVisible();
    await page.getByRole('button', { name: 'קיצורי דרך' }).click();
    await expect(page.getByRole('link', { name: /^התחל:/ })).toHaveCount(6);
    await page.getByRole('button', { name: 'נפלתי', exact: true }).click();
    await expect(page.getByRole('link', { name: /^התחל:/ })).toHaveCount(1);

    // לפי טריגר
    await page.getByRole('radio', { name: 'לפי טריגר' }).click();
    await page.getByRole('button', { name: 'ביקורת' }).click();
    await expect(page.getByText('הגנה, או התקפה')).toBeVisible();
    await expect(page.getByRole('link', { name: 'התחל: ביקורת' })).toBeVisible();
    await shot(page, '31-shift-trigger');

    // לפי תחום
    await page.getByRole('radio', { name: 'לפי תחום' }).click();
    await page.getByRole('button', { name: 'כסף' }).click();
    await expect(page.getByText('זה תחום ה-3D העיקש ביותר — הישרדות.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'התחל: חקירת אמונות' })).toBeVisible();
    await shot(page, '32-shift-domain');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('deep link לכלי נפתח ישר במסך הפתיחה של הנגן', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/#/shift/heart-drop');
    await expect(page).toHaveURL(/#\/session\/heart-drop/);
    await expect(page.getByRole('heading', { level: 1, name: 'ירידה מהראש ללב' })).toBeVisible();
  });

  test('מתוצאת בדיקה: "לעבור מכאן" מוביל לכלים של 3D, וה"לפני" כבר ידוע', async ({ page }) => {
    await page.clock.install();
    await skipOnboarding(page);
    await page.goto('/#/checkin');
    await page.getByRole('button', { name: 'בחזה' }).click();
    await page.getByRole('button', { name: 'עצורה' }).click();
    await page.getByRole('slider').fill('9');
    await page.getByRole('button', { name: 'המשך' }).click();
    await page.getByRole('button', { name: 'מי אשם' }).click();
    await page.getByRole('button', { name: /הרגישה כמו עובדה/ }).click();
    await page.getByRole('button', { name: 'כעס' }).click();
    await page.getByRole('button', { name: 'בעתיד' }).click();
    await page.getByRole('button', { name: 'עבודה' }).click();
    await page.getByRole('button', { name: 'לתוצאה' }).click();
    await page.getByRole('button', { name: 'לעבור מכאן' }).click();

    await expect(page).toHaveURL(/#\/shift\?from=from-3d&before=d3/);
    await expect(page.getByRole('button', { name: 'אני ב-3D' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('link', { name: 'התחל: שאלת המתבונן' }).click();
    await page.getByRole('button', { name: 'התחל' }).click();
    await page.clock.runFor(48_000);
    await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeVisible();
    // המצב "לפני" הגיע מהבדיקה — שואלים רק על "עכשיו"
    await expect(page.getByRole('group', { name: 'איפה הייתי לפני' })).toBeHidden();
    await expect(page.getByRole('group', { name: 'איפה אני עכשיו' })).toBeVisible();
  });

  test('המלצה חכמה: אחרי שכלי עבד פעמיים באותו טריגר, הוא מוצע ראשון', async ({ page }) => {
    test.slow();
    await page.clock.install();
    await skipOnboarding(page);
    await page.goto('/#/shift?by=trigger&trigger=trg-criticism');
    await expect(page.getByText('אפשר להתחיל מכאן')).toBeVisible();

    for (let round = 0; round < 2; round++) {
      await page.getByRole('link', { name: 'התחל: תיוג' }).click();
      await runSession(page, 67, '3D', '5D');
      await expect(page.getByRole('heading', { level: 1, name: 'מעבר' })).toBeVisible();
    }

    await expect(page.getByText('מה שעבד לך כאן')).toBeVisible();
    const card = page.locator('div', { has: page.getByText('מה שעבד לך כאן') }).last();
    await expect(card.getByRole('heading', { level: 2, name: 'תיוג' })).toBeVisible();
    await expect(page.getByText(/שיפור ממוצע של .?\+2.? מדרגות ב-2 תרגולים/)).toBeVisible();
    await expect(page.getByText(/אצלך: .?\+2.? מדרגות בממוצע · 2 תרגולים/)).toBeVisible();
    await shot(page, '33-shift-recommendation');

    // בטריגר אחר אין עדיין היסטוריה משלו — ההמלצה נשענת על מה שעבד בכלל
    await page.getByRole('button', { name: 'השוואה' }).click();
    await expect(page.getByText('אפשר להתחיל מכאן')).toBeVisible();
    await page.getByRole('button', { name: 'אי-צדק' }).click();
    await expect(page.getByText('מה שעבד לך עד עכשיו')).toBeVisible();
  });
});
