import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { articlesBySection, articleText, isLocked, normalize, plain, searchLibrary } from '../../src/domain/library';

const content = loadContent();
const ids = (query: string, options?: { includeLocked?: boolean }) => searchLibrary(content, query, options).map((h) => h.article.id);

describe('ספרייה — חיפוש', () => {
  it('מוצא לפי כותרת, והתאמה בכותרת קודמת להתאמה בגוף', () => {
    const result = ids('זיוף');
    expect(result[0]).toBe('fake-5d');
  });

  it('מחפש גם בתוכן שמופנה מקבצים אחרים (טבלת זיוף 5D, שערים, ערוצים)', () => {
    expect(ids('ריצוי')).toContain('fake-5d');
    expect(ids('בעלי חיים')).toContain('gates');
    expect(ids('נשיפה ארוכה')).toContain('five-channels');
  });

  it('כל מילות השאילתה נדרשות, בכל סדר', () => {
    expect(ids('תולעת חור')).toContain('physics-fifth-dimension');
    expect(ids('תולעת קפה')).toEqual([]);
  });

  it('אותיות סופיות, גרשיים ואותיות גדולות אינם מפריעים', () => {
    expect(normalize('“זמן”')).toBe(normalize(' זמנ '));
    expect(ids('קיגן')).toContain('parallels');
    expect(ids('ORCH-or')).toContain('physics-quantum-basics');
  });

  it('ניקוד בטקסט אינו מפריע לחיפוש בלי ניקוד', () => {
    expect(plain('חיוּת')).toBe('חיות');
    expect(ids('חיות')).toContain('fake-5d');
  });

  it('שאילתה קצרה מדי או ריקה — בלי תוצאות', () => {
    expect(ids('')).toEqual([]);
    expect(ids('א')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  it('קטע התצוגה קצר, נקי מסימוני עיצוב, ומכיל את ההתאמה', () => {
    const hit = searchLibrary(content, 'דה-קוהרנציה')[0] ?? searchLibrary(content, 'סופרפוזיציה')[0];
    expect(hit).toBeDefined();
    expect(hit!.snippet.length).toBeLessThanOrEqual(140);
    expect(hit!.snippet).not.toMatch(/\*\*|\{\{/);
  });

  it('מאמר נעול אינו נחשף בחיפוש עד שהמסע הושלם', () => {
    const locked = content.library.articles.find((a) => a.lockedUntilJourneyComplete)!;
    const word = plain(locked.title).split(' ')[0]!;
    expect(ids(word)).not.toContain(locked.id);
    expect(ids(word, { includeLocked: true })).toContain(locked.id);
    expect(isLocked(locked, undefined)).toBe(true);
    expect(isLocked(locked, {})).toBe(true);
    expect(isLocked(locked, { completedAt: 1 })).toBe(false);
    expect(isLocked(content.library.articles[0]!, undefined)).toBe(false);
  });
});

describe('ספרייה — מבנה', () => {
  it('כל מאמר שייך לפרק, וכל פרק מכיל מאמרים', () => {
    const grouped = articlesBySection(content.library);
    expect(grouped.every((g) => g.articles.length > 0)).toBe(true);
    expect(grouped.reduce((sum, g) => sum + g.articles.length, 0)).toBe(content.library.articles.length);
  });

  it('לכל מאמר יש טקסט לחיפוש — גם למאמרים שכולם הפניה', () => {
    for (const article of content.library.articles) {
      expect(articleText(article, content).length, article.id).toBeGreaterThan(article.title.length + 20);
    }
  });
});
