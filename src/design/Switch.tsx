import { useId } from 'react';
import { cn } from '../lib/cn';

interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** מתג הפעלה/כיבוי. כל השורה היא יעד המגע (‎≥48px); המצב נמסר גם ב-aria-checked וגם במיקום הכפתור, לא רק בצבע. */
export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      // השם הנגיש הוא התווית בלבד; ההסבר נמסר כתיאור, ולא פעמיים
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      onClick={() => onChange(!checked)}
      className="pressable flex min-h-14 w-full items-center gap-4 rounded-control py-2 text-start"
    >
      <span className="min-w-0 flex-1">
        <span id={labelId} className="block font-medium">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="block text-sm text-muted">
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-[180ms] motion-reduce:transition-none',
          checked ? 'border-accent bg-accent-fill' : 'border-border-strong bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 size-6 -translate-y-1/2 rounded-full shadow-1 transition-[inset-inline-start] duration-[180ms] motion-reduce:transition-none',
            checked ? 'start-[1.75rem] bg-on-accent' : 'start-1 bg-muted',
          )}
        />
      </span>
    </button>
  );
}
