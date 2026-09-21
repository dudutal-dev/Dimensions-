/**
 * הלוגיקה של מסך "היום" (SPEC 6.2): עוגני היום, המשימה הבאה, ושורת התובנה. טהור — בלי React ובלי Dexie.
 */
import type { Dim, Domain } from '../content/schema';
import { primaryDim } from './checkin-scoring';
import { ANCHOR_IDS, type AnchorId, type CheckIn } from './records';

const MINUTE = 60_000;
/** בדיקה משויכת לעוגן אם נעשתה עד שעה וחצי ממנו. */
const ANCHOR_WINDOW_MIN = 90;
/** עוגן "ממתין" מחצי שעה לפניו ועד שלוש שעות אחריו. אחר כך הוא פשוט עבר — בלי אשמה. */
const DUE_BEFORE_MIN = 30;
const DUE_AFTER_MIN = 180;
export const MIN_CHECKINS_FOR_PATTERNS = 12;

export type AnchorTimes = Record<AnchorId, string>;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function anchorMoment(day: Date, time: string): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime();
}

export interface AnchorStatus {
  id: AnchorId;
  time: string;
  checkin?: CheckIn;
}

/** חמשת עוגני היום, וכל אחד עם הבדיקה שנרשמה לו היום (אם נרשמה). */
export function anchorsForDay(todayCheckins: CheckIn[], times: AnchorTimes): AnchorStatus[] {
  return ANCHOR_IDS.map((id) => ({
    id,
    time: times[id],
    // אם נרשמו כמה בדיקות לאותו עוגן — האחרונה קובעת.
    checkin: [...todayCheckins].reverse().find((c) => c.anchor === id),
  }));
}

/** העוגן הפנוי הקרוב ביותר לשעה הנתונה, אם יש כזה בטווח. */
export function anchorForTime(now: Date, times: AnchorTimes, filled: ReadonlySet<AnchorId>): AnchorId | undefined {
  let best: { id: AnchorId; distance: number } | undefined;
  for (const id of ANCHOR_IDS) {
    if (filled.has(id)) continue;
    const distance = Math.abs(now.getTime() - anchorMoment(now, times[id])) / MINUTE;
    if (distance <= ANCHOR_WINDOW_MIN && (!best || distance < best.distance)) best = { id, distance };
  }
  return best?.id;
}

export type NextTask =
  | { kind: 'checkin'; anchor?: AnchorId }
  | { kind: 'practice' }
  | { kind: 'evening-journal' };

interface NextTaskInput {
  now: Date;
  anchors: AnchorStatus[];
  /** יש תרגול יומי מהמסע שעוד לא סומן (M7). */
  practicePending?: boolean;
  /** יומן הערב זמין ועוד לא מולא היום (M8). */
  eveningJournalPending?: boolean;
}

/** המשימה הבאה — CTA יחיד במסך: עוגן שממתין ← תרגול היום ← יומן ערב ← בדיקה חופשית. */
export function nextTask({ now, anchors, practicePending, eveningJournalPending }: NextTaskInput): NextTask {
  const due = anchors
    .filter((a) => !a.checkin)
    .filter((a) => {
      const sinceMin = (now.getTime() - anchorMoment(now, a.time)) / MINUTE;
      return sinceMin >= -DUE_BEFORE_MIN && sinceMin <= DUE_AFTER_MIN;
    })
    .at(-1);
  if (due) return { kind: 'checkin', anchor: due.id };
  if (practicePending) return { kind: 'practice' };
  if (eveningJournalPending && now.getHours() >= 20) return { kind: 'evening-journal' };
  return { kind: 'checkin' };
}

export type DayPart = 'morning' | 'noon' | 'evening' | 'night';

export function dayPartOf(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'noon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export type WeeklyInsight =
  | { kind: 'not-enough'; remaining: number }
  | { kind: 'pattern'; dim: Dim; weekday: number; dayPart: DayPart; domain: Domain; share: number };

function mostCommon<T>(items: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * שורת תובנה אחת (גרסה ראשונה; מפת החום המלאה ב-M8).
 * מתארת איפה מופיע בעיקר 3D השבוע — ואם אין 3D, איפה מופיע המצב השכיח.
 */
export function weeklyInsight(allCount: number, weekCheckins: CheckIn[]): WeeklyInsight {
  if (allCount < MIN_CHECKINS_FOR_PATTERNS || weekCheckins.length === 0) {
    return { kind: 'not-enough', remaining: Math.max(1, MIN_CHECKINS_FOR_PATTERNS - allCount) };
  }
  const dims = weekCheckins.map((c) => primaryDim(c.result));
  const focus: Dim = dims.includes('d3') ? 'd3' : (mostCommon(dims) ?? 'd4');
  const focused = weekCheckins.filter((c) => primaryDim(c.result) === focus);
  return {
    kind: 'pattern',
    dim: focus,
    weekday: mostCommon(focused.map((c) => new Date(c.ts).getDay())) ?? 0,
    dayPart: mostCommon(focused.map((c) => dayPartOf(new Date(c.ts)))) ?? 'morning',
    domain: mostCommon(focused.map((c) => c.domain)) ?? 'work',
    share: focused.length / weekCheckins.length,
  };
}
