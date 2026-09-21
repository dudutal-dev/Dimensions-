/**
 * Repositories — השכבה היחידה שנוגעת בטבלאות. המסכים לא מדברים עם Dexie ישירות.
 * כל רשומה מאומתת מול הסכמה שלה לפני הכתיבה, כך שמה שנשמר תמיד ניתן לגיבוי ולשחזור.
 * createRepositories מקבל מסד נתונים — בבדיקות מזריקים מסד נפרד.
 */
import type { EntityTable } from 'dexie';
import type { ZodType } from 'zod';
import { defaultJourney, withSettingsDefaults } from '../domain/defaults';
import {
  CheckInSchema,
  DiagnosisSchema,
  EveningEntrySchema,
  GuidedFormSchema,
  JOURNEY_ID,
  JourneyStateSchema,
  MetricsEntrySchema,
  SETTINGS_ID,
  SessionLogSchema,
  SettingsSchema,
  type CheckIn,
  type Diagnosis,
  type Draft,
  type EveningEntry,
  type EveningEvent,
  type GuidedForm,
  type JourneyState,
  type MetricsEntry,
  type SessionLog,
  type Settings,
  type SettingsPatch,
} from '../domain/records';
import { newId } from '../lib/id';
import { db as appDb, type CompassDb } from './db';

interface Timed {
  id: string;
  ts: number;
}

/** רשומה חדשה: id ו-ts אופציונליים — נקבעים אוטומטית. */
export type NewRecord<T extends Timed> = Omit<T, 'id' | 'ts'> & Partial<Timed>;

export interface TimeRange {
  from?: number;
  to?: number;
}

function timeSeriesRepo<T extends Timed>(table: EntityTable<T, 'id'>, schema: ZodType<T>) {
  // Dexie מקשה על טיפוסים גנריים של מפתחות; הטבלה תמיד ממופתחת לפי id מסוג string.
  const t = table as unknown as EntityTable<Timed, 'id'>;

  return {
    async add(input: NewRecord<T>): Promise<T> {
      const record = schema.parse({ ...input, id: input.id ?? newId(), ts: input.ts ?? Date.now() });
      await t.add(record);
      return record;
    },

    async get(id: string): Promise<T | undefined> {
      return (await t.get(id)) as T | undefined;
    },

    async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | undefined> {
      const current = await t.get(id);
      if (!current) return undefined;
      const next = schema.parse({ ...current, ...patch, id });
      await t.put(next);
      return next;
    },

    async remove(id: string): Promise<void> {
      await t.delete(id);
    },

    /** לפי זמן, מהישן לחדש. */
    async list(range: TimeRange = {}): Promise<T[]> {
      const from = range.from ?? 0;
      const to = range.to ?? Number.MAX_SAFE_INTEGER;
      return (await t.where('ts').between(from, to, true, true).toArray()) as T[];
    },

    /** האחרונים, מהחדש לישן. */
    async latest(limit = 1): Promise<T[]> {
      return (await t.orderBy('ts').reverse().limit(limit).toArray()) as T[];
    },

    count(): Promise<number> {
      return t.count();
    },
  };
}

export function createRepositories(db: CompassDb) {
  const checkins = timeSeriesRepo<CheckIn>(db.checkins, CheckInSchema);
  const diagnoses = timeSeriesRepo<Diagnosis>(db.diagnoses, DiagnosisSchema);
  const sessions = timeSeriesRepo<SessionLog>(db.sessions, SessionLogSchema);
  const forms = timeSeriesRepo<GuidedForm>(db.forms, GuidedFormSchema);
  const metrics = timeSeriesRepo<MetricsEntry>(db.metrics, MetricsEntrySchema);
  const eveningsBase = timeSeriesRepo<EveningEntry>(db.evenings, EveningEntrySchema);

  return {
    checkins,
    metrics: {
      ...metrics,
      async byWeekMarker(weekMarker: NonNullable<MetricsEntry['weekMarker']>): Promise<MetricsEntry | undefined> {
        const rows = await db.metrics.where('weekMarker').equals(weekMarker).sortBy('ts');
        return rows[rows.length - 1];
      },
    },

    diagnoses: {
      ...diagnoses,
      async latestBy(by: Diagnosis['by']): Promise<Diagnosis | undefined> {
        const rows = await db.diagnoses.where('by').equals(by).sortBy('ts');
        return rows[rows.length - 1];
      },
    },

    sessions: {
      ...sessions,
      byTool(toolId: string): Promise<SessionLog[]> {
        return db.sessions.where('toolId').equals(toolId).sortBy('ts');
      },
    },

    forms: {
      ...forms,
      byKind(kind: GuidedForm['kind']): Promise<GuidedForm[]> {
        return db.forms.where('kind').equals(kind).sortBy('ts');
      },
    },

    evenings: {
      ...eveningsBase,
      getByDate(date: string): Promise<EveningEntry | undefined> {
        return db.evenings.where('date').equals(date).first();
      },
      /**
       * רשומה אחת לכל תאריך: יוצר אותה או מעדכן את האירועים שלה. בלי אירועים — אין רשומה
       * (ערב ריק לא נספר כערב של יומן). ה-ts הוא צהרי אותו תאריך, כדי שרישום בדיעבד ייכנס לשבוע הנכון.
       */
      async saveForDate(date: string, events: EveningEvent[]): Promise<EveningEntry | undefined> {
        return db.transaction('rw', db.evenings, async () => {
          const existing = await db.evenings.where('date').equals(date).first();
          if (events.length === 0) {
            if (existing) await db.evenings.delete(existing.id);
            return undefined;
          }
          const entry = EveningEntrySchema.parse({
            id: existing?.id ?? newId(),
            date,
            ts: existing?.ts ?? new Date(`${date}T12:00:00`).getTime(),
            events,
          });
          await db.evenings.put(entry);
          return entry;
        });
      },
    },

    journey: {
      async get(): Promise<JourneyState> {
        return (await db.journey.get(JOURNEY_ID)) ?? defaultJourney();
      },
      async update(patch: Partial<Omit<JourneyState, 'id'>>): Promise<JourneyState> {
        return db.transaction('rw', db.journey, async () => {
          const current = (await db.journey.get(JOURNEY_ID)) ?? defaultJourney();
          const next = JourneyStateSchema.parse({ ...current, ...patch, id: JOURNEY_ID });
          await db.journey.put(next);
          return next;
        });
      },
      /** שמירת מצב מלא — התוצאה של פונקציות המעבר ב-domain/journey.ts. */
      async save(state: JourneyState): Promise<JourneyState> {
        const next = JourneyStateSchema.parse({ ...state, id: JOURNEY_ID });
        await db.journey.put(next);
        return next;
      },
      /** סימון ביצוע יומי. יום שלא סומן פשוט לא קיים — אין "החמצה" (SPEC 6.7). */
      async markDay(date: string, patch: Partial<JourneyState['days'][string]>): Promise<JourneyState> {
        return db.transaction('rw', db.journey, async () => {
          const current = (await db.journey.get(JOURNEY_ID)) ?? defaultJourney();
          const day = { practice: false, lifeTask: false, ...current.days[date], ...patch };
          const next = JourneyStateSchema.parse({ ...current, days: { ...current.days, [date]: day } });
          await db.journey.put(next);
          return next;
        });
      },
    },

    settings: {
      async get(): Promise<Settings> {
        return withSettingsDefaults(await db.settings.get(SETTINGS_ID));
      },
      async update(patch: SettingsPatch): Promise<Settings> {
        return db.transaction('rw', db.settings, async () => {
          const current = withSettingsDefaults(await db.settings.get(SETTINGS_ID));
          const next = SettingsSchema.parse({
            ...current,
            ...patch,
            id: SETTINGS_ID,
            anchors: { ...current.anchors, ...patch.anchors },
            sound: { ...current.sound, ...patch.sound },
          });
          await db.settings.put(next);
          return next;
        });
      },
    },

    /** טיוטות של זרימות באמצע (בדיקה, אבחון, טפסים) — כדי שסגירת הלשונית לא תאבד דבר. */
    drafts: {
      async save<T>(key: string, data: T): Promise<void> {
        await db.drafts.put({ key, updatedAt: Date.now(), data });
      },
      async load<T>(key: string): Promise<Draft<T> | undefined> {
        return (await db.drafts.get(key)) as Draft<T> | undefined;
      },
      async clear(key: string): Promise<void> {
        await db.drafts.delete(key);
      },
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export const repos: Repositories = createRepositories(appDb);
