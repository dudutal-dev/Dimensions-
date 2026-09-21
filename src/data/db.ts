/**
 * מסד הנתונים המקומי (Dexie / IndexedDB). הכול נשאר במכשיר — אין שרת (SPEC עיקרון 6).
 *
 * גרסאות סכמה: כל שינוי מוסיף רשומה ל-SCHEMA_VERSIONS — לעולם לא עורכים גרסה שכבר יצאה.
 *   - שינוי אינדקסים בלבד: stores חדש.
 *   - שינוי בצורת רשומה: גם upgrade שממיר את הנתונים הקיימים,
 *     וגם צעד מקביל ב-BACKUP_MIGRATIONS (domain/backup.ts) כדי שגיבויים ישנים ימשיכו להיטען.
 */
import Dexie, { type EntityTable, type Table, type Transaction } from 'dexie';
import type {
  CheckIn,
  Diagnosis,
  Draft,
  EveningEntry,
  GuidedForm,
  JourneyState,
  MetricsEntry,
  SessionLog,
  Settings,
} from '../domain/records';

export interface SchemaVersion {
  version: number;
  /** הגדרת האינדקסים בתחביר Dexie. null = מחיקת טבלה. */
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => PromiseLike<unknown> | void;
}

export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      checkins: 'id, ts, domain, result, anchor',
      diagnoses: 'id, ts, by, weekMarker',
      sessions: 'id, ts, toolId, source, trigger, domain',
      evenings: 'id, &date, ts',
      forms: 'id, ts, kind',
      metrics: 'id, ts, weekMarker',
      journey: 'id',
      settings: 'id',
      drafts: 'key, updatedAt',
    },
  },
];

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1]!.version;
export const DB_NAME = 'dimension-compass';

export class CompassDb extends Dexie {
  checkins!: EntityTable<CheckIn, 'id'>;
  diagnoses!: EntityTable<Diagnosis, 'id'>;
  sessions!: EntityTable<SessionLog, 'id'>;
  evenings!: EntityTable<EveningEntry, 'id'>;
  forms!: EntityTable<GuidedForm, 'id'>;
  metrics!: EntityTable<MetricsEntry, 'id'>;
  journey!: EntityTable<JourneyState, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  drafts!: Table<Draft, string>;

  constructor(name: string = DB_NAME, versions: readonly SchemaVersion[] = SCHEMA_VERSIONS) {
    super(name);
    for (const { version, stores, upgrade } of versions) {
      const v = this.version(version).stores(stores);
      if (upgrade) v.upgrade(upgrade);
    }
  }
}

/** המסד של האפליקציה. בבדיקות יוצרים מופע נפרד עם שם אחר. */
export const db = new CompassDb();
