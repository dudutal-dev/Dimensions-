import { Check, Feather, FlaskConical, Microscope } from 'lucide-react';
import type { Dim, Layer } from '../content/schema';
import { cn } from '../lib/cn';

const LAYER = {
  established: { label: 'מבוסס', Icon: Microscope },
  speculative: { label: 'ספקולטיבי', Icon: FlaskConical },
  metaphoric: { label: 'מטפורי', Icon: Feather },
} as const satisfies Record<Layer, unknown>;

/** תגית רובד לספרייה — מחליפה את סימוני האימוג'י שבמקור (SPEC 4.5). אייקון + מילה, בלי קידוד בצבע. */
export function LayerTag({ layer, className }: { layer: Layer; className?: string }) {
  const { label, Icon } = LAYER[layer];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-0.5 align-middle text-xs font-medium text-muted',
        className,
      )}
    >
      <Icon aria-hidden size={13} strokeWidth={2} />
      {label}
    </span>
  );
}

/** "נשמר" — אינדיקטור עדין לשמירה אוטומטית (SPEC פרק 7). */
export function SavedIndicator({ visible }: { visible: boolean }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1 text-xs text-muted transition-opacity duration-[240ms]',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <Check aria-hidden size={14} />
      {visible ? 'נשמר' : ''}
    </span>
  );
}

/** התקדמות בזרימה רב-שלבית (בדיקת מימד, Onboarding). */
export function ProgressDots({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`שלב ${current} מתוך ${total}`}
      className="flex items-center gap-2"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-[width,background-color] duration-[240ms] ease-out',
            i + 1 === current ? 'w-6 bg-accent' : i + 1 < current ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-border-strong/60',
          )}
        />
      ))}
    </div>
  );
}

/** הילת הרקע. בצבע המצב האחרון שנרשם; בלי מצב — מעבר רך בין 4D ל-5D. */
export function Aurora({ dim }: { dim?: Dim }) {
  return <div aria-hidden className="aurora" data-dim={dim} />;
}
