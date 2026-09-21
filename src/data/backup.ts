/**
 * גיבוי: ייצוא וייבוא של כל הנתונים, ומחיקת הכול (SPEC 6.13).
 * הייבוא אטומי — אם משהו נכשל, הנתונים הקיימים נשארים כפי שהיו.
 */
import { buildBackup, parseBackup, type BackupFile, type BackupTables } from '../domain/backup';
import { BACKUP_TABLES } from '../domain/records';
import { fail, ok, type Result } from '../domain/result';
import { CURRENT_SCHEMA_VERSION, type CompassDb } from './db';

export async function exportBackup(db: CompassDb, now: Date = new Date()): Promise<BackupFile> {
  const tables = {} as Record<string, unknown[]>;
  await db.transaction('r', db.tables, async () => {
    for (const name of BACKUP_TABLES) {
      tables[name] = await db.table(name).toArray();
    }
  });
  return buildBackup(tables as BackupTables, CURRENT_SCHEMA_VERSION, now);
}

/** מחליף את כל הנתונים בתוכן הגיבוי. */
export async function importBackup(db: CompassDb, json: unknown): Promise<Result<BackupFile>> {
  const parsed = parseBackup(json, CURRENT_SCHEMA_VERSION);
  if (!parsed.ok) return parsed;

  try {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear();
      for (const name of BACKUP_TABLES) {
        await db.table(name).bulkAdd(parsed.value.tables[name]);
      }
    });
  } catch {
    return fail('הייבוא נכשל. הנתונים הקיימים לא השתנו.');
  }
  return ok(parsed.value);
}

export async function importBackupText(db: CompassDb, text: string): Promise<Result<BackupFile>> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail('הקובץ אינו JSON תקין.');
  }
  return importBackup(db, json);
}

/** מחיקת כל הנתונים, כולל טיוטות. */
export async function wipeAll(db: CompassDb): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}

export async function countByTable(db: CompassDb): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const name of BACKUP_TABLES) counts[name] = await db.table(name).count();
  return counts;
}
