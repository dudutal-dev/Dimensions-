import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { BreathPattern } from '../../content/schema';
import { breathAt, type BreathPhase } from '../../domain/session';

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'שאיפה',
  topUp: 'עוד קצת',
  holdIn: 'החזק',
  exhale: 'נשיפה',
  holdOut: 'המתן',
};

const MIN_SCALE = 0.5;

interface BreathCircleProps {
  pattern: BreathPattern;
  /** הזמן שחלף במקטע, כפי שדווח בטיק האחרון של הנגן. */
  elapsedMs: number;
  running: boolean;
}

/**
 * עיגול הנשימה (SPEC 6.6) — אחד משני הדברים היחידים באפליקציה שנעים לאט, כי הוא התוכן.
 * התנועה מחושבת ב-requestAnimationFrame ונכתבת ישר ל-DOM, כדי להיות חלקה בלי לרנדר 60 פעם בשנייה.
 * ב-reduced-motion: פס התקדמות ליניארי וטקסט ("שאיפה… 4").
 */
export function BreathCircle({ pattern, elapsedMs, running }: BreathCircleProps) {
  const reduceMotion = useReducedMotion();
  const circle = useRef<HTMLDivElement>(null);
  const anchor = useRef({ elapsedMs, at: 0 });
  anchor.current = { elapsedMs, at: performance.now() };

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const draw = () => {
      const { elapsedMs: base, at } = anchor.current;
      const now = running ? base + (performance.now() - at) : base;
      const { fill } = breathAt(pattern, now / 1000);
      // ריכוך בקצוות — הנשימה לא מתחילה ונעצרת בבת אחת.
      const eased = 0.5 - Math.cos(Math.PI * fill) / 2;
      if (circle.current) {
        circle.current.style.transform = `scale(${MIN_SCALE + (1 - MIN_SCALE) * eased})`;
        circle.current.style.opacity = String(0.55 + 0.45 * eased);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [pattern, running, reduceMotion]);

  const moment = breathAt(pattern, elapsedMs / 1000);

  if (reduceMotion) {
    return (
      <div className="flex w-full max-w-xs flex-col items-center gap-4">
        <p className="font-display text-2xl" aria-live="off">
          {PHASE_LABEL[moment.phase]}… <span className="tabular">{moment.remainingSec}</span>
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full border border-border-strong bg-surface-2">
          <div className="h-full bg-d5-fill" style={{ width: `${moment.fill * 100}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex size-64 items-center justify-center">
      <div aria-hidden className="absolute inset-0 rounded-full border border-border-strong/50" />
      <div
        ref={circle}
        aria-hidden
        className="absolute inset-0 rounded-full bg-d5-fill/25 shadow-[0_0_60px_color-mix(in_oklab,var(--d5-fill)_35%,transparent)] will-change-transform"
        style={{ transform: `scale(${MIN_SCALE})` }}
      />
      <p className="relative font-display text-xl">{PHASE_LABEL[moment.phase]}</p>
    </div>
  );
}
