import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import type { ContentBundle, ContentFileName } from '../../src/content/schema';
import { CONTENT_FILES, collectSegmentOwners, crossCheck, validateContent } from '../../src/content/validate';

const CONTENT_DIR = join(__dirname, '..', '..', 'src', 'content');

function readRaw(): Record<ContentFileName, unknown> {
  const raw = {} as Record<ContentFileName, unknown>;
  for (const name of CONTENT_FILES) {
    raw[name] = JSON.parse(readFileSync(join(CONTENT_DIR, `${name}.json`), 'utf8'));
  }
  return raw;
}

function validBundle(): ContentBundle {
  const { bundle } = validateContent(readRaw());
  if (!bundle) throw new Error('חבילת התוכן אינה תקינה');
  return structuredClone(bundle);
}

function errorsOf(bundle: ContentBundle): string[] {
  return crossCheck(bundle)
    .filter((i) => i.level === 'error')
    .map((i) => i.message);
}

describe('חבילת התוכן', () => {
  it('עוברת סכמות ובדיקות צולבות ללא שגיאות וללא אזהרות', () => {
    const { bundle, issues } = validateContent(readRaw());
    expect(issues).toEqual([]);
    expect(bundle).not.toBeNull();
  });

  it('נטענת דרך loadContent', () => {
    const content = loadContent();
    expect(content.exercises.exercises).toHaveLength(14);
  });

  it('הסכמות רק מאמתות ואינן משנות את הנתונים — לכן ב-production נטען ה-JSON כמו שהוא', () => {
    // אם ייכנסו לסכמות default/transform, הפלט יפסיק להיות זהה לקלט — והקיצור ב-content/index.ts יהפוך לשגוי.
    expect(JSON.parse(JSON.stringify(loadContent()))).toEqual(readRaw());
  });

  it('מכילה את כל מה שה-SPEC דורש', () => {
    const b = validBundle();
    const exerciseIds = b.exercises.exercises.map((e) => e.id);
    for (let n = 1; n <= 12; n++) expect(exerciseIds).toContain(`t${n}`);
    expect(exerciseIds).toContain('sos90');

    expect(b.tools.tools.filter((t) => t.group === 'from-3d')).toHaveLength(6);
    expect(b.tools.tools.filter((t) => t.group === 'from-4d')).toHaveLength(7);
    expect(b.tools.tools.some((t) => t.id === 'heart-drop')).toBe(true);
    expect(b.triggers.triggers).toHaveLength(7);
    expect(b.domains.domains.filter((d) => d.protocol)).toHaveLength(6);
    expect(b.diagnosis.questions).toHaveLength(12);
    expect(b.journey.weeks).toHaveLength(12);
    expect(b.checkin.anchors).toHaveLength(5);
    expect(b.fake5d.rows).toHaveLength(6);
  });

  it('פרוטוקול 90 השניות נמשך בדיוק 90 שניות', () => {
    const sos = validBundle().exercises.exercises.find((e) => e.id === 'sos90');
    expect(sos?.segments.reduce((sum, s) => sum + s.durationSec, 0)).toBe(90);
  });

  it('ערוץ הגוף במשקל 1.5 וסף תוצאת הביניים 15%', () => {
    const { scoring } = validBundle().checkin;
    expect(scoring.channelMultipliers.body).toBe(1.5);
    expect(scoring.blendThreshold).toBe(0.15);
  });

  it('לכל מקטע מזהה ייחודי', () => {
    const ids = collectSegmentOwners(validBundle()).flatMap((o) => o.segments.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('הוולידטור תופס תקלות', () => {
  it('מזהה מקטע כפול', () => {
    const b = validBundle();
    const t1 = b.exercises.exercises[0]!;
    t1.segments[1]!.id = t1.segments[0]!.id;
    expect(errorsOf(b).some((m) => m.includes('כפול'))).toBe(true);
  });

  it('ספרות וסוגריים בטקסט מדובר', () => {
    const b = validBundle();
    b.exercises.exercises[0]!.segments[1]!.text = 'שאיפה 5 שניות (דרך האף)';
    expect(errorsOf(b).some((m) => m.includes('מתאימים לקול'))).toBe(true);
  });

  it('משך מוצהר שאינו תואם לסכום המקטעים', () => {
    const b = validBundle();
    b.exercises.exercises[0]!.durationSec += 1;
    expect(errorsOf(b).some((m) => m.includes('סכום המקטעים'))).toBe(true);
  });

  it('משך נשימה שאינו כפולה של מחזור', () => {
    const b = validBundle();
    const breath = b.exercises.exercises[0]!.segments.find((s) => s.type === 'breath')!;
    breath.durationSec += 1;
    expect(errorsOf(b).some((m) => m.includes('מחזור נשימה'))).toBe(true);
  });

  it('הפניה לתרגיל או לכלי שאינם קיימים', () => {
    const b = validBundle();
    b.journey.weeks[0]!.practices[0]!.exerciseId = 't99';
    b.triggers.triggers[0]!.relatedToolIds = ['no-such-tool'];
    const errors = errorsOf(b);
    expect(errors.some((m) => m.includes('t99'))).toBe(true);
    expect(errors.some((m) => m.includes('no-such-tool'))).toBe(true);
  });

  it("אימוג'י ותגית רובד לא מוכרת", () => {
    const b = validBundle();
    b.fake5d.intro = 'בדיקה 🔬';
    b.fake5d.goldenTest = 'בדיקה {{proven}}';
    const errors = errorsOf(b);
    expect(errors.some((m) => m.includes("אימוג'י"))).toBe(true);
    expect(errors.some((m) => m.includes('{{proven}}'))).toBe(true);
  });

  it('משקלים שסכומם אינו 1 נדחים בסכמה', () => {
    const raw = readRaw() as { checkin: { steps: { questions: { options: { weights: { d3: number } }[] }[] }[] } };
    raw.checkin.steps[0]!.questions[0]!.options[0]!.weights.d3 = 0.9;
    const { bundle, issues } = validateContent(raw as unknown as Record<ContentFileName, unknown>);
    expect(bundle).toBeNull();
    expect(issues.some((i) => i.message.includes('סכום המשקלים'))).toBe(true);
  });
});
