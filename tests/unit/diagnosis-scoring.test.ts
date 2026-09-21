import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import type { DiagDomain, Dim } from '../../src/content/schema';
import {
  biggestGap,
  buildShareText,
  compareDiagnoses,
  dimForLetter,
  isComplete,
  levelOf,
  LETTERS,
  optionOrder,
  profileOf,
  scoreDiagnosis,
  trendOf,
  weekMarkerFor,
  type DiagAnswers,
} from '../../src/domain/diagnosis-scoring';
import type { Diagnosis } from '../../src/domain/records';

const content = loadContent().diagnosis;
const DOMAIN_ORDER = content.domains.map((d) => d.id);
const allAnswers = (dim: Dim): DiagAnswers => Object.fromEntries(content.questions.map((q) => [q.id, dim]));

describe('ערבוב התשובות', () => {
  it('דטרמיניסטי לפי seed ושאלה — אותו סדר ברענון ובטקסט ששותף', () => {
    expect(optionOrder('abc', 'q01')).toEqual(optionOrder('abc', 'q01'));
    expect([...optionOrder('abc', 'q01')].sort()).toEqual(['d3', 'd4', 'd5']);
  });

  it('לא תמיד א = 3D: לאורך השאלון כל מצב מופיע בכל מיקום', () => {
    const firsts = new Set<Dim>();
    for (const seed of ['s1', 's2', 's3']) for (const q of content.questions) firsts.add(optionOrder(seed, q.id)[0]!);
    expect(firsts).toEqual(new Set(['d3', 'd4', 'd5']));

    const orders = new Set(content.questions.map((q) => optionOrder('seed', q.id).join()));
    expect(orders.size).toBeGreaterThan(2);
  });

  it('seed אחר נותן (כמעט תמיד) סדר אחר', () => {
    const a = content.questions.map((q) => optionOrder('first', q.id).join()).join('|');
    const b = content.questions.map((q) => optionOrder('second', q.id).join()).join('|');
    expect(a).not.toBe(b);
  });
});

describe('ניקוד האבחון', () => {
  it('אחוזים כלליים ולכל תחום', () => {
    const answers: DiagAnswers = { ...allAnswers('d4'), q01: 'd3', q02: 'd3', q03: 'd5' };
    const score = scoreDiagnosis(content, answers);

    expect(score.overall.d3).toBeCloseTo(2 / 12);
    expect(score.overall.d5).toBeCloseTo(1 / 12);
    expect(score.overall.d3 + score.overall.d4 + score.overall.d5).toBeCloseTo(1);
    expect(score.byDomain['time-pressure']).toEqual({ d3: 1, d4: 0, d5: 0 });
    expect(score.byDomain['money-material']).toEqual({ d3: 0, d4: 0.5, d5: 0.5 });
    expect(score.byDomain['inner-body']).toEqual({ d3: 0, d4: 1, d5: 0 }); // ארבע שאלות
  });

  it('שלמות: כל 12 השאלות', () => {
    expect(isComplete(content, allAnswers('d4'))).toBe(true);
    const { q12: _omitted, ...partial } = allAnswers('d4');
    expect(isComplete(content, partial)).toBe(false);
  });

  it('דומיננטיות: מעל 50% ל-3D או ל-5D; אחרת 4D — כולל פיזור', () => {
    const t = content.interpretation.dominanceThreshold;
    expect(profileOf({ d3: 0.6, d4: 0.3, d5: 0.1 }, t)).toBe('d3-dominant');
    expect(profileOf({ d3: 0.1, d4: 0.2, d5: 0.7 }, t)).toBe('d5-dominant');
    expect(profileOf({ d3: 0.2, d4: 0.6, d5: 0.2 }, t)).toBe('d4-dominant');
    expect(profileOf({ d3: 0.4, d4: 0.2, d5: 0.4 }, t)).toBe('d4-dominant'); // פיזור
    expect(profileOf({ d3: 0.5, d4: 0.5, d5: 0 }, t)).toBe('d4-dominant'); // בדיוק 50% אינו "מעל"
  });

  it('הפער הגדול ביותר: התחום הנמוך מול הגבוה', () => {
    const answers: DiagAnswers = { ...allAnswers('d5'), q03: 'd3', q04: 'd3' }; // כסף — 3D, השאר 5D
    const { byDomain } = scoreDiagnosis(content, answers);
    expect(biggestGap(byDomain, DOMAIN_ORDER)).toMatchObject({ lowest: 'money-material', size: 2 });
    expect(biggestGap(scoreDiagnosis(content, allAnswers('d4')).byDomain, DOMAIN_ORDER)).toBeNull();
  });

  it('מדרגה: 0 = כולו 3D, 2 = כולו 5D', () => {
    expect([levelOf({ d3: 1, d4: 0, d5: 0 }), levelOf({ d3: 0, d4: 1, d5: 0 }), levelOf({ d3: 0, d4: 0, d5: 1 })]).toEqual([0, 1, 2]);
  });

  it('לכל תחום אבחון יש תחום חיים מוצע כמוקד', () => {
    for (const domain of content.domains) expect(domain.focusDomainCandidates.length).toBeGreaterThan(0);
  });
});

describe('שאל אדם קרוב', () => {
  it('הטקסט לשיתוף: 12 שאלות בגוף שלישי עם השם, תשובות א/ב/ג, בלי לחשוף את המפתח', () => {
    const text = buildShareText(content, 'דודו', 'seed');
    expect(text).toContain('כשדודו מאחר, או שמשהו מתעכב:');
    expect(text).toContain('12. ');
    expect(text.match(/^ {3}א\. /gm)).toHaveLength(12);
    expect(text).not.toMatch(/3D|4D|5D|\{name\}/);
  });

  it('האות שחזרה מתורגמת למצב לפי אותו seed', () => {
    const seed = 'seed';
    for (const q of content.questions) {
      const order = optionOrder(seed, q.id);
      LETTERS.forEach((_, i) => expect(dimForLetter(seed, q.id, i)).toBe(order[i]));
    }
    // הטקסט והמיפוי עקביים: התשובה שמופיעה תחת "א" היא זו שהאות א ממופה אליה
    const q = content.questions[4]!;
    const dim = dimForLetter(seed, q.id, 0)!;
    const expected = q.thirdPerson.options.find((o) => o.dim === dim)!.text;
    const block = buildShareText(content, 'דודו', seed).split('\n');
    const at = block.findIndex((line) => line.startsWith('5. '));
    expect(block[at + 1]).toBe(`   א. ${expected}`);
  });
});

const diagnosis = (over: Partial<Diagnosis>, answers: DiagAnswers): Diagnosis => ({
  id: Math.random().toString(36),
  ts: 0,
  by: 'self',
  answers,
  ...scoreDiagnosis(content, answers),
  ...over,
});

describe('השוואה ומגמה', () => {
  it('הטיה: חיובית כשאני רואה את עצמי גבוה יותר ממה שרואים אותי', () => {
    const self = diagnosis({}, allAnswers('d5'));
    const other = diagnosis({ by: 'other' }, { ...allAnswers('d5'), q05: 'd3', q06: 'd3' });
    const result = compareDiagnoses(self, other, DOMAIN_ORDER);

    expect(result.overallBias).toBeGreaterThan(0);
    const relationships = result.domains.find((d) => d.domain === ('relationships' satisfies DiagDomain))!;
    expect(relationships.bias).toBe(2);
    expect(result.domains.find((d) => d.domain === 'time-pressure')!.bias).toBe(0);
  });

  it('מגמה: רק מדידות עצמיות, מהישנה לחדשה', () => {
    const list = [
      diagnosis({ id: 'b', ts: 200, weekMarker: 4 }, allAnswers('d4')),
      diagnosis({ id: 'x', ts: 150, by: 'other' }, allAnswers('d3')),
      diagnosis({ id: 'a', ts: 100, weekMarker: 0 }, allAnswers('d3')),
    ];
    expect(trendOf(list).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('סימון נקודת בדיקה: רק בשבועות 0/4/8/12, ופעם אחת לכל נקודה', () => {
    expect(weekMarkerFor(0, [])).toBe(0);
    expect(weekMarkerFor(4, [])).toBe(4);
    expect(weekMarkerFor(5, [])).toBeUndefined();
    expect(weekMarkerFor(0, [diagnosis({ weekMarker: 0 }, allAnswers('d4'))])).toBeUndefined();
    expect(weekMarkerFor(0, [diagnosis({ weekMarker: 0, by: 'other' }, allAnswers('d4'))])).toBe(0);
  });
});
