import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true });

async function skipOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

async function expectAccessible(page: Page) {
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')} — ${v.nodes[0]?.any[0]?.message ?? ''}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test.describe('ספרייה', () => {
  test('פרקים, חיפוש חופשי שמגיע גם לטבלאות, וחזרה מהמאמר לתוצאות', async ({ page }) => {
    test.slow();
    await skipOnboarding(page);
    await page.goto('/#/library');
    await expect(page.getByRole('heading', { level: 1, name: 'ספרייה' })).toBeVisible();
    for (const section of ['המודל', 'זיהוי', 'מעבר וייצוב', 'נספח: פיזיקה', 'להעמקה']) {
      await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /תרגולים מתקדמים.*נפתח אחרי השלמת 12 השבועות/ })).toBeVisible();
    await expectAccessible(page);
    await shot(page, '70-library');

    // "ריצוי" מופיע רק בתוך טבלת זיוף 5D — תוכן שמגיע מקובץ אחר
    await page.getByRole('searchbox', { name: 'חיפוש בספרייה' }).fill('ריצוי');
    await expect(page.getByText('תוצאה אחת')).toBeVisible();
    await expect(page).toHaveURL(/#\/library\?q=/);
    await shot(page, '71-library-search');
    await page.getByRole('link', { name: /זיוף 5D/ }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'זיוף 5D — מצבים מטעים' })).toBeVisible();
    await expect(page.getByText('נראה כמו').first()).toBeVisible();
    await expect(page.getByText('איך מבחינים').first()).toBeVisible();
    await expectAccessible(page);
    await shot(page, '72-fake5d');

    await page.getByRole('button', { name: 'חזרה לתוצאות החיפוש' }).click();
    await expect(page.getByRole('searchbox', { name: 'חיפוש בספרייה' })).toHaveValue('ריצוי');
    await expect(page.getByText('תוצאה אחת')).toBeVisible();

    await page.getByRole('searchbox', { name: 'חיפוש בספרייה' }).fill('קפה הפוך');
    await expect(page.getByText('לא נמצאו תוצאות')).toBeVisible();
    await page.getByRole('button', { name: 'ניקוי החיפוש' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'המודל', exact: true })).toBeVisible();
  });

  test('נספח הפיזיקה מסומן ברובד, שלושת המצבים מוצגים זה מול זה, ופרק נעול נשאר נעול', async ({ page }) => {
    test.slow();
    await skipOnboarding(page);
    await page.goto('/#/library/physics-quantum-myths');
    await expect(page.getByRole('heading', { level: 1, name: 'מיתוסים קוונטיים — ותיקונם' })).toBeVisible();
    await expect(page.getByText('מבוסס', { exact: true }).first()).toBeVisible();
    await expectAccessible(page);
    await shot(page, '73-physics');

    await page.goto('/#/library/comparison-table');
    await expect(page.getByRole('heading', { level: 3, name: 'שאלת היסוד' })).toBeVisible();
    await expect(page.getByText('איך אשרוד / אנצח?')).toBeVisible();
    await expectAccessible(page);
    await shot(page, '74-comparison');

    await page.goto('/#/library/advanced-practices');
    await expect(page.getByText('נפתח אחרי השלמת 12 השבועות.')).toBeVisible();
    await page.getByRole('button', { name: 'למסע' }).click();
    await expect(page).toHaveURL(/#\/journey$/);

    await page.goto('/#/library/no-such-article');
    await expect(page.getByText('לא מצאתי את המאמר הזה')).toBeVisible();
  });

  test('תוצאת בדיקה של 5D מפנה ל"זיוף 5D"', async ({ page }) => {
    test.slow();
    await skipOnboarding(page);
    await page.goto('/#/checkin');
    await page.getByRole('button', { name: 'בבטן' }).click();
    await page.getByRole('button', { name: 'זורמת' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'כיווץ' })).toBeVisible();
    await page.getByRole('slider').fill('1');
    await page.getByRole('button', { name: 'המשך' }).click();
    await page.getByRole('button', { name: 'שקט, כמעט בלי מחשבות' }).click();
    await page.getByRole('button', { name: 'היא כבר חלפה' }).click();
    await page.getByRole('button', { name: 'שלווה' }).click();
    await page.getByRole('button', { name: 'כאן', exact: true }).click();
    await page.getByRole('button', { name: 'לבד', exact: true }).first().click();
    await page.getByRole('button', { name: 'לתוצאה' }).click();

    await expect(page.getByRole('heading', { level: 1, name: '5D עכשיו' })).toBeVisible();
    await page.getByRole('link', { name: /זיוף 5D/ }).click();
    await expect(page).toHaveURL(/#\/library\/fake-5d$/);
    await expect(page.getByRole('heading', { level: 1, name: 'זיוף 5D — מצבים מטעים' })).toBeVisible();
  });
});

test.describe('עזרה והגדרות', () => {
  test('"צריך עזרה?": סימנים, מה עושים, וחיוג ישיר לער"ן', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/#/settings');
    await page.getByRole('link', { name: /צריך עזרה\?/ }).last().click();
    await expect(page).toHaveURL(/#\/help$/);
    await expect(page.getByRole('heading', { level: 1, name: 'צריך עזרה?' })).toBeVisible();
    await expect(page.getByText('תרגול בריא מגביר תפקוד, חום וקשר עם אנשים.', { exact: false })).toBeVisible();
    await expect(page.getByText('מחשבות על פגיעה עצמית.')).toBeVisible();
    await expect(page.getByRole('link', { name: /חיוג\s*1201/ })).toHaveAttribute('href', 'tel:1201');
    await expectAccessible(page);
    await shot(page, '75-help');
  });

  test('הגדרות נשמרות מיד: ערכת צבע, גודל טקסט, מתגים, שעת עוגן ותחום מוקד', async ({ page }) => {
    test.slow();
    await skipOnboarding(page);
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'הגדרות' })).toBeVisible();
    await expectAccessible(page);
    await shot(page, '76-settings');

    await page.getByRole('radio', { name: 'בהיר' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('radio', { name: 'גדול', exact: true }).click();
    await page.getByRole('switch', { name: /רטט עדין/ }).click();
    await expect(page.getByRole('switch', { name: /רטט עדין/ })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('switch', { name: /עיניים עצומות/ }).click();
    await page.getByLabel('התעוררות', { exact: true }).fill('06:15');
    await expect(page.getByRole('button', { name: 'חזרה לשעות ברירת המחדל' })).toBeVisible();
    await page.getByRole('group', { name: 'תחום מוקד' }).getByRole('button', { name: 'זוגיות' }).click();
    await page.getByLabel('שם פרטי').fill('דודו');
    await expect(page.getByText('נשמר').first()).toBeVisible();
    await expectAccessible(page); // גם בערכה הבהירה ובטקסט גדול
    await shot(page, '77-settings-light');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('radio', { name: 'גדול', exact: true })).toBeChecked();
    await expect(page.getByRole('switch', { name: /רטט עדין/ })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('switch', { name: /עיניים עצומות/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('התעוררות', { exact: true })).toHaveValue('06:15');
    await expect(page.getByRole('group', { name: 'תחום מוקד' }).getByRole('button', { name: 'זוגיות' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('שם פרטי')).toHaveValue('דודו');

    // השעה החדשה מגיעה ל"היום"
    await page.goto('/#/');
    await expect(page.getByText('06:15')).toBeVisible();
  });

  test('ייצוא העוגנים ליומן: קובץ ics עם חמישה אירועים יומיים בשעות שנקבעו', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'הגדרות' })).toBeVisible();
    await page.getByLabel('לפני שינה', { exact: true }).fill('23:05');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ייצוא העוגנים ליומן' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('dimension-compass-anchors.ics');

    const ics = await readFile(await download.path(), 'utf8');
    const unfolded = ics.split(`${String.fromCharCode(13, 10)} `).join('');
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(unfolded.match(/RRULE:FREQ=DAILY/g)).toHaveLength(5);
    expect(unfolded).toMatch(/DTSTART:[0-9]{8}T230500/);
    expect(unfolded).toContain('#/checkin');
    expect(unfolded).toContain('SUMMARY:בדיקת מימד — לפני שינה');
  });

  test('כתובת שאינה קיימת מציעה דרך חזרה', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/#/no-such-screen');
    await expect(page.getByText('לא מצאתי את המסך הזה')).toBeVisible();
    await page.getByRole('button', { name: 'למסך היום' }).click();
    await expect(page).toHaveURL(/#\/$/);
  });
});
