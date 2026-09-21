import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { defaultJourney } from '../../src/domain/defaults';
import {
  advance,
  beginReturnPlan,
  countsAsDailyPractice,
  criterionChecked,
  dailyPlan,
  daysAway,
  daysIntoWeek,
  daysOfCurrentWeek,
  entryRecommendation,
  goToWeek,
  hasStarted,
  isLastWeekOfPhase,
  isReturningFromBreak,
  isoDate,
  metricChange,
  phaseOfWeek,
  practicePendingToday,
  readyToMoveOn,
  returnPlanActive,
  setCriterion,
  startJourney,
  stayAnotherWeek,
  week0Steps,
  weekFromId,
  weekIdOf,
} from '../../src/domain/journey';
import { JourneyStateSchema, type JourneyState } from '../../src/domain/records';

const { journey: content, diagnosis } = loadContent();
const day = (n: number, hour = 9) => new Date(2026, 8, n, hour); // ספטמבר 2026
const at = (n: number) => day(n).getTime();

function inWeek(week: number, startDay: number): JourneyState {
  return goToWeek(startJourney(defaultJourney(), at(1)), week, at(startDay));
}

describe('מבנה התכנית', () => {
  it('שלושה שלבים: 1–3, 4–8, 9–12; שבוע 0 מחוץ לשלבים', () => {
    expect([1, 3, 4, 8, 9, 12].map((w) => phaseOfWeek(content, w)?.id)).toEqual(['A', 'A', 'B', 'B', 'C', 'C']);
    expect(phaseOfWeek(content, 0)).toBeUndefined();
    expect([3, 8, 12].every((w) => isLastWeekOfPhase(content, w))).toBe(true);
    expect(isLastWeekOfPhase(content, 5)).toBe(false);
  });

  it('מזהי שבוע', () => {
    expect([weekIdOf(0), weekIdOf(4), weekIdOf(12)]).toEqual(['w00', 'w04', 'w12']);
    expect([weekFromId('w04'), weekFromId('w4'), weekFromId('w13'), weekFromId('x'), weekFromId(undefined)]).toEqual([4, 4, undefined, undefined, undefined]);
  });
});

describe('מעברים — בלי נעילה קשיחה', () => {
  it('התחלה בשבוע 0', () => {
    const state = startJourney(defaultJourney(), at(1));
    expect(hasStarted(defaultJourney())).toBe(false);
    expect(state).toMatchObject({ startedAt: at(1), weekStartedAt: at(1), currentWeek: 0, mode: 'program' });
  });

  it('ממשיכים שבוע-שבוע, כולל מעברי שלב; אחרי שבוע 12 — תחזוקה', () => {
    let state = startJourney(defaultJourney(), at(1));
    for (let week = 1; week <= 12; week++) {
      state = advance(state, at(1) + week);
      expect(state.currentWeek).toBe(week);
      expect(state.mode).toBe('program');
    }
    state = advance(state, at(30));
    expect(state).toMatchObject({ currentWeek: 12, mode: 'maintenance', completedAt: at(30) });
    expect(() => JourneyStateSchema.parse(state)).not.toThrow();
  });

  it('אפשר לקפוץ לכל שבוע (המלצת האבחון), וגם לחזור אחורה', () => {
    expect(goToWeek(inWeek(1, 2), 4, at(3)).currentWeek).toBe(4);
    expect(goToWeek(inWeek(6, 2), 2, at(3)).currentWeek).toBe(2);
    expect(goToWeek(inWeek(6, 2), 99, at(3)).currentWeek).toBe(12);
  });

  it('"להישאר עוד שבוע": אותו שבוע, חלון חדש — לא כישלון ולא איפוס', () => {
    const before = { ...inWeek(3, 1), days: { '2026-09-02': { practice: true, lifeTask: false } } };
    const after = stayAnotherWeek(before, at(9));
    expect(after.currentWeek).toBe(3);
    expect(after.weekStartedAt).toBe(at(9));
    expect(after.days).toEqual(before.days);
  });

  it("קריטריוני המעבר הם צ'קליסט רך שנשמר, ואינו חוסם התקדמות", () => {
    let state = inWeek(3, 1);
    state = setCriterion(state, 'A', 1, true);
    expect(criterionChecked(state, 'A', 1)).toBe(true);
    expect(criterionChecked(state, 'A', 0)).toBe(false);
    expect(advance(state, at(8)).currentWeek).toBe(4); // גם בלי לסמן את כולם
    expect(() => JourneyStateSchema.parse(state)).not.toThrow();
  });
});

describe('השבוע הנוכחי', () => {
  it('שבעה ימים מהיום שבו התחיל השבוע; יום שלא סומן פשוט ריק', () => {
    const state = { ...inWeek(1, 7), days: { '2026-09-07': { practice: true, lifeTask: true }, '2026-09-09': { practice: true, lifeTask: false } } };
    const days = daysOfCurrentWeek(state, day(10));
    expect(days.map((d) => d.date)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']);
    expect(days.map((d) => d.practice)).toEqual([true, false, true, false, false, false, false]);
    expect(days.find((d) => d.isToday)?.dayNumber).toBe(4);
    expect(days.filter((d) => d.isFuture)).toHaveLength(3);
    expect(Object.keys(days[1]!)).not.toContain('missed');
  });

  it('אחרי שבעה ימים אפשר להציע להמשיך — לא לפני', () => {
    const state = inWeek(2, 7);
    expect(daysIntoWeek(state, day(7))).toBe(0);
    expect(readyToMoveOn(state, day(13))).toBe(false);
    expect(readyToMoveOn(state, day(14))).toBe(true);
  });

  it('תרגולי היום: החדש מובלט, הנמשכים מופיעים אחריו', () => {
    expect(dailyPlan(content, defaultJourney(), day(1))).toBeNull();
    expect(dailyPlan(content, inWeek(3, 1), day(2))).toEqual({
      week: 3,
      isReturnPlan: false,
      exerciseIds: ['t1', 't2', 'walk', 't3'],
      newExerciseIds: ['t3'],
    });
    expect(dailyPlan(content, inWeek(12, 1), day(2))?.exerciseIds).toEqual([]); // שבוע 12: תרגול חופשי
  });

  it('סשן שהושלם נחשב לתרגול היומי רק אם הוא מתרגולי השבוע', () => {
    const state = inWeek(1, 1);
    expect(countsAsDailyPractice(content, state, 't1', day(2))).toBe(true);
    expect(countsAsDailyPractice(content, state, 'heart-drop', day(2))).toBe(false);
    expect(practicePendingToday(content, state, day(2))).toBe(true);
    const marked = { ...state, days: { [isoDate(day(2))]: { practice: true, lifeTask: false } } };
    expect(practicePendingToday(content, marked, day(2))).toBe(false);
  });
});

describe('חזרה מהפסקה', () => {
  const practiced = (state: JourneyState, n: number): JourneyState => ({ ...state, days: { ...state.days, [isoDate(day(n))]: { practice: true, lifeTask: false } } });

  it('ארבעה ימים בלי תרגול מסומן = חזרה מהפסקה; לא בשבוע 0 ולא בתחזוקה', () => {
    const state = practiced(inWeek(2, 1), 3);
    expect(daysAway(state, day(5))).toBe(2);
    expect(isReturningFromBreak(state, day(6))).toBe(false);
    expect(isReturningFromBreak(state, day(7))).toBe(true);
    expect(isReturningFromBreak(startJourney(defaultJourney(), at(1)), day(20))).toBe(false);
    expect(isReturningFromBreak({ ...state, mode: 'maintenance' }, day(20))).toBe(false);
  });

  it('שבוע חדש מתחיל נקי: ההפסקה נמדדת מתחילת השבוע, לא מתרגול ישן', () => {
    const state = goToWeek(practiced(inWeek(1, 1), 2), 2, at(10));
    expect(daysAway(state, day(11))).toBe(1);
  });

  it('"טוב שחזרת": שלושה ימים של ת1–ת3, ואז חוזרים לתרגולי השבוע', () => {
    const back = beginReturnPlan(practiced(inWeek(6, 1), 2), day(15));
    expect(back.returnPlanFrom).toBe('2026-09-15');
    expect(isReturningFromBreak(back, day(15))).toBe(false);
    for (const n of [15, 16, 17]) {
      expect(returnPlanActive(back, day(n))).toBe(true);
      expect(dailyPlan(content, back, day(n))).toMatchObject({ isReturnPlan: true, exerciseIds: ['t1', 't2', 't3'] });
    }
    expect(returnPlanActive(back, day(18))).toBe(false);
    expect(dailyPlan(content, back, day(18))?.newExerciseIds).toEqual(['t6']);
    expect(() => JourneyStateSchema.parse(back)).not.toThrow();
  });

  it('מעבר שבוע מבטל תכנית חזרה פעילה', () => {
    const back = beginReturnPlan(inWeek(6, 1), day(15));
    expect(advance(back, at(16)).returnPlanFrom).toBeUndefined();
  });
});

describe('נקודת כניסה, שבוע 0 ומדדים', () => {
  it('האבחון ממליץ מאיפה להתחיל: 3D ← שבוע 1, 4D או פיזור ← שבוע 4, 5D ← שבוע 9', () => {
    const { profiles, dominanceThreshold: t } = diagnosis.interpretation;
    expect(entryRecommendation({ d3: 0.7, d4: 0.2, d5: 0.1 }, profiles, t)).toMatchObject({ phase: 'A', week: 1 });
    expect(entryRecommendation({ d3: 0.3, d4: 0.4, d5: 0.3 }, profiles, t)).toMatchObject({ phase: 'B', week: 4 });
    expect(entryRecommendation({ d3: 0.1, d4: 0.1, d5: 0.8 }, profiles, t)).toMatchObject({ phase: 'C', week: 9 });
  });

  it('צעדי שבוע 0 נגזרים מהנתונים עצמם', () => {
    const none = week0Steps({ hasSelfDiagnosis: false, hasOtherDiagnosis: false, eveningEntries: 0, hasBaselineMetrics: false, hasFocusDomain: false });
    expect(Object.values(none)).toEqual([false, false, false, false]);
    const some = week0Steps({ hasSelfDiagnosis: true, hasOtherDiagnosis: false, eveningEntries: 6, hasBaselineMetrics: true, hasFocusDomain: true });
    expect(some).toEqual({ diagnosis: true, 'reaction-journal': false, 'baseline-metrics': true, 'focus-domain': true });
    expect(content.week0.steps.map((s) => s.id)).toEqual(Object.keys(some));
  });

  it('מדדים: בזמן התאוששות ובשעות מסך ירידה היא שיפור', () => {
    expect(metricChange('recoveryMin', 120, 45)).toBe('better');
    expect(metricChange('leisureScreenHours', 2, 3)).toBe('worse');
    expect(metricChange('sleepQuality', 5, 7)).toBe('better');
    expect(metricChange('quietMinutes', 10, 10)).toBe('same');
    expect(metricChange('quietMinutes', undefined, 10)).toBeNull();
  });
});
