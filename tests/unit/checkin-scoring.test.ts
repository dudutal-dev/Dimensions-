import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import {
  dimsOf,
  isStepComplete,
  primaryDim,
  quickScore,
  scoreCheckin,
  shouldNudge,
  weightsFor,
  type CheckinAnswers,
} from '../../src/domain/checkin-scoring';
import type { CheckIn } from '../../src/domain/records';
import { anchorForTime, anchorsForDay, dayPartOf, nextTask, weeklyInsight } from '../../src/domain/today';
import { DEFAULT_ANCHOR_TIMES } from '../../src/domain/defaults';

const content = loadContent().checkin;

const ALL_3D: CheckinAnswers = {
  'breath-place': 'chest',
  'breath-flow': 'held',
  contraction: 9,
  'thought-topic': 'threat',
  'thought-belief': 'fact',
  'emotion-word': 'fear',
  'time-where': 'future',
};
const ALL_4D: CheckinAnswers = {
  'breath-place': 'chest',
  'breath-flow': 'uneven',
  contraction: 4,
  'thought-topic': 'self-analysis',
  'thought-belief': 'story',
  'emotion-word': 'confusion',
  'time-where': 'past',
};
const ALL_5D: CheckinAnswers = {
  'breath-place': 'belly',
  'breath-flow': 'flowing',
  contraction: 1,
  'thought-topic': 'quiet',
  'thought-belief': 'passed',
  'emotion-word': 'calm',
  'time-where': 'here',
};

describe('ניקוד בדיקת המימד', () => {
  it.each([
    ['3D', ALL_3D, 'd3'],
    ['4D', ALL_4D, 'd4'],
    ['5D', ALL_5D, 'd5'],
  ] as const)('תשובות עקביות של %s נותנות תוצאה חד-משמעית', (_label, answers, expected) => {
    const score = scoreCheckin(content, answers)!;
    expect(score.result).toBe(expected);
    expect(score.mixed).toBe(false);
    // לערוץ הזמן (עבר / עתיד / כאן) אין תשובת 4D מובהקת — לכן הוא אינו נבדק כאן.
    expect(score.votes.filter((v) => v.channel !== 'time').every((v) => v.dim === expected)).toBe(true);
  });

  it('הציונים מנורמלים לסכום 1', () => {
    for (const answers of [ALL_3D, ALL_4D, ALL_5D]) {
      const { scores } = scoreCheckin(content, answers)!;
      expect(scores.d3 + scores.d4 + scores.d5).toBeCloseTo(1, 6);
    }
  });

  it('ערוץ הגוף שוקל פי 1.5: גוף 3D מול מחשבה 5D — הגוף מנצח', () => {
    const bodyOnly = scoreCheckin(content, { 'breath-place': 'chest', 'breath-flow': 'held', contraction: 9 })!;
    const thoughtOnly = scoreCheckin(content, { 'thought-topic': 'quiet', 'thought-belief': 'passed' })!;
    const both = scoreCheckin(content, {
      'breath-place': 'chest',
      'breath-flow': 'held',
      contraction: 9,
      'thought-topic': 'quiet',
      'thought-belief': 'passed',
    })!;
    expect(bodyOnly.result).toBe('d3');
    expect(thoughtOnly.result).toBe('d5');
    expect(both.scores.d3).toBeGreaterThan(both.scores.d5);
    // ממוצע משוקלל: (1.5·גוף + 1·מחשבה) / 2.5
    expect(both.scores.d3).toBeCloseTo((1.5 * bodyOnly.scores.d3 + thoughtOnly.scores.d3) / 2.5, 6);
  });

  it('פער קטן מהסף בין מצבים סמוכים → תוצאת ביניים', () => {
    const score = scoreCheckin(content, { ...ALL_3D, 'thought-topic': 'self-analysis', 'thought-belief': 'story', 'emotion-word': 'confusion', contraction: 5, 'breath-flow': 'uneven' })!;
    expect(['d3-d4', 'd4']).toContain(score.result);

    const between = scoreCheckin(content, { 'breath-place': 'chest', 'breath-flow': 'uneven', 'time-where': 'past' })!;
    expect(between.scores.d3 - between.scores.d4).toBeLessThan(content.scoring.blendThreshold);
    expect(between.result).toBe('d3-d4');
  });

  it('תיקו בין 3D ל-5D (לא סמוכים) → הגוף מכריע, ומסומן כ"ערוצים חלוקים"', () => {
    const fake = structuredClone(content);
    // מבטלים את היתרון של הגוף כדי ליצור תיקו מלאכותי בין גוף 3D לשלושה ערוצי 5D.
    fake.scoring.channelMultipliers = { body: 3, thought: 1, emotion: 1, time: 1 };
    const score = scoreCheckin(fake, { ...ALL_5D, 'breath-place': 'chest', 'breath-flow': 'held', contraction: 10 })!;
    expect(Math.abs(score.scores.d3 - score.scores.d5)).toBeLessThan(fake.scoring.blendThreshold);
    expect(score.mixed).toBe(true);
    expect(score.result).toBe('d3');
  });

  it('תשובות חלקיות מנוקדות לפי מה שנענה; בלי תשובות — אין ציון', () => {
    expect(scoreCheckin(content, {})).toBeNull();
    expect(scoreCheckin(content, { 'time-where': 'here' })!.result).toBe('d5');
  });

  it('סולם הכיווץ ממופה לרצועות, כולל הקצוות', () => {
    const scale = content.steps.flatMap((s) => s.questions).find((q) => q.id === 'contraction')!;
    expect(weightsFor(scale, 0)!.d5).toBeGreaterThan(0.5);
    expect(weightsFor(scale, 2)!.d5).toBeGreaterThan(0.5);
    expect(weightsFor(scale, 3)!.d4).toBe(0.5);
    expect(weightsFor(scale, 10)!.d3).toBeGreaterThan(0.7);
    expect(weightsFor(scale, 'chest')).toBeNull();
  });

  it('כל מילה בגלגל הרגשות מקבלת את משקלי הטבעת שלה', () => {
    const wheel = content.steps.flatMap((s) => s.questions).find((q) => q.kind === 'wheel')!;
    expect(weightsFor(wheel, 'awe')!.d5).toBeGreaterThan(0.5);
    expect(weightsFor(wheel, 'guilt')!.d3).toBeGreaterThan(0.5);
    expect(weightsFor(wheel, 'unknown-word')).toBeNull();
  });

  it('צעד שלם רק כשכל שאלותיו נענו', () => {
    const breath = content.steps[0]!;
    expect(isStepComplete(breath, { 'breath-place': 'chest' })).toBe(false);
    expect(isStepComplete(breath, { 'breath-place': 'chest', 'breath-flow': 'held' })).toBe(true);
  });

  it('רישום מהיר ועזרי תוצאה', () => {
    expect(quickScore('d4')).toEqual({ scores: { d3: 0, d4: 1, d5: 0 }, result: 'd4' });
    expect(primaryDim('d3-d4')).toBe('d4');
    expect(primaryDim('d5')).toBe('d5');
    expect(dimsOf('d4-d5')).toEqual(['d4', 'd5']);
  });
});

const checkin = (over: Partial<CheckIn>): CheckIn => ({
  id: Math.random().toString(36),
  ts: 0,
  answers: {},
  chips: [],
  scores: { d3: 1, d4: 0, d5: 0 },
  result: 'd3',
  domain: 'work',
  quick: false,
  ...over,
});

describe('הצעה עדינה לעזרה', () => {
  const rule = loadContent().safety.gentleNudge.rule;

  it('שלוש בדיקות מלאות ברצף עם כיווץ 10', () => {
    const tens = [1, 2, 3].map(() => checkin({ answers: { contraction: 10 } }));
    expect(shouldNudge(tens, rule)).toBe(true);
    expect(shouldNudge(tens.slice(0, 2), rule)).toBe(false);
    expect(shouldNudge([tens[0]!, checkin({ answers: { contraction: 9 } }), tens[1]!], rule)).toBe(false);
  });

  it('רישומים מהירים לא שוברים את הרצף ולא נספרים בו', () => {
    const tens = [1, 2, 3].map(() => checkin({ answers: { contraction: 10 } }));
    expect(shouldNudge([tens[0]!, checkin({ quick: true }), tens[1]!, tens[2]!], rule)).toBe(true);
  });
});

describe('מסך היום', () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 21, h, m);

  it('בדיקה משויכת לעוגן הפנוי הקרוב, בטווח של שעה וחצי', () => {
    expect(anchorForTime(at(7, 20), DEFAULT_ANCHOR_TIMES, new Set())).toBe('wake');
    expect(anchorForTime(at(8, 20), DEFAULT_ANCHOR_TIMES, new Set())).toBe('before-first-meeting');
    expect(anchorForTime(at(8, 20), DEFAULT_ANCHOR_TIMES, new Set(['before-first-meeting']))).toBe('wake');
    expect(anchorForTime(at(16, 0), DEFAULT_ANCHOR_TIMES, new Set())).toBeUndefined();
  });

  it('עוגני היום מתמלאים בבדיקה האחרונה שנרשמה לכל אחד', () => {
    const anchors = anchorsForDay(
      [checkin({ id: 'a', anchor: 'wake', result: 'd3' }), checkin({ id: 'b', anchor: 'wake', result: 'd5' })],
      DEFAULT_ANCHOR_TIMES,
    );
    expect(anchors).toHaveLength(5);
    expect(anchors[0]).toMatchObject({ id: 'wake', time: '07:00' });
    expect(anchors[0]!.checkin?.id).toBe('b');
    expect(anchors[1]!.checkin).toBeUndefined();
  });

  it('המשימה הבאה: עוגן שממתין, ואם עבר מזמן — בדיקה חופשית, בלי אשמה', () => {
    const empty = anchorsForDay([], DEFAULT_ANCHOR_TIMES);
    expect(nextTask({ now: at(9, 10), anchors: empty })).toEqual({ kind: 'checkin', anchor: 'before-first-meeting' });
    expect(nextTask({ now: at(8, 40), anchors: empty })).toEqual({ kind: 'checkin', anchor: 'before-first-meeting' });
    expect(nextTask({ now: at(16, 45), anchors: empty })).toEqual({ kind: 'checkin' });

    const filled = anchorsForDay([checkin({ anchor: 'before-first-meeting' })], DEFAULT_ANCHOR_TIMES);
    expect(nextTask({ now: at(9, 10), anchors: filled })).toEqual({ kind: 'checkin', anchor: 'wake' });
  });

  it('תרגול ויומן ערב נכנסים לתור כשהם זמינים', () => {
    const anchors = anchorsForDay([], DEFAULT_ANCHOR_TIMES);
    expect(nextTask({ now: at(16, 45), anchors, practicePending: true })).toEqual({ kind: 'practice' });
    expect(nextTask({ now: at(3, 0), anchors, eveningJournalPending: true })).toEqual({ kind: 'checkin' });
    const evening = anchors.map((a) => ({ ...a, checkin: checkin({}) }));
    expect(nextTask({ now: at(21, 0), anchors: evening, eveningJournalPending: true })).toEqual({ kind: 'evening-journal' });
  });

  it('חלקי היום', () => {
    expect([dayPartOf(at(6)), dayPartOf(at(13)), dayPartOf(at(19)), dayPartOf(at(23)), dayPartOf(at(2))]).toEqual([
      'morning',
      'noon',
      'evening',
      'night',
      'night',
    ]);
  });

  it('שורת התובנה: פחות מ-12 בדיקות — כמה נשארו; אחר כך — איפה מופיע 3D', () => {
    expect(weeklyInsight(4, [checkin({})])).toEqual({ kind: 'not-enough', remaining: 8 });

    const sundayMorning = new Date(2026, 8, 20, 8).getTime(); // יום ראשון
    const week = [
      checkin({ ts: sundayMorning, domain: 'time' }),
      checkin({ ts: sundayMorning + 3_600_000, domain: 'time' }),
      checkin({ ts: sundayMorning + 40 * 3_600_000, result: 'd5', domain: 'creation' }),
    ];
    expect(weeklyInsight(30, week)).toMatchObject({ kind: 'pattern', dim: 'd3', weekday: 0, dayPart: 'morning', domain: 'time' });
  });
});
