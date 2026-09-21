import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png` });

/** טקסט תשובת ה-3D וה-5D של כל שאלה — הסדר על המסך מעורבב, ולכן בוחרים לפי הטקסט. */
const D3 = [
  'הגוף מתכווץ, אני מחפש אשמים',
  'בעתיד או בעבר — תכנון, דאגה, שחזור',
  'פחד, כעס, חישובי אסון',
  'צביטה, השוואה',
  'מתגונן, תוקף, או נעלב לאורך זמן',
  'טועים, או מסוכנים',
  'לא אדע מי אני',
  'צריך, פרנסה, ציפיות',
  'מדחיק, מתפרץ, או בורח למסך',
  'בלתי נסבל, או בזבוז זמן',
  'שם לב אליו כשכואב',
  'למה זה קורה לי',
];
const D5 = [
  'אני פועל לפתור, בלי דרמה פנימית משמעותית',
  'לרוב במה שלפניי',
  'מטפל עניינית; הביטחון שלי לא תלוי בזה',
  'שמחה אמיתית, או אדישות נינוחה',
  'מקשיב, לוקח את מה שנכון, משחרר את השאר',
  'מעניינים אותי; לא מאיימים על זהותי',
  'אתאבל ואמשיך; זה לא מי שאני',
  'זה ביטוי טבעי שלי, ומשרת אחרים',
  'מרגיש אותו בגוף עד שחולף',
  'נעים, מזין',
  'מקור מידע שוטף שאני סומך עליו',
  'זה מה שיש עכשיו; מה נדרש?',
];

async function skipOnboarding(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'דלג' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

/** עונה על כל השאלון: 5D בכל מקום, חוץ מהשאלות שב-d3Indexes. */
async function answerAll(page: Page, d3Indexes: number[]) {
  for (let i = 0; i < 12; i++) {
    await expect(page.getByText(`שאלה ${i + 1} מתוך 12`)).toBeVisible();
    const text = d3Indexes.includes(i) ? D3[i]! : D5[i]!;
    await page.getByRole('button', { name: text, exact: true }).click();
  }
}

test.describe('אבחון מלא', () => {
  test('מה-Onboarding: שאלון → פרופיל לפי תחום → תחום מוקד', async ({ page }) => {
    test.slow();
    await page.goto('/');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'המשך' }).click();
    await page.getByRole('button', { name: /אבחון מלא/ }).click();
    await expect(page).toHaveURL(/#\/diagnosis\/self$/);
    await expect(page.getByRole('heading', { level: 1, name: 'הדפוס הדומיננטי שלי' })).toBeVisible();
    await shot(page, '40-diagnosis-intro');
    await page.getByRole('button', { name: 'התחל' }).click();

    await expect(page.getByText('שאלה 1 מתוך 12')).toBeVisible();
    await shot(page, '41-diagnosis-question');
    // המפתח אינו נחשף: אין על המסך 3D / 4D / 5D
    await expect(page.locator('main')).not.toContainText(/[345]D/);

    await answerAll(page, [2, 3]); // כסף וחומר — 3D; כל השאר 5D

    await expect(page).toHaveURL(/#\/diagnosis\/result\//);
    await expect(page.getByRole('heading', { level: 1, name: 'דומיננטיות 5D' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'בסך הכול: 3D 17%, 4D 0%, 5D 83%' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'כסף וחומר: 3D 100%, 4D 0%, 5D 0%' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'מוקד העבודה: כסף וחומר' })).toBeVisible();
    await shot(page, '42-diagnosis-result');

    const focus = page.getByRole('button', { name: /כסף וביטחון/ });
    await focus.click();
    await expect(focus).toHaveAttribute('aria-pressed', 'true');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('שאלון שנעצר באמצע נמשך מאותה שאלה, באותו סדר תשובות', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/#/diagnosis/self');
    await page.getByRole('button', { name: 'התחל' }).click();
    await page.getByRole('button', { name: D3[0]!, exact: true }).click();
    // ממתינים שאנימציית המעבר תסתיים: השאלה השנייה על המסך, ושלוש תשובות בלבד.
    const options = page.getByRole('group').getByRole('button');
    const settled = async () => {
      await expect(page.getByText('שאלה 2 מתוך 12')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'רוב היום, המחשבות שלי:' })).toBeVisible();
      await expect(options).toHaveCount(3);
    };
    await settled();
    const orderBefore = await options.allInnerTexts();

    await page.reload();
    await settled();
    expect(await options.allInnerTexts()).toEqual(orderBefore);
    await page.getByRole('button', { name: 'חזרה' }).click();
    await expect(page.getByRole('button', { name: D3[0]!, exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('שאל אדם קרוב: טקסט לשיתוף בגוף שלישי, הזנת תשובות, והשוואה', async ({ page }) => {
    test.slow();
    await skipOnboarding(page);
    await page.goto('/#/diagnosis/self');
    await page.getByRole('button', { name: 'התחל' }).click();
    await answerAll(page, []); // אני: הכול 5D
    await expect(page.getByRole('heading', { level: 1, name: 'דומיננטיות 5D' })).toBeVisible();

    await page.getByRole('link', { name: 'שאל אדם קרוב' }).click();
    await page.getByLabel('השם שלי, כפי שיופיע בשאלות').fill('דודו');
    await page.getByLabel('את מי אני שואל').fill('מיכל');
    await page.getByText('מה בדיוק נשלח').click();
    await expect(page.getByText('כשדודו מאחר, או שמשהו מתעכב:')).toBeVisible();
    await shot(page, '43-ask-other-share');

    await page.getByRole('radio', { name: /להזין תשובות/ }).click();
    for (let i = 1; i <= 12; i++) {
      await page.getByRole('radiogroup', { name: `התשובה לשאלה ${i}`, exact: true }).getByRole('radio', { name: 'א' }).click();
    }
    await shot(page, '44-ask-other-enter');
    await page.getByRole('button', { name: 'שמור והשווה' }).click();

    await expect(page).toHaveURL(/#\/diagnosis\/compare$/);
    await expect(page.getByRole('heading', { level: 1, name: 'אני מול מיכל' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'בסך הכול — אני: 3D 0%, 4D 0%, 5D 100%' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^בסך הכול — מיכל:/ })).toBeVisible();
    await shot(page, '45-compare');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });

  test('מגמה: אחרי שתי מדידות מופיע גרף, עם טבלה חלופית', async ({ page }) => {
    test.slow();
    await skipOnboarding(page);
    for (const d3 of [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1]]) {
      await page.goto('/#/diagnosis/self');
      await page.getByRole('button', { name: 'התחל' }).click();
      await answerAll(page, d3);
      await expect(page).toHaveURL(/#\/diagnosis\/result\//);
    }
    await page.goto('/#/diagnosis');
    const chart = page.getByRole('img', { name: /^מגמה בין מדידות/ });
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute('aria-label', /3D 67%.*3D 17%/);
    await page.getByText('הצג כטבלה').click();
    await expect(page.getByRole('cell', { name: '67%' })).toBeVisible();
    await shot(page, '46-trend');
  });
});
