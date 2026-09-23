import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { BreathPattern } from '../../content/schema';
import { breathAt, breathCycleSec, type BreathPhase } from '../../domain/session';
import { cn } from '../../lib/cn';

export const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'שאיפה',
  topUp: 'עוד קצת',
  holdIn: 'החזקה',
  exhale: 'נשיפה',
  holdOut: 'המתנה',
};

const ARC_RADIUS = 48;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

interface BreathOrbProps {
  /** תבנית נשימה — האורב נושם לפיה. בלעדיה הוא במנוחה (נשימה עצמית איטית). */
  pattern?: BreathPattern;
  /** הזמן שחלף במקטע, כפי שדווח בטיק האחרון של הנגן. */
  elapsedMs: number;
  running: boolean;
  /** night — כמעט חשוך, למצב "עיניים עצומות". */
  night?: boolean;
  size?: number;
  /** תוכן במרכז האורב כשאין תבנית נשימה (למשל ספירת שקט). */
  children?: ReactNode;
  className?: string;
}

/**
 * האורב (SPEC 6.6) — הדבר היחיד באפליקציה שנע לאט, כי הוא התוכן.
 * הנשימה מחושבת ב-requestAnimationFrame ונכתבת למשתנה CSS אחד (--b) על העוטף; חמש השכבות נגזרות ממנו
 * ב-calc, כך שאין רינדור React ואין נגיעה ב-DOM של השכבות בכל פריים. ב-reduced-motion: אורב סטטי,
 * טקסט ("שאיפה… 4") ופס התקדמות ליניארי.
 */
export function BreathOrb({ pattern, elapsedMs, running, night = false, size = 272, children, className }: BreathOrbProps) {
  const reduceMotion = useReducedMotion();
  const orb = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const anchor = useRef({ elapsedMs, at: 0 });
  anchor.current = { elapsedMs, at: performance.now() };
  const breathing = Boolean(pattern);

  useEffect(() => {
    const el = orb.current;
    if (!el) return;
    if (!pattern || reduceMotion) {
      // במנוחה ה-keyframes מניעים את --b; ערך inline היה גובר עליהם
      el.style.removeProperty('--b');
      return;
    }
    let frame = 0;
    const cycleSec = breathCycleSec(pattern);
    const draw = () => {
      const { elapsedMs: base, at } = anchor.current;
      const nowMs = running ? base + (performance.now() - at) : base;
      const sec = nowMs / 1000;
      const { fill } = breathAt(pattern, sec);
      // ריכוך בקצוות — הנשימה לא מתחילה ונעצרת בבת אחת
      const eased = 0.5 - Math.cos(Math.PI * fill) / 2;
      el.style.setProperty('--b', eased.toFixed(4));
      if (arc.current) {
        const cycleProgress = (sec % cycleSec) / cycleSec;
        arc.current.style.strokeDashoffset = String(ARC_LENGTH * (1 - cycleProgress));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [pattern, running, reduceMotion]);

  const moment = pattern ? breathAt(pattern, elapsedMs / 1000) : undefined;
  const mode = night ? 'night' : breathing && !reduceMotion ? 'breath' : 'idle';

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      <div ref={orb} className="orb" data-mode={mode} style={{ '--orb-size': `${size}px`, ...(reduceMotion ? { '--b': 0.5 } : {}) } as CSSProperties} aria-hidden>
        <div className="orb-halo" />
        <div className="orb-ring" />
        <div className="orb-ring orb-ring-2" />
        <div className="orb-core" />
        {breathing && !night && !reduceMotion && (
          <svg className="orb-arc" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={ARC_RADIUS} stroke="color-mix(in oklab, var(--orb-hue) 18%, transparent)" strokeWidth="0.8" />
            <circle ref={arc} cx="50" cy="50" r={ARC_RADIUS} stroke="color-mix(in oklab, var(--orb-hue) 70%, white)" strokeWidth="1.1" strokeDasharray={ARC_LENGTH} strokeDashoffset={ARC_LENGTH} />
          </svg>
        )}
        {!night && !moment && children && <div className="relative flex flex-col items-center text-center">{children}</div>}
      </div>

      {moment && !night && (
        <p className="flex items-baseline gap-3 font-display leading-none" aria-live="off">
          <span className="text-2xl text-text">{PHASE_LABEL[moment.phase]}</span>
          <span className="tabular text-2xl font-light text-muted">{moment.remainingSec}</span>
        </p>
      )}
      {moment && !night && reduceMotion && (
        <div className="h-1.5 w-56 overflow-hidden rounded-full border border-border-strong bg-surface-2" aria-hidden>
          <div className="h-full bg-d5-fill" style={{ width: `${moment.fill * 100}%` }} />
        </div>
      )}
    </div>
  );
}
