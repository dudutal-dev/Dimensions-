/**
 * המסע בן 12 השבועות (SPEC 6.7) — לוגיקה טהורה.
 * עקרונות: אין נעילה קשיחה (המשתמש מחליט מתי להתקדם), אין streak-shaming (יום שלא סומן פשוט ריק),
 * "להישאר עוד שבוע" אינו כישלון, וחזרה אחרי הפסקה מתחילה בעדינות: שלושה ימים של ת1–ת3.
 */
import type { JourneyContent } from '../content/schema';
import { profileOf, type ProfileId, type Shares } from './diagnosis-scoring';
import type { JourneyState } from './records';

const DAY_MS = 24 * 3_600_000;
export const WEEK_DAYS = 7;
/** אחרי כמה ימים בלי תרגול מסומן זו "חזרה מהפסקה". */
export const BREAK_AFTER_DAYS = 4;
export const LAST_WEEK = 12;

type Week = JourneyContent['weeks'][number];
type Phase = JourneyContent['phases'][number];

// ---------- תאריכים ----------

export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / DAY_MS);
}

function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

// ---------- מבנה התכנית ----------

export function phaseOfWeek(content: JourneyContent, week: number): Phase | undefined {
  return content.phases.find((p) => week >= p.fromWeek && week <= p.toWeek);
}

export function weekOf(content: JourneyContent, week: number): Week | undefined {
  return content.weeks.find((w) => w.week === week);
}

export function isLastWeekOfPhase(content: JourneyContent, week: number): boolean {
  return phaseOfWeek(content, week)?.toWeek === week;
}

export function weekIdOf(week: number): string {
  return `w${String(week).padStart(2, '0')}`;
}

export function weekFromId(id: string | undefined): number | undefined {
  const match = /^w(\d{1,2})$/.exec(id ?? '');
  if (!match) return undefined;
  const week = Number(match[1]);
  return week >= 0 && week <= LAST_WEEK ? week : undefined;
}

// ---------- מעברים ----------

export function hasStarted(state: JourneyState): boolean {
  return state.startedAt !== null;
}

export function startJourney(state: JourneyState, now: number): JourneyState {
  return { ...state, startedAt: now, weekStartedAt: now, currentWeek: 0, mode: 'program' };
}

/** מעבר לשבוע מסוים — קדימה, אחורה, או קפיצה לפי המלצת האבחון. אין נעילה. */
export function goToWeek(state: JourneyState, week: number, now: number): JourneyState {
  const target = Math.min(Math.max(week, 0), LAST_WEEK);
  const { returnPlanFrom: _cleared, ...rest } = state;
  return { ...rest, currentWeek: target, weekStartedAt: now, mode: 'program' };
}

/** "ממשיכים": לשבוע הבא; אחרי שבוע 12 — מצב תחזוקה. */
export function advance(state: JourneyState, now: number): JourneyState {
  if (state.currentWeek >= LAST_WEEK) return { ...state, mode: 'maintenance', completedAt: now };
  return goToWeek(state, state.currentWeek + 1, now);
}

/** "להישאר עוד שבוע": אותו שבוע, חלון חדש של שבעה ימים. */
export function stayAnotherWeek(state: JourneyState, now: number): JourneyState {
  return { ...state, weekStartedAt: now };
}

export function setCriterion(state: JourneyState, phaseId: Phase['id'], index: number, checked: boolean): JourneyState {
  return { ...state, criteria: { ...state.criteria, [`${phaseId}.${index}`]: checked } };
}

export function criterionChecked(state: JourneyState, phaseId: Phase['id'], index: number): boolean {
  return state.criteria?.[`${phaseId}.${index}`] ?? false;
}

// ---------- השבוע הנוכחי ----------

export interface WeekDay {
  date: string;
  /** 1..7 */
  dayNumber: number;
  isToday: boolean;
  isFuture: boolean;
  practice: boolean;
  lifeTask: boolean;
}

/** שבעת ימי השבוע הנוכחי, מהיום שבו התחיל. יום ריק הוא פשוט ריק. */
export function daysOfCurrentWeek(state: JourneyState, today: Date): WeekDay[] {
  const start = isoDate(new Date(state.weekStartedAt ?? state.startedAt ?? today.getTime()));
  const todayIso = isoDate(today);
  return Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = addDays(start, i);
    const mark = state.days[date];
    return { date, dayNumber: i + 1, isToday: date === todayIso, isFuture: date > todayIso, practice: mark?.practice ?? false, lifeTask: mark?.lifeTask ?? false };
  });
}

/** כמה ימים עברו מתחילת השבוע הנוכחי (0 = היום הראשון). */
export function daysIntoWeek(state: JourneyState, today: Date): number {
  const start = isoDate(new Date(state.weekStartedAt ?? state.startedAt ?? today.getTime()));
  return Math.max(0, daysBetween(start, isoDate(today)));
}

/** עבר שבוע — אפשר להציע בעדינות להמשיך. ההחלטה תמיד של המשתמש. */
export function readyToMoveOn(state: JourneyState, today: Date): boolean {
  return state.mode === 'program' && hasStarted(state) && daysIntoWeek(state, today) >= WEEK_DAYS;
}

// ---------- חזרה מהפסקה ----------

export const RETURN_PLAN_DAYS = 3;

function lastPracticeDate(state: JourneyState): string | undefined {
  return Object.entries(state.days)
    .filter(([, mark]) => mark.practice)
    .map(([date]) => date)
    .sort()
    .at(-1);
}

/** כמה ימים עברו מאז התרגול המסומן האחרון (או מתחילת השבוע, אם עוד לא סומן דבר). */
export function daysAway(state: JourneyState, today: Date): number {
  const weekStart = isoDate(new Date(state.weekStartedAt ?? state.startedAt ?? today.getTime()));
  const last = lastPracticeDate(state);
  const reference = last && last > weekStart ? last : weekStart;
  return Math.max(0, daysBetween(reference, isoDate(today)));
}

export function returnPlanActive(state: JourneyState, today: Date): boolean {
  if (!state.returnPlanFrom) return false;
  const since = daysBetween(state.returnPlanFrom, isoDate(today));
  return since >= 0 && since < RETURN_PLAN_DAYS;
}

/** האם להציג "טוב שחזרת". רק בתכנית עצמה, אחרי שבוע 0, וכשאין כבר תכנית חזרה פעילה. */
export function isReturningFromBreak(state: JourneyState, today: Date): boolean {
  if (state.mode !== 'program' || !hasStarted(state) || state.currentWeek < 1) return false;
  if (returnPlanActive(state, today)) return false;
  return daysAway(state, today) >= BREAK_AFTER_DAYS;
}

export function beginReturnPlan(state: JourneyState, today: Date): JourneyState {
  return { ...state, returnPlanFrom: isoDate(today) };
}

// ---------- תרגול היום ----------

export interface DailyPlan {
  week: number;
  /** true = שלושת ימי החזרה (ת1–ת3) במקום תרגולי השבוע. */
  isReturnPlan: boolean;
  exerciseIds: string[];
  /** מה שחדש השבוע — מובלט במסך; השאר "ממשיכים גם". */
  newExerciseIds: string[];
}

export function dailyPlan(content: JourneyContent, state: JourneyState, today: Date): DailyPlan | null {
  if (!hasStarted(state) || state.mode !== 'program') return null;
  if (returnPlanActive(state, today)) {
    const ids = content.returnAfterBreak.exerciseIds;
    return { week: state.currentWeek, isReturnPlan: true, exerciseIds: ids, newExerciseIds: [] };
  }
  const week = weekOf(content, state.currentWeek);
  if (!week) return { week: state.currentWeek, isReturnPlan: false, exerciseIds: [], newExerciseIds: [] };
  return {
    week: week.week,
    isReturnPlan: false,
    exerciseIds: week.practices.map((p) => p.exerciseId),
    newExerciseIds: week.practices.filter((p) => !p.carried).map((p) => p.exerciseId),
  };
}

/** סשן שהושלם נחשב כ"תרגלתי היום" אם הוא אחד מתרגולי היום. */
export function countsAsDailyPractice(content: JourneyContent, state: JourneyState, toolId: string, today: Date): boolean {
  return dailyPlan(content, state, today)?.exerciseIds.includes(toolId) ?? false;
}

export function practicePendingToday(content: JourneyContent, state: JourneyState, today: Date): boolean {
  const plan = dailyPlan(content, state, today);
  if (!plan || plan.exerciseIds.length === 0) return false;
  return !(state.days[isoDate(today)]?.practice ?? false);
}

// ---------- נקודת כניסה לפי האבחון ----------

export interface EntryRecommendation {
  profile: ProfileId;
  phase: Phase['id'];
  week: number;
}

/** המלצה בלבד: האבחון מציע מאיפה להתחיל, והמשתמש בוחר. */
export function entryRecommendation(
  overall: Shares,
  profiles: ReadonlyArray<{ id: ProfileId; entryPhase: Phase['id']; entryWeek: number }>,
  threshold: number,
): EntryRecommendation | null {
  const profile = profileOf(overall, threshold);
  const match = profiles.find((p) => p.id === profile);
  return match ? { profile, phase: match.entryPhase, week: match.entryWeek } : null;
}

// ---------- שבוע 0 ונקודות בדיקה ----------

export interface Week0Facts {
  hasSelfDiagnosis: boolean;
  hasOtherDiagnosis: boolean;
  eveningEntries: number;
  hasBaselineMetrics: boolean;
  hasFocusDomain: boolean;
}

export const BASELINE_JOURNAL_DAYS = 7;

export function week0Steps(facts: Week0Facts): Record<'diagnosis' | 'reaction-journal' | 'baseline-metrics' | 'focus-domain', boolean> {
  return {
    diagnosis: facts.hasSelfDiagnosis,
    'reaction-journal': facts.eveningEntries >= BASELINE_JOURNAL_DAYS,
    'baseline-metrics': facts.hasBaselineMetrics,
    'focus-domain': facts.hasFocusDomain,
  };
}

export type MetricKey = 'recoveryMin' | 'quietMinutes' | 'sleepQuality' | 'leisureScreenHours';

/** בשני המדדים האלה ירידה היא שיפור. */
export const LOWER_IS_BETTER: ReadonlySet<MetricKey> = new Set(['recoveryMin', 'leisureScreenHours']);

export function metricChange(key: MetricKey, baseline: number | undefined, current: number | undefined): 'better' | 'worse' | 'same' | null {
  if (baseline === undefined || current === undefined) return null;
  if (current === baseline) return 'same';
  const improved = LOWER_IS_BETTER.has(key) ? current < baseline : current > baseline;
  return improved ? 'better' : 'worse';
}
