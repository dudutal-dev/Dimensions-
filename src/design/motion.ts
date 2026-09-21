/**
 * שפת התנועה (SPEC 4.4): מיקרו-אינטראקציות 180–260ms, ease-out בכניסה,
 * יציאה ~65% מזמן הכניסה, spring רך למעברי מסך. רק ההילה ועיגול הנשימה נעים לאט.
 * הערכים מקבילים ל---dur-* ו---e-* שב-tokens.css.
 */
import type { Transition, Variants } from 'framer-motion';

export const duration = { fast: 0.18, base: 0.24, slow: 0.32 } as const;
export const EXIT_RATIO = 0.65;

export const ease = {
  out: [0.22, 1, 0.36, 1],
  in: [0.64, 0, 0.78, 0],
} as const;

export const spring = {
  soft: { type: 'spring', stiffness: 260, damping: 30, mass: 1 },
  sheet: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
} satisfies Record<string, Transition>;

const enter = (d: number): Transition => ({ duration: d, ease: ease.out });
const exit = (d: number): Transition => ({ duration: d * EXIT_RATIO, ease: ease.in });

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: enter(duration.base) },
  exit: { opacity: 0, transition: exit(duration.base) },
};

/** כניסת מסך: עולה מעט מלמטה. ב-reduced-motion משתמשים ב-fade במקום. */
export const screen: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: spring.soft },
  exit: { opacity: 0, transition: exit(duration.fast) },
};

export const sheetPanel: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: spring.sheet },
  exit: { y: '100%', transition: exit(duration.slow) },
};

export const toast: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: enter(duration.base) },
  exit: { opacity: 0, y: 8, transition: exit(duration.base) },
};
