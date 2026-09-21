import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png` });
const START = new Date('2026-09-01T09:00:00');
const DAY = 24 * 3_600_000;

async function startJourney(page: Page, time: Date = START) {
  await page.clock.install({ time });
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג' }).click();
  await expect(page).toHaveURL(/#\/$/); // ממתינים שההיכרות תיסגר לפני שממשיכים
  await page.goto('/#/journey');
  await page.getByRole('button', { name: 'מתחילים — שבוע 0' }).click();
  await expect(page).toHaveURL(/#\/journey\/w00$/);
}

async function makeCurrent(page: Page, week: number) {
  await page.goto(`/#/journey/w${String(week).padStart(2, '0')}`);
  await page.getByRole('button', { name: `לקבוע את שבוע ${week} כשבוע הנוכחי` }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'היום', exact: true })).toBeVisible();
}

test.describe('המסע', () => {
  test('שבוע 0 → שבוע 1: מדדי בסיס, תרגול יומי, סימון היום, ו"היום" מציע את התרגול', async ({ page }) => {
    test.slow();
    // 17:00 — אין עוגן שממתין, ולכן המשימה הבאה ב"היום" היא תרגול היום
    await startJourney(page, new Date('2026-09-01T17:00:00'));
    await expect(page.getByRole('heading', { level: 1, name: 'שבוע 0 — מדידת בסיס' })).toBeVisible();
    await page.getByLabel('דקות שקט ביום (דקות)').fill('7.5');
    await expect(page.getByText('נשמר').first()).toBeVisible();
    await shot(page, '50-week0');
    const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(a11y.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);

    await page.getByRole('button', { name: 'מתחילים את שבוע 1' }).click();
    await expect(page).toHaveURL(/#\/journey\/w01$/);
    await expect(page.getByRole('heading', { level: 1, name: 'שבוע 1' })).toBeVisible();
    await expect(page.getByRole('link', { name: /נשימה קוהרנטית/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /סריקת גוף/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'היגיינת שינה' })).toBeVisible();

    // "היום" מציע את תרגול היום — עד שסומן
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 2, name: 'תרגול היום' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'המסע · שבוע 1' })).toContainText('משימת החיים: היגיינת שינה');
    await page.getByRole('button', { name: 'לתרגול' }).click();
    await expect(page).toHaveURL(/#\/journey\/w01$/);

    await page.getByRole('button', { name: 'תרגלתי היום' }).click();
    await expect(page.getByRole('listitem', { name: 'יום 1: תרגלתי (היום)' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'יום 2: עוד לא הגיע' })).toBeVisible();
    await shot(page, '51-week1');

    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 2, name: 'באיזה מימד אני עכשיו?' })).toBeVisible();

    // המדד נשמר
    await page.goto('/#/journey/w00');
    await expect(page.getByLabel('דקות שקט ביום (דקות)')).toHaveValue('7.5');
  });

  test("מעבר שלב: צ'קליסט רך, אזהרת השלב הסוער בשבוע 4, ונקודת בדיקה", async ({ page }) => {
    await startJourney(page);
    await makeCurrent(page, 3);
    await expect(page.getByText('מוכן להמשיך?')).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(3);
    await page.getByRole('checkbox', { name: /אני ישן סביר/ }).check();
    await shot(page, '52-criteria');

    // ממשיכים גם בלי לסמן הכול — אין נעילה
    await page.getByRole('button', { name: 'ממשיכים לשבוע 4' }).click();
    await expect(page).toHaveURL(/#\/journey\/w04$/);
    await expect(page.getByText('זה השלב הסוער.')).toHaveCount(1); // האזהרה מופיעה פעם אחת, בכרטיס משלה
    await expect(page.getByText('נקודת בדיקה', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'לאבחון חוזר' })).toBeVisible();
    await shot(page, '53-week4');

    // הסימון נשמר
    await page.goto('/#/journey/w03');
    await expect(page.getByRole('button', { name: 'לקבוע את שבוע 3 כשבוע הנוכחי' })).toBeVisible();

    await page.goto('/#/journey');
    await expect(page.getByRole('link', { name: /שבוע 4:/ })).toHaveAttribute('aria-current', 'step');
    await shot(page, '54-path');
  });

  test('"להישאר עוד שבוע" אינו כישלון; ויום שלא סומן נשאר ריק', async ({ page }) => {
    await startJourney(page);
    await makeCurrent(page, 2);
    await page.clock.fastForward(3 * DAY);
    await page.reload();
    await expect(page.getByRole('listitem', { name: 'יום 1: ריק' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'יום 4: ריק (היום)' })).toBeVisible();

    await page.getByRole('button', { name: 'להישאר עוד שבוע' }).click();
    await expect(page.getByText('אפשר להישאר כאן עוד שבוע. זו לא נסיגה — זו העמקה.')).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'יום 1: ריק (היום)' })).toBeVisible();
  });

  test('חזרה מהפסקה: "טוב שחזרת", ושלושה ימים של ת1–ת3', async ({ page }) => {
    await startJourney(page);
    await makeCurrent(page, 6);
    await page.clock.fastForward(5 * DAY); // חמישה ימים בלי תרגול
    await page.goto('/#/journey');
    await page.reload();

    await expect(page.getByRole('heading', { level: 2, name: 'טוב שחזרת.' })).toBeVisible();
    await shot(page, '55-welcome-back');
    await page.getByRole('button', { name: 'מתחילים בעדינות' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'טוב שחזרת.' })).toBeHidden();

    await page.getByRole('button', { name: 'לשבוע שלי' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'ימי חזרה · יום 1 מתוך 3' })).toBeVisible();
    const practices = page.getByRole('region', { name: /ימי חזרה/ }).getByRole('link');
    await expect(practices).toHaveCount(3);
    await expect(practices.first()).toContainText('נשימה קוהרנטית');

    await page.clock.fastForward(3 * DAY); // אחרי שלושה ימים — חזרה לתרגולי השבוע
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'התרגול היומי' })).toBeVisible();
    await expect(page.getByRole('link', { name: /עבודת צל/ })).toBeVisible();
  });

  test('תרגול שהושלם בנגן מסמן את היום; סיום שבוע 12 מעביר לתחזוקה — בלי מסך "הגעת"', async ({ page }) => {
    test.slow();
    await startJourney(page);
    await makeCurrent(page, 3);
    await page.getByRole('link', { name: /עצירה/ }).click();
    await page.getByRole('button', { name: 'התחל' }).click();
    await page.clock.runFor(63_000);
    await expect(page.getByRole('heading', { level: 1, name: 'מה השתנה?' })).toBeVisible();
    await page.getByRole('button', { name: 'סיום' }).click();
    await expect(page.getByRole('listitem', { name: 'יום 1: תרגלתי (היום)' })).toBeVisible();

    await makeCurrent(page, 12);
    await expect(page.getByText(/תרגול חופשי משולב/)).toBeVisible(); // טווח המספרים עטוף בתווי בידוד LTR
    await page.getByRole('button', { name: 'סיימתי את התכנית — לתחזוקה' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'תחזוקה — אחרי 12 השבועות' })).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/הגעת|כל הכבוד|ניקוד/);
    await shot(page, '56-maintenance');
  });
});
