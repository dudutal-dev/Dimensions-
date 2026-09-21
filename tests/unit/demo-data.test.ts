import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { exportBackup } from '../../src/data/backup';
import { CompassDb, CURRENT_SCHEMA_VERSION } from '../../src/data/db';
import { hasDemoData, loadDemoData, removeDemoData } from '../../src/data/demoData';
import { createRepositories } from '../../src/data/repositories';
import { buildDomainMap, buildHeatmap, fiveDShareByWeek, matchPattern, recoveryByWeek } from '../../src/domain/insights';
import { languageTrend } from '../../src/domain/language-markers';
import { parseBackup } from '../../src/domain/backup';
import { MIN_MEASURED, toolStats } from '../../src/domain/shift';

const NOW = new Date('2026-09-21T10:00:00').getTime();
let counter = 0;
const open: CompassDb[] = [];
const freshDb = () => {
  const db = new CompassDb(`demo-${++counter}`);
  open.push(db);
  return db;
};

afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await CompassDb.delete(db.name);
  }
});

describe('נתוני דמה', () => {
  it('ממלאים את כל התובנות: מפת חום, התאוששות יורדת, 5D עולה, מה עובד, ודפוס "מקצוען-על"', async () => {
    const db = freshDb();
    const repos = createRepositories(db);
    const content = loadContent();
    await loadDemoData(db, NOW);

    const [checkins, evenings, sessions] = await Promise.all([repos.checkins.list(), repos.evenings.list(), repos.sessions.list()]);
    expect(buildHeatmap(checkins).ready).toBe(true);
    expect(buildHeatmap(checkins).cells.filter((c) => c.total > 0).length).toBeGreaterThan(20);

    const recovery = recoveryByWeek(evenings, NOW).flatMap((w) => (w.avgMin === null ? [] : [w.avgMin]));
    expect(recovery.length).toBeGreaterThanOrEqual(5);
    expect(recovery.at(-1)!).toBeLessThan(recovery[0]!);

    const share = fiveDShareByWeek(checkins, NOW).flatMap((w) => (w.share === null ? [] : [w.share]));
    expect(share.at(-1)!).toBeGreaterThan(share[0]!);

    const measured = [...toolStats(sessions).values()].filter((s) => s.measured >= MIN_MEASURED);
    expect(measured.map((s) => s.toolId).sort()).toEqual(['double-exhale', 'heart-drop', 'labeling']);

    const rows = buildDomainMap(content.domains.domains.map((d) => d.id), checkins, sessions);
    expect(matchPattern(rows, content.domains.patterns)?.id).toBe('super-pro');
    expect(rows.find((r) => r.domain === 'time')?.mainTrigger).toEqual({ kind: 'trigger', id: 'trg-overload' });

    const trend = languageTrend(
      evenings.map((e) => ({ ts: e.ts, text: e.events.map((ev) => `${ev.what} ${ev.body} ${ev.did}`).join('\n') })),
      content.channels.languageMarkers,
      NOW,
    );
    expect(trend.length).toBeGreaterThanOrEqual(2);
    expect(trend[0]!.d3Per100).toBeGreaterThan(trend.at(-1)!.d3Per100);
    expect(trend.at(-1)!.d5Per100).toBeGreaterThan(trend[0]!.d5Per100);
  });

  it('הרשומות תקינות לפי הסכמה — גיבוי שכולל אותן נטען בחזרה', async () => {
    const db = freshDb();
    await loadDemoData(db, NOW);
    const file = JSON.parse(JSON.stringify(await exportBackup(db))) as unknown;
    const parsed = parseBackup(file, CURRENT_SCHEMA_VERSION);
    expect(parsed.ok ? 'ok' : parsed.error).toBe('ok');
  });

  it('טעינה חוזרת לא מכפילה, ומחיקה משאירה את הנתונים האמיתיים', async () => {
    const db = freshDb();
    const repos = createRepositories(db);
    const real = await repos.checkins.add({ answers: {}, chips: [], scores: { d3: 0.2, d4: 0.2, d5: 0.6 }, result: 'd5', domain: 'work', quick: true });
    const realDate = '2026-09-10';
    await repos.evenings.saveForDate(realDate, [{ what: 'אירוע אמיתי', body: '', did: '', recoveryMin: 20, dim: 'd4' }]);

    const first = await loadDemoData(db, NOW);
    const second = await loadDemoData(db, NOW);
    expect(second).toBe(first);
    expect(await hasDemoData(db)).toBe(true);
    // ערב אמיתי שנרשם באותו תאריך לא נדרס
    expect((await repos.evenings.getByDate(realDate))?.events[0]?.what).toBe('אירוע אמיתי');

    await removeDemoData(db);
    expect(await hasDemoData(db)).toBe(false);
    expect((await repos.checkins.list()).map((c) => c.id)).toEqual([real.id]);
    expect((await repos.evenings.list()).map((e) => e.date)).toEqual([realDate]);
    expect(await repos.sessions.count()).toBe(0);
    expect(await repos.diagnoses.count()).toBe(0);
  });
});
