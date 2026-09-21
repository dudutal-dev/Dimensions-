import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import type { Domain } from '../../src/content/schema';
import { buildDomainMap, buildHeatmap, fiveDShareByWeek, formatRecovery, matchPattern, recoveryByWeek } from '../../src/domain/insights';
import { countMarkers, languageTrend } from '../../src/domain/language-markers';
import type { CheckIn, EveningEntry, SessionLog } from '../../src/domain/records';

const content = loadContent();
const markers = content.channels.languageMarkers;
const DOMAINS = content.domains.domains.map((d) => d.id);

let n = 0;
const checkin = (over: Partial<CheckIn>): CheckIn => ({
  id: `c${++n}`,
  ts: new Date(2026, 8, 20, 8).getTime(), // יום ראשון, בוקר
  answers: {},
  chips: [],
  scores: { d3: 1, d4: 0, d5: 0 },
  result: 'd3',
  domain: 'work',
  quick: false,
  ...over,
});
const many = (count: number, over: Partial<CheckIn>) => Array.from({ length: count }, () => checkin(over));

describe('ערוץ השפה', () => {
  it('סופר סמני 3D ו-5D, בכל ההטיות, ומחזיר מה נמצא', () => {
    const counts = countMarkers('אני חייב לסיים. היא חייבת לעזור, אין לי ברירה. תמיד זה ככה, ואף פעם לא מספיק. כרגע יש מספיק, וגם זה בסדר.', markers);
    expect(counts.d3).toBe(5); // חייב, חייבת, אין לי ברירה, תמיד, אף פעם
    expect(counts.d5).toBe(3); // כרגע, יש מספיק, וגם
    expect(counts.hits.find((h) => h.id === 'must')).toMatchObject({ dim: 'd3', count: 2 });
    expect(counts.hits.find((h) => h.id === 'no-choice')?.count).toBe(1); // "אין לי ברירה" לא נספר פעמיים
  });

  it('מילה שלמה בלבד, עם אותיות שימוש צמודות — לא חלק ממילה אחרת', () => {
    expect(countMarkers('וחייב, שצריך, כשאין ברירה', markers).d3).toBe(3);
    expect(countMarkers('התחייבות, הצריכה, בגללית', markers).d3).toBe(0);
    expect(countMarkers('', markers)).toMatchObject({ d3: 0, d5: 0, words: 0 });
  });

  it('מגמה שבועית: מנורמלת ל-100 מילים, ושבוע עם מעט טקסט לא מוצג', () => {
    const now = new Date(2026, 8, 21).getTime();
    const day = 24 * 3_600_000;
    const filler = 'מילה '.repeat(40);
    const trend = languageTrend(
      [
        { ts: now - 10 * day, text: `${filler} חייב חייב צריך תמיד` },
        { ts: now - 2 * day, text: `${filler} חייב כרגע וגם` },
        { ts: now - 20 * day, text: 'חייב' }, // מעט מדי מילים
      ],
      markers,
      now,
    );
    expect(trend).toHaveLength(2);
    expect(trend[0]!.d3).toBe(4);
    expect(trend[1]).toMatchObject({ d3: 1, d5: 2 });
    expect(trend[0]!.d3Per100).toBeGreaterThan(trend[1]!.d3Per100);
  });
});

describe('מפת החום', () => {
  it('עד 12 בדיקות — עוד לא מוכנה, ואומרת כמה חסרות', () => {
    expect(buildHeatmap(many(4, {}))).toMatchObject({ ready: false, remaining: 8, total: 4 });
    expect(buildHeatmap(many(12, {})).ready).toBe(true);
  });

  it('תא לכל יום בשבוע × חלק ביום, עם המצב השכיח', () => {
    const sundayMorning = new Date(2026, 8, 20, 8).getTime();
    const tuesdayEvening = new Date(2026, 8, 22, 19).getTime();
    const map = buildHeatmap([...many(3, { ts: sundayMorning }), checkin({ ts: sundayMorning, result: 'd5' }), ...many(8, { ts: tuesdayEvening, result: 'd4-d5' })]);
    expect(map.cells).toHaveLength(28);
    expect(map.cells.find((c) => c.weekday === 0 && c.dayPart === 'morning')).toMatchObject({ total: 4, dominant: 'd3', counts: { d3: 3, d4: 0, d5: 1 } });
    expect(map.cells.find((c) => c.weekday === 2 && c.dayPart === 'evening')?.dominant).toBe('d4'); // תוצאת ביניים נספרת כ-4D
    expect(map.cells.find((c) => c.weekday === 5 && c.dayPart === 'night')).toMatchObject({ total: 0, dominant: undefined });
  });

  it('סינון לפי תחום; ובשוויון — המצב של הבדיקה האחרונה', () => {
    const ts = new Date(2026, 8, 20, 8).getTime();
    const all = [...many(10, { ts, domain: 'work' }), checkin({ ts: ts + 1, domain: 'money', result: 'd3' }), checkin({ ts: ts + 2, domain: 'money', result: 'd5' })];
    const money = buildHeatmap(all, 'money').cells.find((c) => c.weekday === 0 && c.dayPart === 'morning')!;
    expect(money.total).toBe(2);
    expect(money.dominant).toBe('d5');
    expect(buildHeatmap(all, 'money').ready).toBe(true); // הסף נמדד על כלל הבדיקות
  });
});

describe('מדדים לאורך זמן', () => {
  const now = new Date(2026, 8, 21, 12).getTime();
  const day = 24 * 3_600_000;

  it('אחוז בדיקות 5D לפי שבוע; שבוע בלי בדיקות הוא null ולא 0', () => {
    const weeks = fiveDShareByWeek([...many(3, { ts: now - day }), checkin({ ts: now - 2 * day, result: 'd5' }), checkin({ ts: now - 9 * day, result: 'd5' })], now, 3);
    expect(weeks.map((w) => w.share)).toEqual([null, 1, 0.25]);
    expect(weeks[2]!.total).toBe(4);
  });

  it('זמן התאוששות ממוצע לשבוע, מיומן הערב', () => {
    const event = (recoveryMin: number) => ({ what: 'x', body: 'y', did: 'z', recoveryMin, dim: 'd3' as const });
    const evening = (daysAgo: number, mins: number[]): EveningEntry => ({ id: `e${daysAgo}`, date: '2026-09-01', ts: now - daysAgo * day, events: mins.map(event) });
    const weeks = recoveryByWeek([evening(10, [120, 60]), evening(2, [30]), evening(1, [10, 20])], now, 2);
    expect(weeks.map((w) => w.avgMin)).toEqual([90, 20]);
    expect(weeks[1]!.events).toBe(3);
  });

  it('זמן התאוששות בלשון בני אדם', () => {
    expect([formatRecovery(45), formatRecovery(180), formatRecovery(60 * 48), formatRecovery(60 * 72)]).toEqual(['45 דקות', '3 שעות', 'יומיים', '3 ימים']);
  });
});

describe('מפת תחומי החיים ודפוס אישי', () => {
  const log = (over: Partial<SessionLog>): SessionLog => ({ id: `s${++n}`, ts: 1, toolId: 'labeling', source: 'shift', completed: true, ...over });

  it('לכל תחום: מצב דומיננטי, טריגר עיקרי ל-3D, ומה מחזיר אותי', () => {
    const rows = buildDomainMap(
      DOMAINS,
      [...many(3, { domain: 'money', answers: { 'thought-topic': 'comparison' } }), checkin({ domain: 'work', result: 'd5' })],
      [
        log({ domain: 'money', before: 'd3', after: 'd4', trigger: 'trg-comparison' }),
        log({ domain: 'money', before: 'd3', after: 'd5', toolId: 'heart-drop' }),
        log({ domain: 'work', before: 'd4', after: 'd4' }),
      ],
    );
    expect(rows).toHaveLength(8);
    expect(rows.find((r) => r.domain === 'money')).toMatchObject({
      checkins: 3,
      dominant: 'd3',
      mainTrigger: { kind: 'trigger', id: 'trg-comparison' },
      bringsBack: { toolId: 'heart-drop', avgImprovement: 2 },
    });
    expect(rows.find((r) => r.domain === 'work')).toMatchObject({ dominant: 'd5', mainTrigger: undefined, bringsBack: undefined });
    expect(rows.find((r) => r.domain === 'alone')).toMatchObject({ checkins: 0, dominant: undefined });
  });

  it('בלי סשנים עם טריגר — נושא המחשבה השכיח בבדיקות 3D', () => {
    const [row] = buildDomainMap(['time'], many(2, { domain: 'time', answers: { 'thought-topic': 'threat' } }), []);
    expect(row!.mainTrigger).toEqual({ kind: 'thought', id: 'threat' });
  });

  it('דפוס אישי: רק כשיש מספיק בדיקות בכל תחום רלוונטי', () => {
    const rows = (spec: Partial<Record<Domain, [number, CheckIn['result']]>>) =>
      buildDomainMap(DOMAINS, Object.entries(spec).flatMap(([domain, [count, result]]) => many(count, { domain: domain as Domain, result })), []);

    const superPro = rows({ work: [4, 'd5'], creation: [3, 'd5'], time: [5, 'd3'], couple: [3, 'd3'] });
    expect(matchPattern(superPro, content.domains.patterns)?.id).toBe('super-pro');

    const tooFew = rows({ work: [4, 'd5'], creation: [1, 'd5'], time: [5, 'd3'], couple: [3, 'd3'] });
    expect(matchPattern(tooFew, content.domains.patterns)).toBeUndefined();

    const seeker = rows({ money: [3, 'd3'], work: [3, 'd4'], couple: [4, 'd4'], alone: [3, 'd4'] });
    expect(matchPattern(seeker, content.domains.patterns)?.id).toBe('seeker');

    const monk = rows({ alone: [3, 'd5'], family: [3, 'd3'] });
    expect(matchPattern(monk, content.domains.patterns)?.id).toBe('monk-at-home');
  });
});

describe('ספירה בעברית', () => {
  it('אחד מקבל צורת יחיד, השאר — מספר ורבים', async () => {
    const { countOf } = await import('../../src/lib/plural');
    expect(countOf(1, 'אירוע אחד', 'אירועים')).toBe('אירוע אחד');
    expect(countOf(3, 'אירוע אחד', 'אירועים')).toBe('3 אירועים');
    expect(countOf(0, 'בדיקה אחת', 'בדיקות')).toBe('0 בדיקות');
  });
});
