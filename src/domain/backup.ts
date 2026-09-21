/**
 * מבנה קובץ הגיבוי ואימותו — לוגיקה טהורה. הקריאה והכתיבה ל-IndexedDB נמצאות ב-data/backup.ts.
 * הקובץ הוא JSON קריא; הכול נשאר אצל המשתמש (SPEC 6.13).
 */
import { BACKUP_TABLES, RECORD_SCHEMAS, type BackupTableName, type RecordTypes } from './records';
import { fail, ok, type Result } from './result';

export const BACKUP_APP_ID = 'dimension-compass';
export const BACKUP_FORMAT_VERSION = 1;

export type BackupTables = { [K in BackupTableName]: RecordTypes[K][] };

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  /** גרסת סכמת הנתונים (Dexie) שממנה יוצא הגיבוי. */
  schemaVersion: number;
  exportedAt: string;
  tables: BackupTables;
}

/**
 * התאמת גיבוי מגרסת סכמה ישנה לגרסה הנוכחית. המפתח הוא הגרסה שממנה משדרגים.
 * כל שינוי סכמה ב-data/db.ts שמשנה צורת רשומה חייב לקבל כאן צעד מקביל.
 */
type TablesMigration = (tables: Record<string, unknown[]>) => Record<string, unknown[]>;
export const BACKUP_MIGRATIONS: Record<number, TablesMigration> = {};

export function buildBackup(tables: BackupTables, schemaVersion: number, now: Date): BackupFile {
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion,
    exportedAt: now.toISOString(),
    tables,
  };
}

export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `dimension-compass-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function countRecords(tables: BackupTables): number {
  return BACKUP_TABLES.reduce((sum, name) => sum + tables[name].length, 0);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** מאמת קובץ גיבוי שנקרא מהדיסק, ומשדרג אותו לגרסת הסכמה הנוכחית. שגיאות מנוסחות למשתמש. */
export function parseBackup(json: unknown, currentSchemaVersion: number): Result<BackupFile> {
  if (!isObject(json) || json.app !== BACKUP_APP_ID) {
    return fail('זה לא קובץ גיבוי של מצפן המימדים.');
  }
  if (json.formatVersion !== BACKUP_FORMAT_VERSION) {
    return fail('פורמט הגיבוי אינו נתמך בגרסה הזו של האפליקציה.');
  }
  const { schemaVersion } = json;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return fail('קובץ הגיבוי פגום: חסרה גרסת נתונים.');
  }
  if (schemaVersion > currentSchemaVersion) {
    return fail('הגיבוי נוצר בגרסה חדשה יותר של האפליקציה. עדכן את האפליקציה ונסה שוב.');
  }
  if (!isObject(json.tables)) {
    return fail('קובץ הגיבוי פגום: חסרים הנתונים.');
  }

  let raw: Record<string, unknown[]> = {};
  for (const [name, rows] of Object.entries(json.tables)) {
    if (!Array.isArray(rows)) return fail(`קובץ הגיבוי פגום: הטבלה ${name} אינה רשימה.`);
    raw[name] = rows;
  }
  for (let version = schemaVersion; version < currentSchemaVersion; version++) {
    const migrate = BACKUP_MIGRATIONS[version];
    if (migrate) raw = migrate(raw);
  }

  const tables = {} as Record<BackupTableName, unknown[]>;
  for (const name of BACKUP_TABLES) {
    const rows = raw[name] ?? [];
    const parsed: unknown[] = [];
    for (const [index, row] of rows.entries()) {
      const result = RECORD_SCHEMAS[name].safeParse(row);
      if (!result.success) {
        const where = result.error.issues[0]?.path.join('.') || 'רשומה';
        return fail(`קובץ הגיבוי פגום: ${name}, רשומה ${index + 1} (${where}).`);
      }
      parsed.push(result.data);
    }
    tables[name] = parsed;
  }
  if (tables.journey.length > 1 || tables.settings.length > 1) {
    return fail('קובץ הגיבוי פגום: יותר מרשומת הגדרות או מסע אחת.');
  }

  return ok({
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: currentSchemaVersion,
    exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : new Date(0).toISOString(),
    tables: tables as BackupTables,
  });
}
