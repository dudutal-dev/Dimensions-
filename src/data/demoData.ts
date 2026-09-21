/**
 * נתוני דמה לבדיקת התובנות (קבלת M8). שישה שבועות של בדיקות, יומן ערב, תרגולים ואבחונים,
 * עם דפוס מכוון: 3D בזמן ובזוגיות, 5D בעבודה וביצירה ("מקצוען-על"), ושיפור הדרגתי לאורך הזמן.
 * כל הרשומות מזוהות ב-id שמתחיל ב-"demo-" — כך אפשר למחוק אותן בלי לגעת בנתונים אמיתיים.
 */
import { loadContent } from '../content';
import type { CheckinResult, Dim, Domain } from '../content/schema';
import { primaryDim } from '../domain/checkin-scoring';
import { scoreDiagnosis, type DiagAnswers } from '../domain/diagnosis-scoring';
import { isoDate } from '../domain/journey';
import { RECORD_SCHEMAS, type AnchorId, type CheckIn, type Diagnosis, type EveningEntry, type SessionLog } from '../domain/records';
import { db as appDb, type CompassDb } from './db';

const PREFIX = 'demo-';
const DAY = 24 * 3_600_000;
const DAYS = 42;

/** מחולל פסאודו-אקראי קבוע — אותם נתונים בכל הרצה. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOTS: Array<{ anchor: AnchorId; hour: number; domain: Domain; base: Dim }> = [
  { anchor: 'wake', hour: 7, domain: 'time', base: 'd3' },
  { anchor: 'before-first-meeting', hour: 9, domain: 'work', base: 'd5' },
  { anchor: 'after-lunch', hour: 14, domain: 'creation', base: 'd5' },
  { anchor: 'home', hour: 19, domain: 'couple', base: 'd3' },
  { anchor: 'before-sleep', hour: 22, domain: 'alone', base: 'd4' },
];

const SCORES: Record<CheckinResult, Record<Dim, number>> = {
  d3: { d3: 0.7, d4: 0.2, d5: 0.1 },
  'd3-d4': { d3: 0.45, d4: 0.45, d5: 0.1 },
  d4: { d3: 0.15, d4: 0.7, d5: 0.15 },
  'd4-d5': { d3: 0.1, d4: 0.45, d5: 0.45 },
  d5: { d3: 0.1, d4: 0.2, d5: 0.7 },
};

/** הדפוס נשמר (3D בזמן ובזוגיות, 5D בעבודה וביצירה), ועם הזמן יש יותר מעברים כלפי מעלה. */
function resultFor(base: Dim, progress: number, r: number): CheckinResult {
  if (base === 'd5') return r < 0.65 + progress * 0.3 ? 'd5' : 'd4-d5';
  if (base === 'd4') return r < progress * 0.6 ? 'd5' : r < 0.85 ? 'd4' : 'd4-d5';
  return r < 0.85 - progress * 0.3 ? 'd3' : r < 0.95 ? 'd3-d4' : 'd4';
}

/** בונה את הרשומות בזיכרון וכותב אותן בטרנזקציה אחת — המסכים רואים הכול או כלום. */
export async function loadDemoData(db: CompassDb = appDb, now: number = Date.now()): Promise<number> {
  const content = loadContent();
  const random = seeded(7);
  const start = new Date(now - DAYS * DAY);
  start.setHours(0, 0, 0, 0);
  // יש רשומה אחת לכל תאריך — ערב אמיתי שכבר נרשם נשאר כמו שהוא.
  const realEvenings = new Set((await db.evenings.toArray()).filter((e) => !e.id.startsWith(PREFIX)).map((e) => e.date));

  const checkins: CheckIn[] = [];
  const evenings: EveningEntry[] = [];
  const sessions: SessionLog[] = [];
  const diagnoses: Diagnosis[] = [];

  for (let day = 0; day < DAYS; day++) {
    const progress = day / DAYS; // 0 → 1: ככל שמתקדמים, יותר מעברים כלפי מעלה
    const date = new Date(start.getTime() + day * DAY);

    for (const slot of SLOTS) {
      if (random() < 0.25) continue; // לא כל עוגן נרשם — וזה בסדר
      const result = resultFor(slot.base, progress, random());
      const dim = primaryDim(result);
      checkins.push({
        id: `${PREFIX}c-${day}-${slot.anchor}`,
        ts: date.getTime() + slot.hour * 3_600_000 + Math.floor(random() * 1_800_000),
        anchor: slot.anchor,
        answers: dim === 'd3' ? { 'thought-topic': slot.domain === 'time' ? 'threat' : 'blame', contraction: 7 } : {},
        chips: [],
        scores: SCORES[result],
        result,
        domain: slot.domain,
        quick: dim !== 'd3',
      });
    }

    const writesEvening = random() < 0.8;
    const recovery = Math.round(200 - progress * 150 + random() * 40);
    if (writesEvening && !realEvenings.has(isoDate(date))) {
      const early = progress < 0.5;
      evenings.push({
        id: `${PREFIX}e-${day}`,
        date: isoDate(date),
        ts: date.getTime() + 12 * 3_600_000,
        events: [
          {
            what: early ? 'הישיבה התארכה ואני חייב להספיק הכול. תמיד זה קורה לי, אין לי זמן.' : 'הישיבה התארכה. כרגע זה מה שיש, וגם זה בסדר. בחרתי מה נדרש.',
            body: early ? 'כתפיים מכווצות, לחץ בחזה' : 'נשימה גבוהה שנרגעה',
            did: early ? 'המשכתי לעבוד בלחץ' : 'שלוש נשימות, ואז צעד אחד',
            recoveryMin: recovery,
            dim: early ? 'd3' : 'd4',
          },
        ],
      });
    }

    if (day % 2 === 0) {
      const tools: Array<Pick<SessionLog, 'toolId' | 'before' | 'after' | 'domain' | 'trigger'>> = [
        { toolId: 'labeling', before: 'd3', after: random() < 0.5 ? 'd5' : 'd4', domain: 'time', trigger: 'trg-overload' },
        { toolId: 'double-exhale', before: 'd3', after: 'd4', domain: 'couple', trigger: 'trg-criticism' },
        { toolId: 'heart-drop', before: 'd4', after: 'd5', domain: 'alone' },
      ];
      sessions.push({ id: `${PREFIX}s-${day}`, ts: date.getTime() + 20 * 3_600_000, source: 'shift', completed: true, ...tools[(day / 2) % tools.length]! });
    }
  }

  const answers = (d3Until: number, d5From: number): DiagAnswers =>
    Object.fromEntries(content.diagnosis.questions.map((q, i) => [q.id, i < d3Until ? 'd3' : i >= d5From ? 'd5' : 'd4']));
  for (const [index, spec] of [answers(6, 10), answers(3, 8)].entries()) {
    diagnoses.push({
      id: `${PREFIX}d-${index}`,
      ts: start.getTime() + index * 28 * DAY,
      by: 'self',
      answers: spec,
      ...scoreDiagnosis(content.diagnosis, spec),
      weekMarker: index === 0 ? 0 : 4,
    });
  }

  // אותה ולידציה כמו בכל כתיבה אחרת — נתוני הדמה חייבים להיות רשומות תקינות.
  const valid = {
    checkins: checkins.map((r) => RECORD_SCHEMAS.checkins.parse(r)),
    evenings: evenings.map((r) => RECORD_SCHEMAS.evenings.parse(r)),
    sessions: sessions.map((r) => RECORD_SCHEMAS.sessions.parse(r)),
    diagnoses: diagnoses.map((r) => RECORD_SCHEMAS.diagnoses.parse(r)),
  };
  await db.transaction('rw', [db.checkins, db.evenings, db.sessions, db.diagnoses], async () => {
    for (const table of [db.checkins, db.evenings, db.sessions, db.diagnoses]) {
      await table.where('id').startsWith(PREFIX).delete();
    }
    await db.checkins.bulkAdd(valid.checkins);
    await db.evenings.bulkAdd(valid.evenings);
    await db.sessions.bulkAdd(valid.sessions);
    await db.diagnoses.bulkAdd(valid.diagnoses);
  });
  return checkins.length + evenings.length + sessions.length + diagnoses.length;
}

export async function removeDemoData(db: CompassDb = appDb): Promise<void> {
  await db.transaction('rw', [db.checkins, db.evenings, db.sessions, db.diagnoses], async () => {
    for (const table of [db.checkins, db.evenings, db.sessions, db.diagnoses]) {
      await table.where('id').startsWith(PREFIX).delete();
    }
  });
}

export async function hasDemoData(db: CompassDb = appDb): Promise<boolean> {
  return (await db.checkins.where('id').startsWith(PREFIX).count()) > 0;
}
