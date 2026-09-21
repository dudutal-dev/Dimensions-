import { describe, expect, it } from 'vitest';
import type { SessionLog } from '../../src/domain/records';
import { improvementOf, recommend, toolStats } from '../../src/domain/shift';

let n = 0;
const log = (over: Partial<SessionLog>): SessionLog => ({
  id: `s${++n}`,
  ts: n,
  toolId: 'double-exhale',
  source: 'shift',
  completed: true,
  ...over,
});

const FROM_3D = ['double-exhale', 'grounding-54321', 'labeling'];

describe('שיפור של סשן', () => {
  it('נמדד במדרגות בין לפני לאחרי', () => {
    expect(improvementOf(log({ before: 'd3', after: 'd4' }))).toBe(1);
    expect(improvementOf(log({ before: 'd3', after: 'd5' }))).toBe(2);
    expect(improvementOf(log({ before: 'd4', after: 'd4' }))).toBe(0);
    expect(improvementOf(log({ before: 'd5', after: 'd3' }))).toBe(-2);
  });

  it('לא ידוע כשהסשן לא הושלם או שלא סומן לפני/אחרי', () => {
    expect(improvementOf(log({ before: 'd3', after: 'd4', completed: false }))).toBeNull();
    expect(improvementOf(log({ after: 'd4' }))).toBeNull();
  });
});

describe('מה עובד לי', () => {
  it('ממוצע רק על סשנים שנמדדו; שימושים נספרים בנפרד', () => {
    const stats = toolStats([
      log({ before: 'd3', after: 'd5' }),
      log({ before: 'd3', after: 'd4' }),
      log({}), // הושלם, בלי לפני/אחרי
      log({ completed: false, before: 'd3', after: 'd5' }), // לא הושלם — לא נספר
    ]);
    expect(stats.get('double-exhale')).toEqual({ toolId: 'double-exhale', uses: 3, measured: 2, avgImprovement: 1.5 });
  });
});

describe('המלצה חכמה', () => {
  it('בלי היסטוריה — הכלי הראשון (המהיר ביותר)', () => {
    expect(recommend([], FROM_3D)).toEqual({ kind: 'default', toolId: 'double-exhale' });
    expect(recommend([], [])).toBeNull();
  });

  it('מדידה בודדת עוד לא מספיקה', () => {
    expect(recommend([log({ toolId: 'labeling', before: 'd3', after: 'd5' })], FROM_3D)?.kind).toBe('default');
  });

  it('הכלי עם השיפור הממוצע הגבוה ביותר', () => {
    const logs = [
      log({ toolId: 'grounding-54321', before: 'd3', after: 'd4' }),
      log({ toolId: 'grounding-54321', before: 'd3', after: 'd4' }),
      log({ toolId: 'labeling', before: 'd3', after: 'd5' }),
      log({ toolId: 'labeling', before: 'd3', after: 'd4' }),
    ];
    expect(recommend(logs, FROM_3D)).toEqual({ kind: 'history', toolId: 'labeling', avgImprovement: 1.5, measured: 2, scope: 'overall' });
  });

  it('ההקשר קודם: מה שעבד בטריגר הזה גובר על מה שעבד בכלל', () => {
    const logs = [
      log({ toolId: 'labeling', before: 'd3', after: 'd5' }),
      log({ toolId: 'labeling', before: 'd3', after: 'd5' }),
      log({ toolId: 'grounding-54321', trigger: 'trg-overload', before: 'd3', after: 'd4' }),
      log({ toolId: 'grounding-54321', trigger: 'trg-overload', before: 'd3', after: 'd4' }),
    ];
    expect(recommend(logs, FROM_3D, { trigger: 'trg-overload' })).toMatchObject({ toolId: 'grounding-54321', scope: 'context' });
    expect(recommend(logs, FROM_3D, { trigger: 'trg-criticism' })).toMatchObject({ toolId: 'labeling', scope: 'overall' });
    expect(recommend(logs, FROM_3D, { domain: 'work' })).toMatchObject({ toolId: 'labeling', scope: 'overall' });
  });

  it('כלי שלא שיפר (או הרע) לא מומלץ, וכלי מחוץ לרשימה לא נחשב', () => {
    const logs = [
      log({ toolId: 'labeling', before: 'd4', after: 'd4' }),
      log({ toolId: 'labeling', before: 'd4', after: 'd3' }),
      log({ toolId: 'heart-drop', before: 'd4', after: 'd5' }),
      log({ toolId: 'heart-drop', before: 'd4', after: 'd5' }),
    ];
    expect(recommend(logs, FROM_3D)).toEqual({ kind: 'default', toolId: 'double-exhale' });
  });
});
