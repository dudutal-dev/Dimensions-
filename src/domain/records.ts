/**
 * הרשומות שהאפליקציה שומרת (SPEC פרק 7) — סכמות Zod, והטיפוסים נגזרים מהן.
 * מקור אמת אחד: אותה סכמה מגדירה את הטיפוס, ומאמתת קובץ גיבוי בייבוא.
 * domain/ טהור: בלי React ובלי Dexie.
 */
import { z } from 'zod';
import { CheckinResultSchema, DiagDomainSchema, DimSchema, DomainSchema } from '../content/schema';

const Id = z.string().min(1);
const Timestamp = z.number().int().nonnegative();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך בצורת YYYY-MM-DD');
const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'שעה בצורת HH:MM');
const Volume = z.number().min(0).max(1);

const DimScores = z.object({ d3: z.number(), d4: z.number(), d5: z.number() }).strict();

export const ANCHOR_IDS = ['wake', 'before-first-meeting', 'after-lunch', 'home', 'before-sleep'] as const;
export const AnchorIdSchema = z.enum(ANCHOR_IDS);
export type AnchorId = z.infer<typeof AnchorIdSchema>;

export const WeekMarkerSchema = z.union([z.literal(0), z.literal(4), z.literal(8), z.literal(12)]);
export type WeekMarker = z.infer<typeof WeekMarkerSchema>;

// ---------- בדיקת מימד ----------

export const CheckInSchema = z
  .object({
    id: Id,
    ts: Timestamp,
    anchor: AnchorIdSchema.optional(),
    /** questionId → מזהה האפשרות שנבחרה, או ערך הסולם. ריק ברישום מהיר. */
    answers: z.record(z.string(), z.union([z.string(), z.number()])),
    /** צ'יפים שנבחרו (למשל מיקום הכיווץ) — לרישום בלבד. */
    chips: z.array(z.string()),
    scores: DimScores,
    result: CheckinResultSchema,
    domain: DomainSchema,
    withWhom: z.array(z.string()).optional(),
    note: z.string().optional(),
    quick: z.boolean(),
  })
  .strict();
export type CheckIn = z.infer<typeof CheckInSchema>;

// ---------- אבחון מלא ----------

export const DiagnosisSchema = z
  .object({
    id: Id,
    ts: Timestamp,
    by: z.enum(['self', 'other']),
    /** מי ענה, כשזה אדם קרוב. */
    otherName: z.string().optional(),
    answers: z.record(z.string().regex(/^q\d{2}$/), DimSchema),
    overall: DimScores,
    byDomain: z.record(DiagDomainSchema, DimScores),
    weekMarker: WeekMarkerSchema.optional(),
  })
  .strict();
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

// ---------- סשנים ----------

export const SessionLogSchema = z
  .object({
    id: Id,
    ts: Timestamp,
    /** מזהה כלי, תרגיל או פרוטוקול טריגר. */
    toolId: z.string().min(1),
    source: z.enum(['shift', 'journey', 'sos']),
    before: DimSchema.optional(),
    after: DimSchema.optional(),
    trigger: z.string().optional(),
    domain: DomainSchema.optional(),
    completed: z.boolean(),
    note: z.string().optional(),
  })
  .strict();
export type SessionLog = z.infer<typeof SessionLogSchema>;

// ---------- יומן ערב ----------

export const EveningEventSchema = z
  .object({
    what: z.string(),
    body: z.string(),
    did: z.string(),
    /** זמן עד חזרה לאיזון, בדקות — המדד המרכזי. */
    recoveryMin: z.number().nonnegative(),
    dim: DimSchema,
  })
  .strict();
export type EveningEvent = z.infer<typeof EveningEventSchema>;

export const MAX_EVENING_EVENTS = 3;

export const EveningEntrySchema = z
  .object({
    id: Id,
    /** רשומה אחת לכל תאריך. */
    date: IsoDate,
    ts: Timestamp,
    events: z.array(EveningEventSchema).max(MAX_EVENING_EVENTS),
  })
  .strict();
export type EveningEntry = z.infer<typeof EveningEntrySchema>;

// ---------- טפסים מודרכים ----------

export const GuidedFormSchema = z
  .object({
    id: Id,
    ts: Timestamp,
    kind: z.enum(['trigger-journal', 'belief-inquiry', 'shadow-321', 'forgiveness']),
    fields: z.record(z.string(), z.string()),
    completed: z.boolean(),
  })
  .strict();
export type GuidedForm = z.infer<typeof GuidedFormSchema>;

// ---------- מדדי בסיס ונקודות בדיקה (שבוע 0 / 4 / 8 / 12) ----------

export const MetricsEntrySchema = z
  .object({
    id: Id,
    ts: Timestamp,
    weekMarker: WeekMarkerSchema.optional(),
    recoveryMin: z.number().nonnegative().optional(),
    quietMinutes: z.number().nonnegative().optional(),
    sleepQuality: z.number().min(1).max(10).optional(),
    leisureScreenHours: z.number().nonnegative().optional(),
  })
  .strict();
export type MetricsEntry = z.infer<typeof MetricsEntrySchema>;

// ---------- מסע ----------

export const JOURNEY_ID = 'journey';

export const JourneyStateSchema = z
  .object({
    id: z.literal(JOURNEY_ID),
    startedAt: Timestamp.nullable(),
    currentWeek: z.number().int().min(0).max(12),
    focusDomain: DomainSchema.optional(),
    days: z.record(IsoDate, z.object({ practice: z.boolean(), lifeTask: z.boolean() }).strict()),
    weeklyReflections: z.record(z.string().regex(/^\d{1,2}$/), z.string()),
    mode: z.enum(['program', 'maintenance']),
  })
  .strict();
export type JourneyState = z.infer<typeof JourneyStateSchema>;

// ---------- הגדרות ----------

export const SETTINGS_ID = 'settings';
export const TEXT_SCALES = [0.9, 1, 1.12, 1.25] as const;

export const SettingsSchema = z
  .object({
    id: z.literal(SETTINGS_ID),
    theme: z.enum(['system', 'dark', 'light']),
    textScale: z.union([z.literal(0.9), z.literal(1), z.literal(1.12), z.literal(1.25)]),
    /** השם שמופיע בשאלון "שאל אדם קרוב". */
    userName: z.string().optional(),
    anchors: z
      .object({
        wake: ClockTime,
        'before-first-meeting': ClockTime,
        'after-lunch': ClockTime,
        home: ClockTime,
        'before-sleep': ClockTime,
      })
      .strict(),
    sound: z
      .object({
        ui: Volume,
        ambient: Volume,
        ambientOn: z.boolean(),
        haptics: z.boolean(),
      })
      .strict(),
    /** שלב ב' — הדרכה קולית. */
    voice: z
      .object({
        lang: z.enum(['he', 'en', 'none']),
        volume: Volume,
        showText: z.boolean(),
      })
      .strict()
      .optional(),
    /** ברירת המחדל של מצב "עיניים עצומות" בנגן. */
    eyesClosed: z.boolean().optional(),
    onboarded: z.boolean(),
    /** מתי יוצא גיבוי בפעם האחרונה — לתזכורת עדינה במסך הגיבוי. */
    lastBackupAt: Timestamp.optional(),
  })
  .strict();
export type Settings = z.infer<typeof SettingsSchema>;
/** עדכון חלקי: עוגנים וצלילים ממוזגים שדה-שדה. */
export type SettingsPatch = Partial<Omit<Settings, 'id' | 'anchors' | 'sound'>> & {
  anchors?: Partial<Settings['anchors']>;
  sound?: Partial<Settings['sound']>;
};
export type ThemeChoice = Settings['theme'];
export type TextScale = Settings['textScale'];

// ---------- טיוטות (לא נכללות בגיבוי) ----------

export interface Draft<T = unknown> {
  /** למשל 'checkin', 'diagnosis:self', 'form:belief-inquiry'. */
  key: string;
  updatedAt: number;
  data: T;
}

// ---------- מפת הטבלאות ----------

/** הטבלאות שנכללות בגיבוי, עם הסכמה של כל רשומה. */
export const RECORD_SCHEMAS = {
  checkins: CheckInSchema,
  diagnoses: DiagnosisSchema,
  sessions: SessionLogSchema,
  evenings: EveningEntrySchema,
  forms: GuidedFormSchema,
  metrics: MetricsEntrySchema,
  journey: JourneyStateSchema,
  settings: SettingsSchema,
} as const;

export type BackupTableName = keyof typeof RECORD_SCHEMAS;
export const BACKUP_TABLES = Object.keys(RECORD_SCHEMAS) as BackupTableName[];

export interface RecordTypes {
  checkins: CheckIn;
  diagnoses: Diagnosis;
  sessions: SessionLog;
  evenings: EveningEntry;
  forms: GuidedForm;
  metrics: MetricsEntry;
  journey: JourneyState;
  settings: Settings;
}
