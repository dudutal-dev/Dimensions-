import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png` });

async function skipOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

async function countOnBackupPage(page: Page, label: string): Promise<string> {
  await page.goto('/#/backup');
  const row = page.locator('dl > div', { hasText: label });
  await expect(row.locator('dd')).not.toHaveText('…');
  return (await row.locator('dd').innerText()).trim();
}

test.describe('נגן התרגולים', () => {
  test('90 שניות: מתחיל מיד מהכפתור הצף, רץ 90 שניות בדיוק, ונרשם', async ({ page }) => {
    await page.clock.install();
    await skipOnboarding(page);

    await page.getByRole('link', { name: /90 שניות/ }).click();
    await expect(page).toHaveURL(/#\/sos$/);
    await expect(page.getByText('תן לזה שם, במילה אחת. למשל: כיווץ. פחד.')).toBeVisible();
    await expect(page.getByLabel('הזמן שנותר')).toHaveText(/01:(30|29)/);
    await shot(page, '20-sos-start');

    await page.clock.runFor(17_000); // שם (10) + גוף (6) → נשימה
    await expect(page.getByText(/שאיפה|נשיפה/).first()).toBeVisible();
    await shot(page, '21-sos-breath');

    // השעון המדומה ממשיך לזוז גם בזמן אמת, לכן משאירים מרווח של כמה שניות.
    await page.clock.runFor(65_000);
    await expect(page.getByText('מה הצעד הקטן הבא, מהמקום הזה?')).toBeVisible();
    await page.clock.runFor(10_000);

    await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeVisible();
    await page.getByRole('button', { name: 'איפה הייתי לפני: 3D' }).click();
    await page.getByRole('button', { name: 'איפה אני עכשיו: 4D' }).click();
    await shot(page, '22-sos-finish');
    await page.getByRole('button', { name: 'סיום' }).click();

    await expect(page).toHaveURL(/#\/$/);
    expect(await countOnBackupPage(page, 'תרגולים')).toBe('1');
  });

  test('תרגיל מתוזמן: מסך פתיחה, השהיה והמשך, דילוג בין מקטעים', async ({ page }) => {
    await page.clock.install();
    await skipOnboarding(page);
    await page.getByRole('link', { name: 'כל התרגולים' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'תרגולים' })).toBeVisible();
    await shot(page, '23-practice-list');

    await page.getByRole('link', { name: /עצירה/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'עצירה' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await shot(page, '24-prestart');

    await page.getByRole('button', { name: 'התחל' }).click();
    await expect(page.getByText('עצור.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'השהה' }).click();
    await expect(page.getByText('מושהה')).toBeVisible();
    await page.clock.runFor(30_000);
    await expect(page.getByText('עצור.', { exact: true })).toBeVisible(); // הזמן עמד

    await page.getByRole('button', { name: 'המשך' }).click();
    await page.getByRole('button', { name: 'המקטע הבא' }).click();
    await expect(page.getByText('נשימה אחת, מלאה ואיטית.')).toBeVisible();
    await page.getByRole('button', { name: 'המקטע הקודם' }).click();
    await expect(page.getByText('עצור.', { exact: true })).toBeVisible();
  });

  test('עיניים עצומות: מסך כהה, והקשה בכל מקום משהה', async ({ page }) => {
    await page.clock.install();
    await skipOnboarding(page);
    await page.goto('/#/session/t1');
    await page.getByRole('button', { name: 'עיניים עצומות' }).click();
    await page.getByRole('button', { name: 'התחל' }).click();

    const dark = page.getByRole('button', { name: 'השהה' });
    await expect(dark).toBeVisible();
    await expect(page.getByText('שב בנוחות.')).toBeHidden();
    await shot(page, '25-eyes-closed');

    await dark.click();
    await expect(page.getByText('מושהה')).toBeVisible();
    await expect(page.getByRole('button', { name: 'המשך' })).toBeVisible();

    // ההעדפה נשמרת לתרגול הבא
    await page.goto('/#/session/t2');
    await expect(page.getByRole('button', { name: 'עיניים עצומות' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('כתיבה מודרכת: השאלות ממתינות, הטקסט נשמר אוטומטית, והטופס נרשם בסיום', async ({ page }) => {
    test.slow();
    await page.clock.install();
    await skipOnboarding(page);
    await page.goto('/#/session/t5');
    await page.getByRole('button', { name: 'התחל' }).click();
    await page.clock.runFor(10_000); // הפתיח
    await expect(page.getByText('מה קרה? תאר את האירוע בקצרה. רק עובדות.')).toBeVisible();

    await page.clock.runFor(180_000); // השאלה "נמשכת" 60 שניות, אבל ממתינה — הזמן לא מקדם אותה
    await expect(page.getByLabel('האירוע')).toBeVisible();
    await page.getByLabel('האירוע').fill('ישיבת תקציב שהתארכה');
    await shot(page, '26-form');

    // רענון באמצע — הטיוטה נשמרה
    await page.clock.runFor(1_000);
    await page.reload();
    await page.getByRole('button', { name: 'התחל' }).click();
    await page.clock.runFor(10_000);
    await expect(page.getByLabel('האירוע')).toHaveValue('ישיבת תקציב שהתארכה');

    for (const label of ['תחושת הגוף', 'הסיפור שסיפרתי', 'בן כמה הרגשתי', 'מה הייתי צריך באמת']) {
      await page.getByRole('button', { name: 'הבא' }).click();
      await page.getByLabel(label).fill('…');
    }
    await page.getByRole('button', { name: 'הבא' }).click();
    await page.clock.runFor(10_000); // משפט הסיום
    await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeVisible();
    await page.getByRole('button', { name: 'סיום' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeHidden(); // השמירה הסתיימה והנגן נסגר

    expect(await countOnBackupPage(page, 'טפסים מודרכים')).toBe('1');
  });
});
