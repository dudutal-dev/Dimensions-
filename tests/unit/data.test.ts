import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content';
import { exportBackup, importBackup, importBackupText, wipeAll } from '../../src/data/backup';
import { CompassDb, CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS, type SchemaVersion } from '../../src/data/db';
import { createRepositories, type NewRecord } from '../../src/data/repositories';
import { backupFileName, BACKUP_MIGRATIONS } from '../../src/domain/backup';
import { DEFAULT_ANCHOR_TIMES, defaultSettings } from '../../src/domain/defaults';
import type { CheckIn, Diagnosis } from '../../src/domain/records';

let dbCounter = 0;
const openDbs: CompassDb[] = [];

function freshDb(versions?: readonly SchemaVersion[], name = `test-${++dbCounter}`): CompassDb {
  const db = new CompassDb(name, versions);
  openDbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of openDbs.splice(0)) {
    db.close();
    await CompassDb.delete(db.name);
  }
});

const checkin = (over: Partial<NewRecord<CheckIn>> = {}): NewRecord<CheckIn> => ({
  answers: { 'breath-place': 'chest', contraction: 7 },
  chips: ['jaw'],
  scores: { d3: 0.6, d4: 0.3, d5: 0.1 },
  result: 'd3',
  domain: 'work',
  quick: false,
  ...over,
});

const diagnosis = (over: Partial<NewRecord<Diagnosis>> = {}): NewRecord<Diagnosis> => ({
  by: 'self',
  answers: { q01: 'd3', q02: 'd4' },
  overall: { d3: 0.5, d4: 0.5, d5: 0 },
  byDomain: {
    'time-pressure': { d3: 0.5, d4: 0.5, d5: 0 },
    'money-material': { d3: 0, d4: 0, d5: 0 },
    relationships: { d3: 0, d4: 0, d5: 0 },
    'identity-meaning': { d3: 0, d4: 0, d5: 0 },
    'inner-body': { d3: 0, d4: 0, d5: 0 },
  },
  ...over,
});

describe('מסד הנתונים', () => {
  it('נפתח עם כל הטבלאות ובגרסה הנוכחית', async () => {
    const db = freshDb();
    await db.open();
    expect(db.verno).toBe(CURRENT_SCHEMA_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['checkins', 'diagnoses', 'drafts', 'evenings', 'forms', 'journey', 'metrics', 'sessions', 'settings'].sort(),
    );
  });

  it('גרסאות הסכמה רציפות ועולות', () => {
    SCHEMA_VERSIONS.forEach((v, i) => expect(v.version).toBe(i + 1));
  });

  it('migration: שדרוג גרסה ממיר את הנתונים הקיימים', async () => {
    const name = `migrate-${++dbCounter}`;
    const v1 = freshDb(SCHEMA_VERSIONS, name);
    await createRepositories(v1).checkins.add(checkin({ id: 'a', ts: 1000 }));
    v1.close();

    // גרסה 2 לדוגמה: אינדקס חדש ושדה חדש שמחושב מהקיים.
    const versions: SchemaVersion[] = [
      ...SCHEMA_VERSIONS,
      {
        version: SCHEMA_VERSIONS.length + 1,
        stores: { checkins: 'id, ts, domain, result, anchor, quick' },
        upgrade: (tx) =>
          tx
            .table('checkins')
            .toCollection()
            .modify((row: Record<string, unknown>) => {
              row.migrated = true;
            }),
      },
    ];
    const v2 = freshDb(versions, name);
    const row = (await v2.table('checkins').get('a')) as Record<string, unknown>;
    expect(v2.verno).toBe(SCHEMA_VERSIONS.length + 1);
    expect(row.migrated).toBe(true);
    expect(row.domain).toBe('work');
  });
});

describe('repositories', () => {
  it('בדיקות: הוספה, שליפה לפי טווח, אחרונות, עדכון ומחיקה', async () => {
    const { checkins } = createRepositories(freshDb());
    await checkins.add(checkin({ id: 'a', ts: 1000 }));
    await checkins.add(checkin({ id: 'b', ts: 2000, domain: 'money' }));
    await checkins.add(checkin({ id: 'c', ts: 3000, result: 'd5' }));

    expect((await checkins.list()).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect((await checkins.list({ from: 1500, to: 2500 })).map((c) => c.id)).toEqual(['b']);
    expect((await checkins.latest(2)).map((c) => c.id)).toEqual(['c', 'b']);
    expect(await checkins.count()).toBe(3);

    const updated = await checkins.update('a', { note: 'אחרי ישיבה' });
    expect(updated?.note).toBe('אחרי ישיבה');
    expect(await checkins.update('missing', { note: 'x' })).toBeUndefined();

    await checkins.remove('a');
    expect(await checkins.get('a')).toBeUndefined();
  });

  it('id ו-ts נקבעים אוטומטית', async () => {
    const { checkins } = createRepositories(freshDb());
    const before = Date.now();
    const saved = await checkins.add(checkin());
    expect(saved.id).toMatch(/.{8,}/);
    expect(saved.ts).toBeGreaterThanOrEqual(before);
  });

  it('רשומה לא תקינה נדחית לפני הכתיבה', async () => {
    const { checkins } = createRepositories(freshDb());
    await expect(checkins.add(checkin({ domain: 'nope' as never }))).rejects.toThrow();
    expect(await checkins.count()).toBe(0);
  });

  it('אבחון: האחרון לפי מי שענה', async () => {
    const { diagnoses } = createRepositories(freshDb());
    await diagnoses.add(diagnosis({ id: 's1', ts: 1000, weekMarker: 0 }));
    await diagnoses.add(diagnosis({ id: 'o1', ts: 2000, by: 'other', otherName: 'מיכל' }));
    await diagnoses.add(diagnosis({ id: 's2', ts: 3000, weekMarker: 4 }));
    expect((await diagnoses.latestBy('self'))?.id).toBe('s2');
    expect((await diagnoses.latestBy('other'))?.otherName).toBe('מיכל');
  });

  it('יומן ערב: רשומה אחת לכל תאריך, ועד שלושה אירועים', async () => {
    const { evenings } = createRepositories(freshDb());
    const event = { what: 'ויכוח', body: 'לחץ בחזה', did: 'יצאתי להליכה', recoveryMin: 40, dim: 'd3' as const };

    const first = await evenings.saveForDate('2026-09-21', [event]);
    const second = await evenings.saveForDate('2026-09-21', [event, { ...event, recoveryMin: 10, dim: 'd4' }]);

    expect(second.id).toBe(first.id);
    expect(await evenings.count()).toBe(1);
    expect((await evenings.getByDate('2026-09-21'))?.events).toHaveLength(2);
    await expect(evenings.saveForDate('2026-09-22', [event, event, event, event])).rejects.toThrow();
  });

  it('מסע: ברירת מחדל, עדכון, וסימון יום בלי לדרוס את מה שכבר סומן', async () => {
    const { journey } = createRepositories(freshDb());
    expect(await journey.get()).toMatchObject({ currentWeek: 0, mode: 'program', startedAt: null });

    await journey.update({ startedAt: 5000, currentWeek: 1, focusDomain: 'time' });
    await journey.markDay('2026-09-21', { practice: true });
    const state = await journey.markDay('2026-09-21', { lifeTask: true });

    expect(state.days['2026-09-21']).toEqual({ practice: true, lifeTask: true });
    expect(state.focusDomain).toBe('time');
  });

  it('הגדרות: ברירות מחדל, ועדכון חלקי שממזג עוגנים וצלילים', async () => {
    const { settings } = createRepositories(freshDb());
    expect(await settings.get()).toEqual(defaultSettings());

    await settings.update({ theme: 'light', anchors: { wake: '06:15' } as never, sound: { ui: 0.2 } as never });
    const saved = await settings.get();
    expect(saved.theme).toBe('light');
    expect(saved.anchors.wake).toBe('06:15');
    expect(saved.anchors.home).toBe(DEFAULT_ANCHOR_TIMES.home);
    expect(saved.sound).toMatchObject({ ui: 0.2, haptics: true });
  });

  it('שעות העוגנים תואמות לחבילת התוכן', () => {
    const fromContent = Object.fromEntries(loadContent().checkin.anchors.map((a) => [a.id, a.defaultTime]));
    expect(DEFAULT_ANCHOR_TIMES).toEqual(fromContent);
  });

  it('טיוטות: שמירה, טעינה וניקוי', async () => {
    const { drafts } = createRepositories(freshDb());
    await drafts.save('checkin', { step: 3, answers: { contraction: 6 } });
    expect((await drafts.load<{ step: number }>('checkin'))?.data.step).toBe(3);
    await drafts.clear('checkin');
    expect(await drafts.load('checkin')).toBeUndefined();
  });
});

describe('גיבוי', () => {
  async function seeded(): Promise<CompassDb> {
    const db = freshDb();
    const repos = createRepositories(db);
    await repos.checkins.add(checkin({ id: 'c1', ts: 1000, withWhom: ['צוות'], anchor: 'wake' }));
    await repos.checkins.add(checkin({ id: 'c2', ts: 2000, quick: true, answers: {}, chips: [] }));
    await repos.diagnoses.add(diagnosis({ id: 'd1', ts: 1500, weekMarker: 0 }));
    await repos.sessions.add({ id: 's1', ts: 1600, toolId: 'heart-drop', source: 'shift', before: 'd4', after: 'd5', completed: true });
    await repos.forms.add({ id: 'f1', ts: 1700, kind: 'belief-inquiry', fields: { belief: 'אין לי זמן' }, completed: false });
    await repos.metrics.add({ id: 'm1', ts: 1800, weekMarker: 0, sleepQuality: 6, quietMinutes: 5 });
    await repos.evenings.saveForDate('2026-09-21', [{ what: 'א', body: 'ב', did: 'ג', recoveryMin: 15, dim: 'd4' }]);
    await repos.journey.update({ startedAt: 900, currentWeek: 2, focusDomain: 'money' });
    await repos.settings.update({ theme: 'dark', userName: 'דודו', onboarded: true });
    await repos.drafts.save('checkin', { step: 2 });
    return db;
  }

  it('ייצוא → מחיקה → ייבוא = זהות', async () => {
    const source = await seeded();
    const backup = await exportBackup(source, new Date('2026-09-21T10:00:00Z'));
    expect(backup).toMatchObject({ app: 'dimension-compass', schemaVersion: CURRENT_SCHEMA_VERSION });

    // דרך JSON, כמו קובץ אמיתי — ואל מסד אחר, כמו מכשיר חדש.
    const target = freshDb();
    const result = await importBackupText(target, JSON.stringify(backup));
    expect(result.ok).toBe(true);

    const again = await exportBackup(target, new Date('2026-09-21T10:00:00Z'));
    expect(again).toEqual(backup);
  });

  it('טיוטות אינן נכללות בגיבוי', async () => {
    const backup = await exportBackup(await seeded());
    expect(Object.keys(backup.tables)).not.toContain('drafts');
  });

  it('ייבוא מחליף את הנתונים הקיימים', async () => {
    const backup = await exportBackup(await seeded());
    const target = freshDb();
    const repos = createRepositories(target);
    await repos.checkins.add(checkin({ id: 'old', ts: 1 }));
    await repos.drafts.save('checkin', { step: 9 });

    await importBackup(target, backup);
    expect((await repos.checkins.list()).map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(await repos.drafts.load('checkin')).toBeUndefined();
  });

  it('קובץ פגום נדחה, והנתונים הקיימים לא משתנים', async () => {
    const db = await seeded();
    const backup = await exportBackup(db);
    const broken = structuredClone(backup) as unknown as { tables: { checkins: Array<Record<string, unknown>> } };
    broken.tables.checkins[1]!.domain = 'לא-תחום';

    const result = await importBackup(db, broken);
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain('checkins');
    expect(await createRepositories(db).checkins.count()).toBe(2);
  });

  it('קובץ זר, JSON שבור וגיבוי מגרסה חדשה יותר — הודעה ברורה', async () => {
    const db = freshDb();
    const backup = await exportBackup(db);

    const foreign = await importBackup(db, { app: 'other' });
    const garbage = await importBackupText(db, '{not json');
    const newer = await importBackup(db, { ...backup, schemaVersion: CURRENT_SCHEMA_VERSION + 1 });

    expect(!foreign.ok && foreign.error).toContain('לא קובץ גיבוי');
    expect(!garbage.ok && garbage.error).toContain('JSON');
    expect(!newer.ok && newer.error).toContain('חדשה יותר');
  });

  it('גיבוי מגרסה ישנה עובר התאמה לפני האימות', async () => {
    const db = freshDb();
    const backup = await exportBackup(await seeded());
    const old = structuredClone(backup) as unknown as { schemaVersion: number; tables: Record<string, Array<Record<string, unknown>>> };
    old.schemaVersion = 0.5 as never; // לא תקין — נדחה
    expect((await importBackup(db, old)).ok).toBe(false);

    // מדמים גרסה עתידית: גיבוי "ישן" שבו השדה נקרא בשם אחר, וצעד התאמה שמתקן אותו.
    const legacy = structuredClone(backup) as unknown as typeof old;
    legacy.tables.checkins!.forEach((row) => {
      row.area = row.domain;
      delete row.domain;
    });
    expect((await importBackup(db, legacy)).ok).toBe(false);

    const { parseBackup } = await import('../../src/domain/backup');
    BACKUP_MIGRATIONS[CURRENT_SCHEMA_VERSION] = (tables) => ({
      ...tables,
      checkins: (tables.checkins as Array<Record<string, unknown>>).map(({ area, ...rest }) => ({ ...rest, domain: area })),
    });
    try {
      const parsed = parseBackup(legacy, CURRENT_SCHEMA_VERSION + 1);
      expect(parsed.ok && parsed.value.tables.checkins[0]?.domain).toBe('work');
    } finally {
      delete BACKUP_MIGRATIONS[CURRENT_SCHEMA_VERSION];
    }
  });

  it('מחיקת הכול מרוקנת את כל הטבלאות', async () => {
    const db = await seeded();
    await wipeAll(db);
    for (const table of db.tables) expect(await table.count(), table.name).toBe(0);
  });

  it('שם קובץ הגיבוי כולל תאריך מקומי', () => {
    expect(backupFileName(new Date(2026, 8, 5))).toBe('dimension-compass-2026-09-05.json');
  });
});
