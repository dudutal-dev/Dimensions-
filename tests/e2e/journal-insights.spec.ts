import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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

test.describe('יומן ותובנות', () => {
  test('בלי נתונים: מצבים ריקים שמסבירים מה ימלא אותם', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/#/insights');
    await expect(page.getByRole('heading', { level: 1, name: 'תובנות' })).toBeVisible();
    await expect(page.getByText('עוד 12 בדיקות')).toBeVisible();
    await expect(page.getByText(/יומן הערב ימלא את זה/)).toBeVisible();
    await expect(page.getByText(/אחרי שתי מדידות לכלי/)).toBeVisible();
    await expect(page.getByText('ייתכן שזה הדפוס שלך')).toBeHidden();
    await expectAccessible(page);
    await shot(page, '60-insights-empty');

    await page.goto('/#/journal');
    await expect(page.getByRole('heading', { level: 1, name: 'יומן' })).toBeVisible();
    await expect(page.getByText('מה שתכתוב בתרגילים האלה יישמר כאן.')).toBeVisible();
    await expect(page.getByText(/כשיהיה כאן מספיק טקסט/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'יומן טריגרים' })).toHaveAttribute('href', /#\/session\/t5/);
    await expectAccessible(page);
    await shot(page, '61-journal-empty');
  });

  test('יומן ערב: "היום" מזמין בערב, האירוע נשמר אוטומטית, שורד רענון, ומזין את זמן ההתאוששות', async ({ page }) => {
    test.slow();
    // 21:40 — אין עוגן שממתין, ולכן המשימה הבאה היא יומן הערב
    await page.clock.install({ time: new Date('2026-09-21T21:40:00') });
    await skipOnboarding(page);
    await expect(page.getByRole('heading', { level: 2, name: 'יומן ערב' })).toBeVisible();
    await page.getByRole('button', { name: 'לרשום את היום' }).click();
    await expect(page).toHaveURL(/#\/journal\/evening$/);

    await page.getByLabel('מה קרה?').fill('הישיבה התארכה ואני חייב להספיק הכול');
    await page.getByLabel('מה הרגשתי בגוף?').fill('לחץ בחזה');
    await expect(page.getByText(/האירוע יירשם כש/)).toBeVisible();
    await page.getByLabel('זמן עד איזון').fill('הרבה');
    await expect(page.getByRole('alert').filter({ hasText: 'כאן נכנס מספר' })).toBeVisible();
    await page.getByLabel('זמן עד איזון').fill('2');
    await expect(page.getByRole('alert').filter({ hasText: 'כאן נכנס מספר' })).toBeHidden();
    await page.getByRole('radio', { name: 'שעות' }).click();
    await page.getByRole('button', { name: 'אירוע 1: 3D' }).click();
    await expect(page.getByText('האירוע רשום ביומן.')).toBeVisible();
    await expect(page.getByText('נשמר').first()).toBeVisible();
    await expectAccessible(page);
    await shot(page, '62-evening');

    // אירוע שני נשאר טיוטה עד שיש בו סיווג וזמן
    await page.getByRole('button', { name: 'עוד אירוע' }).click();
    await page.getByLabel('מה קרה?').nth(1).fill('שיחה קצרה בבית');
    await page.clock.runFor(1_000);

    await page.reload();
    await expect(page.getByLabel('מה קרה?').first()).toHaveValue('הישיבה התארכה ואני חייב להספיק הכול');
    await expect(page.getByLabel('זמן עד איזון').first()).toHaveValue('2');
    await expect(page.getByRole('radio', { name: 'שעות' }).first()).toBeChecked();
    await expect(page.getByLabel('מה קרה?').nth(1)).toHaveValue('שיחה קצרה בבית');

    await page.getByRole('button', { name: 'סיימתי להיום' }).click();
    await expect(page).toHaveURL(/#\/journal$/);
    await expect(page.getByText('רשום אירוע אחד מהיום.')).toBeVisible();
    await expect(page.getByRole('link', { name: /התאוששות ממוצעת: 2 שעות/ })).toBeVisible();

    // "היום" כבר לא מזמין ליומן, והתובנות מציגות את זמן ההתאוששות
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 2, name: 'באיזה מימד אני עכשיו?' })).toBeVisible();
    await page.goto('/#/insights');
    await expect(page.getByRole('img', { name: /זמן התאוששות ממוצע לפי שבוע.*2 שעות/ })).toBeVisible();
  });

  test('כתיבה מודרכת נשמרת ביומן, נפתחת לקריאה, ואפשר למחוק אותה', async ({ page }) => {
    test.slow();
    await page.clock.install();
    await skipOnboarding(page);
    await page.goto('/#/journal');
    await page.getByRole('link', { name: 'יומן טריגרים' }).click();
    await page.getByRole('button', { name: 'התחל' }).click();
    await page.clock.runFor(10_000);
    await page.getByLabel('האירוע').fill('ישיבת תקציב שהתארכה');
    for (const label of ['תחושת הגוף', 'הסיפור שסיפרתי', 'בן כמה הרגשתי', 'מה הייתי צריך באמת']) {
      await page.getByRole('button', { name: 'הבא' }).click();
      await page.getByLabel(label).fill(label === 'הסיפור שסיפרתי' ? 'תמיד זה קורה לי, אין לי ברירה' : 'כך וכך');
    }
    await page.getByRole('button', { name: 'הבא' }).click();
    await page.clock.runFor(10_000);
    await page.getByRole('button', { name: 'סיום' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeHidden();

    await page.goto('/#/journal');
    const saved = page.getByRole('link', { name: /יומן טריגרים.*ישיבת תקציב שהתארכה/ });
    await expect(saved).toBeVisible();
    await saved.click();
    await expect(page).toHaveURL(/#\/journal\/form\//);
    await expect(page.getByRole('heading', { level: 1, name: 'יומן טריגרים' })).toBeVisible();
    await expect(page.getByText('תמיד זה קורה לי, אין לי ברירה')).toBeVisible();
    await expectAccessible(page);
    await shot(page, '63-form-view');

    await page.getByRole('button', { name: 'מחיקת הרשומה' }).click();
    await page.getByRole('button', { name: 'מחק', exact: true }).click();
    await expect(page).toHaveURL(/#\/journal$/);
    await expect(page.getByText('מה שתכתוב בתרגילים האלה יישמר כאן.')).toBeVisible();
  });

  test('נתוני דמה: מפת חום, גרפים, "מה עובד לי", מפת תחומים ודפוס אישי — ואז מחיקה נקייה', async ({ page }) => {
    test.slow();
    await page.clock.install({ time: new Date('2026-09-21T10:00:00') }); // תאריך קבוע — אותם נתוני דמה בכל הרצה
    await skipOnboarding(page);
    await page.goto('/#/design');
    await page.getByRole('button', { name: 'לטעון נתוני דמה' }).click();
    await expect(page.getByText('נתוני הדמה נטענו')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: 'לתובנות' }).click();

    // מפת החום: 7 ימים × 4 חלקי יום, משבצת נפתחת לפירוט
    const heat = page.getByRole('table', { name: 'המצב השכיח לפי יום בשבוע וחלק ביום' });
    await expect(heat).toBeVisible();
    await expect(heat.getByRole('button')).toHaveCount(28);
    const cell = heat.getByRole('button', { name: /^יום שני בוקר: בעיקר/ });
    await cell.click();
    await expect(cell).toHaveAttribute('aria-pressed', 'true');
    // הפירוט מסתכם למספר שעל המשבצת
    const total = Number((await cell.getAttribute('aria-label'))?.match(/, (\d+) בדיקות/)?.[1]);
    const detail = await page.getByText(/^יום שני, בוקר · 3D: \d+ · 4D: \d+ · 5D: \d+$/).innerText();
    expect((detail.match(/: \d+/g) ?? []).reduce((sum, part) => sum + Number(part.slice(2)), 0)).toBe(total);

    // סינון לפי תחום: בזוגיות הערב הוא 3D
    await page.getByRole('group', { name: 'סינון לפי תחום' }).getByRole('button', { name: 'זוגיות' }).click();
    await expect(heat.getByRole('button', { name: /^יום שני ערב: בעיקר 3D/ })).toBeVisible();
    await expect(page.getByText('הקש על משבצת כדי לראות את הפירוט.')).toBeVisible(); // במשבצת שנבחרה אין בדיקות בזוגיות
    await expect(heat.getByRole('button', { name: 'יום שני בוקר: אין בדיקות' })).toBeDisabled();
    await page.getByRole('group', { name: 'סינון לפי תחום' }).getByRole('button', { name: 'הכול' }).click();

    await expect(page.getByRole('img', { name: /זמן התאוששות ממוצע לפי שבוע/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /אחוז הבדיקות במצב 5D לפי שבוע/ })).toBeVisible();
    const working = page.getByRole('region', { name: 'מה עובד לי' });
    await expect(working.getByRole('listitem')).toHaveCount(3);
    await expect(working.getByRole('listitem').first()).toContainText('מדרגות בממוצע');
    await expect(page.getByRole('heading', { level: 2, name: '״מקצוען-על״' })).toBeVisible();
    await expect(page.getByText('זו השערה, לא אבחנה.', { exact: false })).toBeVisible();
    await expectAccessible(page);
    await shot(page, '64-insights-demo');

    // הגרף נגיש גם כטבלה
    await page.getByText('הצג כטבלה').first().click();
    await expect(page.getByRole('region', { name: 'זמן התאוששות' }).getByRole('row')).not.toHaveCount(0);

    // ערוץ השפה ביומן
    await page.goto('/#/journal');
    await expect(page.getByRole('heading', { level: 2, name: 'ערבים קודמים' })).toBeVisible();
    const language = page.getByRole('region', { name: 'ערוץ השפה' });
    await expect(language.getByText('סמני 3D')).toBeVisible();
    await expect(language.getByText('סמני 5D')).toBeVisible();
    await expectAccessible(page);
    await shot(page, '65-journal-demo');

    // מחיקת נתוני הדמה מחזירה את המצב הריק
    await page.goto('/#/design');
    await page.getByRole('button', { name: 'למחוק את נתוני הדמה' }).click();
    await expect(page.getByRole('button', { name: 'לטעון נתוני דמה' })).toBeVisible({ timeout: 30_000 });
    await page.goto('/#/insights');
    await expect(page.getByText('עוד 12 בדיקות')).toBeVisible();
  });
});
