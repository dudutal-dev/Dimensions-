/**
 * הלוגיקה של נגן התרגולים (SPEC 6.6) — טהורה: בלי React, בלי אודיו, בלי שעון.
 * הנגן עצמו (features/session) רק מזין כאן זמן שחלף, ומגיב לאירועים שחוזרים.
 */
import type { BreathPattern, ContentBundle, Layer, Segment } from '../content/schema';
import type { GuidedForm } from './records';

// ---------- איתור סשן ----------

export interface FormStep {
  fieldId: string;
  label: string;
  segmentId: string;
  optional?: boolean;
}

export interface Session {
  id: string;
  kind: 'exercise' | 'tool' | 'trigger';
  name: string;
  summary: string;
  durationSec: number;
  /** timed — הנגן מתקדם לבד. form — שאלות הכתיבה ממתינות למשתמש. */
  mode: 'timed' | 'form';
  segments: Segment[];
  form?: { kind: GuidedForm['kind']; steps: FormStep[] };
  caution?: string;
  layer?: Layer;
  note?: { text: string; layer?: Layer };
}

type SessionContent = Pick<ContentBundle, 'exercises' | 'tools' | 'triggers'>;

/** מאתר תרגיל, כלי מעבר או פרוטוקול טריגר לפי מזהה. כלי שמפנה לתרגיל (90 שניות) מקבל את המקטעים שלו. */
export function findSession(content: SessionContent, id: string): Session | undefined {
  const exercise = content.exercises.exercises.find((e) => e.id === id);
  if (exercise) {
    return {
      id: exercise.id,
      kind: 'exercise',
      name: exercise.name,
      summary: exercise.summary,
      durationSec: exercise.durationSec,
      mode: exercise.mode,
      segments: exercise.segments,
      form: exercise.form,
      caution: exercise.caution,
      layer: exercise.layer,
      note: exercise.note,
    };
  }

  const tool = content.tools.tools.find((t) => t.id === id);
  if (tool) {
    const source = tool.exerciseRef ? content.exercises.exercises.find((e) => e.id === tool.exerciseRef) : undefined;
    const segments = tool.segments ?? source?.segments;
    if (!segments) return undefined;
    return {
      id: tool.id,
      kind: 'tool',
      name: tool.name,
      summary: tool.summary,
      durationSec: tool.durationSec,
      mode: 'timed',
      segments,
      caution: tool.caution,
      layer: tool.layer,
      note: source?.note,
    };
  }

  const trigger = content.triggers.triggers.find((t) => t.id === id);
  if (trigger) {
    return {
      id: trigger.id,
      kind: 'trigger',
      name: trigger.label,
      summary: trigger.move.join(' ← '),
      durationSec: trigger.durationSec,
      mode: 'timed',
      segments: trigger.segments,
      caution: trigger.caution,
    };
  }
  return undefined;
}

export function allSessionIds(content: SessionContent): string[] {
  return [
    ...content.exercises.exercises.map((e) => e.id),
    ...content.tools.tools.map((t) => t.id),
    ...content.triggers.triggers.map((t) => t.id),
  ];
}

// ---------- נשימה ----------

export type BreathPhase = 'inhale' | 'topUp' | 'holdIn' | 'exhale' | 'holdOut';

export interface BreathMoment {
  phase: BreathPhase;
  /** 0..1 בתוך השלב הנוכחי. */
  progress: number;
  /** שניות שנותרו בשלב (מעוגל מעלה) — לתצוגת reduced-motion. */
  remainingSec: number;
  cycle: number;
  /** "מלאוּת" הריאות 0..1 — גודל עיגול הנשימה. שאיפה משלימה (topUp) ממלאת את החמישית האחרונה. */
  fill: number;
}

const TOP_UP_SHARE = 0.2;

export function breathCycleSec(p: BreathPattern): number {
  return p.inhaleSec + (p.topUpSec ?? 0) + p.holdInSec + p.exhaleSec + p.holdOutSec;
}

export function breathAt(pattern: BreathPattern, elapsedSec: number): BreathMoment {
  const cycleSec = breathCycleSec(pattern);
  const cycle = Math.floor(elapsedSec / cycleSec);
  let t = elapsedSec - cycle * cycleSec;
  const hasTopUp = Boolean(pattern.topUpSec);
  const inhaleTop = hasTopUp ? 1 - TOP_UP_SHARE : 1;

  const phases: Array<[BreathPhase, number, (progress: number) => number]> = [
    ['inhale', pattern.inhaleSec, (x) => x * inhaleTop],
    ['topUp', pattern.topUpSec ?? 0, (x) => inhaleTop + x * TOP_UP_SHARE],
    ['holdIn', pattern.holdInSec, () => 1],
    ['exhale', pattern.exhaleSec, (x) => 1 - x],
    ['holdOut', pattern.holdOutSec, () => 0],
  ];

  for (const [phase, duration, fillAt] of phases) {
    if (duration <= 0) continue;
    if (t < duration) {
      const progress = t / duration;
      return { phase, progress, remainingSec: Math.ceil(duration - t), cycle, fill: fillAt(progress) };
    }
    t -= duration;
  }
  return { phase: 'holdOut', progress: 1, remainingSec: 0, cycle, fill: 0 };
}

// ---------- מצב הנגן ----------

export type PlayerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface PlayerState {
  status: PlayerStatus;
  index: number;
  /** הזמן שחלף במקטע הנוכחי. */
  segmentMs: number;
}

export type PlayerEvent = { type: 'enter'; index: number } | { type: 'finished' };

export const initialPlayerState: PlayerState = { status: 'idle', index: 0, segmentMs: 0 };

/** במצב טופס, שאלות עם שדה כתיבה ממתינות למשתמש — הזמן שלהן הוא המלצה, לא טיימר. */
export function waitsForUser(session: Session, index: number): boolean {
  const segment = session.segments[index];
  if (!segment || session.mode !== 'form') return false;
  return session.form?.steps.some((step) => step.segmentId === segment.id) ?? false;
}

export function start(): { state: PlayerState; events: PlayerEvent[] } {
  return { state: { status: 'running', index: 0, segmentMs: 0 }, events: [{ type: 'enter', index: 0 }] };
}

/** מקדם את הנגן ב-dtMs. עודף זמן עובר למקטע הבא, כך שהמשך הכולל נשאר מדויק גם כשה-timer מקרטע. */
export function tick(session: Session, state: PlayerState, dtMs: number): { state: PlayerState; events: PlayerEvent[] } {
  if (state.status !== 'running') return { state, events: [] };
  const events: PlayerEvent[] = [];
  let { index, segmentMs } = state;
  segmentMs += dtMs;

  for (;;) {
    const segment = session.segments[index];
    if (!segment) break;
    if (waitsForUser(session, index)) {
      segmentMs = Math.min(segmentMs, segment.durationSec * 1000);
      break;
    }
    const durationMs = segment.durationSec * 1000;
    if (segmentMs < durationMs) break;
    segmentMs -= durationMs;
    index += 1;
    if (index >= session.segments.length) {
      return { state: { status: 'finished', index: session.segments.length - 1, segmentMs: 0 }, events: [...events, { type: 'finished' }] };
    }
    events.push({ type: 'enter', index });
  }
  return { state: { status: 'running', index, segmentMs }, events };
}

/** מעבר יזום למקטע הבא ("הבא" בטופס, או דילוג). */
export function next(session: Session, state: PlayerState): { state: PlayerState; events: PlayerEvent[] } {
  if (state.status === 'idle' || state.status === 'finished') return { state, events: [] };
  const index = state.index + 1;
  if (index >= session.segments.length) {
    return { state: { status: 'finished', index: state.index, segmentMs: 0 }, events: [{ type: 'finished' }] };
  }
  return { state: { ...state, index, segmentMs: 0 }, events: [{ type: 'enter', index }] };
}

export function previous(state: PlayerState): { state: PlayerState; events: PlayerEvent[] } {
  if (state.status === 'idle' || state.status === 'finished') return { state, events: [] };
  // בתחילת מקטע — חזרה למקטע הקודם; באמצעו — לתחילתו.
  const index = state.segmentMs < 1500 ? Math.max(0, state.index - 1) : state.index;
  return { state: { ...state, index, segmentMs: 0 }, events: [{ type: 'enter', index }] };
}

export function pause(state: PlayerState): PlayerState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state;
}

export function resume(state: PlayerState): PlayerState {
  return state.status === 'paused' ? { ...state, status: 'running' } : state;
}

/** הזמן שנותר עד סוף הסשן, בשניות. בטופס זו הערכה בלבד. */
export function remainingSec(session: Session, state: PlayerState): number {
  if (state.status === 'finished') return 0;
  const rest = session.segments.slice(state.index + 1).reduce((sum, s) => sum + s.durationSec, 0);
  const current = session.segments[state.index]?.durationSec ?? 0;
  return Math.max(0, Math.ceil(rest + current - state.segmentMs / 1000));
}

export function formatClock(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
