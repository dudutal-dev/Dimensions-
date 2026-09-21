import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import {
  allSessionIds,
  breathAt,
  breathCycleSec,
  findSession,
  formatClock,
  initialPlayerState,
  next,
  pause,
  previous,
  remainingSec,
  resume,
  start,
  tick,
  waitsForUser,
  type PlayerState,
  type Session,
} from '../../src/domain/session';

const content = loadContent();
const session = (id: string): Session => {
  const found = findSession(content, id);
  if (!found) throw new Error(`אין סשן ${id}`);
  return found;
};

describe('איתור סשנים', () => {
  it('כל תרגיל, כלי ופרוטוקול טריגר רץ בנגן (קבלת M4/M5)', () => {
    const ids = allSessionIds(content);
    expect(ids.length).toBe(14 + 20 + 7);
    for (const id of ids) {
      const s = findSession(content, id);
      expect(s, id).toBeDefined();
      expect(s!.segments.length, id).toBeGreaterThan(0);
      expect(s!.segments.reduce((sum, seg) => sum + seg.durationSec, 0), id).toBe(s!.durationSec);
    }
  });

  it('הכלי "90 שניות" מקבל את המקטעים של התרגיל', () => {
    expect(session('sos-90').segments).toEqual(session('sos90').segments);
    expect(session('sos-90').kind).toBe('tool');
  });

  it('תרגילי כתיבה מגיעים עם הגדרת הטופס; מזהה לא מוכר — undefined', () => {
    expect(session('t7').form?.kind).toBe('belief-inquiry');
    expect(session('t1').mode).toBe('timed');
    expect(findSession(content, 'nope')).toBeUndefined();
  });
});

describe('נשימה', () => {
  const coherent = { inhaleSec: 5, holdInSec: 0, exhaleSec: 6, holdOutSec: 0 };
  const sigh = { inhaleSec: 3, topUpSec: 1, holdInSec: 0, exhaleSec: 7, holdOutSec: 1 };

  it('נשימה קוהרנטית: שאיפה 5, נשיפה 6, ומחזור שחוזר', () => {
    expect(breathCycleSec(coherent)).toBe(11);
    expect(breathAt(coherent, 0)).toMatchObject({ phase: 'inhale', cycle: 0, fill: 0, remainingSec: 5 });
    expect(breathAt(coherent, 2.5)).toMatchObject({ phase: 'inhale', progress: 0.5, fill: 0.5 });
    expect(breathAt(coherent, 5)).toMatchObject({ phase: 'exhale', fill: 1, remainingSec: 6 });
    expect(breathAt(coherent, 8).fill).toBeCloseTo(0.5);
    expect(breathAt(coherent, 11)).toMatchObject({ phase: 'inhale', cycle: 1 });
  });

  it('נשיפה כפולה: שאיפה, עוד שאיפה קצרה שממלאת עד הסוף, נשיפה ארוכה, המתנה', () => {
    expect(breathCycleSec(sigh)).toBe(12);
    expect(breathAt(sigh, 3).phase).toBe('topUp');
    expect(breathAt(sigh, 3).fill).toBeCloseTo(0.8);
    expect(breathAt(sigh, 3.999).fill).toBeCloseTo(1, 2);
    expect(breathAt(sigh, 4).phase).toBe('exhale');
    expect(breathAt(sigh, 11.5)).toMatchObject({ phase: 'holdOut', fill: 0 });
  });
});

describe('מצב הנגן', () => {
  const sos = session('sos90');

  it('התחלה נכנסת למקטע הראשון', () => {
    expect(initialPlayerState.status).toBe('idle');
    expect(start()).toEqual({ state: { status: 'running', index: 0, segmentMs: 0 }, events: [{ type: 'enter', index: 0 }] });
  });

  it('מתקדם ממקטע למקטע, ועודף הזמן עובר הלאה', () => {
    let state = start().state;
    const first = tick(sos, state, 9_000);
    expect(first.state).toMatchObject({ index: 0, segmentMs: 9_000 });
    expect(first.events).toEqual([]);

    const second = tick(sos, first.state, 1_500); // המקטע הראשון נמשך 10 שניות
    expect(second.state).toMatchObject({ index: 1, segmentMs: 500 });
    expect(second.events).toEqual([{ type: 'enter', index: 1 }]);
    state = second.state;
    expect(remainingSec(sos, state)).toBe(80);
  });

  it('קפיצת זמן גדולה (לשונית שנרדמה) חוצה כמה מקטעים בבת אחת', () => {
    const result = tick(sos, start().state, 41_000); // 10 + 6 + 24 = 40
    expect(result.state.index).toBe(3);
    expect(result.events.map((e) => (e.type === 'enter' ? e.index : -1))).toEqual([1, 2, 3]);
  });

  it('מסתיים בדיוק אחרי 90 שניות', () => {
    let state: PlayerState = start().state;
    let finished = false;
    for (let t = 0; t < 900 && !finished; t++) {
      const result = tick(sos, state, 100);
      state = result.state;
      finished = result.events.some((e) => e.type === 'finished');
      if (finished) expect((t + 1) * 100).toBe(90_000);
    }
    expect(state.status).toBe('finished');
    expect(remainingSec(sos, state)).toBe(0);
  });

  it('השהיה עוצרת את הזמן; המשך מחזיר אותו', () => {
    const paused = pause(tick(sos, start().state, 3_000).state);
    expect(tick(sos, paused, 60_000).state).toEqual(paused);
    expect(tick(sos, resume(paused), 1_000).state.segmentMs).toBe(4_000);
  });

  it('הבא / הקודם', () => {
    const state = tick(sos, start().state, 12_000).state; // במקטע 1, אחרי שתי שניות
    expect(previous(state).state).toMatchObject({ index: 1, segmentMs: 0 });
    expect(previous(previous(state).state).state.index).toBe(0);
    expect(next(sos, state).state.index).toBe(2);

    const last = { status: 'running', index: sos.segments.length - 1, segmentMs: 0 } as const;
    expect(next(sos, last).events).toEqual([{ type: 'finished' }]);
  });

  it('בטופס, שאלות כתיבה ממתינות למשתמש — הזמן לא מקדם אותן', () => {
    const form = session('t5');
    expect(waitsForUser(form, 0)).toBe(false); // פתיח
    expect(waitsForUser(form, 1)).toBe(true); // "מה קרה?"
    expect(waitsForUser(session('t10'), 1)).toBe(false); // prompt מתוזמן בתרגיל רגיל

    const afterIntro = tick(form, start().state, 10_000).state;
    expect(afterIntro.index).toBe(1);
    const muchLater = tick(form, afterIntro, 3_600_000).state;
    expect(muchLater.index).toBe(1);
    expect(next(form, muchLater).state.index).toBe(2);
  });

  it('שעון', () => {
    expect([formatClock(0), formatClock(59), formatClock(600), formatClock(754)]).toEqual(['00:00', '00:59', '10:00', '12:34']);
  });
});
