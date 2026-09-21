import { Check } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface ChipProps {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  disabled?: boolean;
}

/** צ'יפ בחירה. הבחירה מסומנת גם בסימן ✓ ובגבול — לא רק בצבע. */
export function Chip({ selected, onToggle, children, disabled }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'pressable inline-flex min-h-12 select-none items-center gap-1.5 rounded-full border px-4 text-base',
        'disabled:cursor-not-allowed disabled:opacity-45',
        selected
          ? 'border-accent bg-accent/15 font-medium text-text'
          : 'border-border-strong bg-surface-2 text-text hover:bg-surface',
      )}
    >
      {selected && <Check aria-hidden size={18} className="text-accent" />}
      {children}
    </button>
  );
}

interface OptionButtonProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  /** שורת הסבר קטנה מתחת לתווית. */
  hint?: string;
  icon?: ReactNode;
}

/** אפשרות בחירה גדולה לזרימות של "הקשה אחת" (בדיקת מימד, Onboarding). */
export function OptionButton({ selected, onSelect, children, hint, icon }: OptionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'pressable flex min-h-14 w-full select-none items-center gap-3 rounded-control border px-4 py-3 text-start text-base',
        selected ? 'border-accent bg-accent/15 font-medium' : 'border-border-strong bg-surface-2 hover:bg-surface',
      )}
    >
      {icon}
      <span className="flex-1">
        {children}
        {hint && <span className="mt-0.5 block text-sm font-normal text-muted">{hint}</span>}
      </span>
      {selected && <Check aria-hidden size={20} className="shrink-0 text-accent" />}
    </button>
  );
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>;
}

/** בחירה אחת מתוך מעטות (למשל ערכת צבע). */
export function SegmentedControl<T extends string>({ label, value, onChange, options }: SegmentedControlProps<T>) {
  // ניווט חיצים כמו בקבוצת רדיו. ב-RTL "הבא" הוא שמאלה.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = options.findIndex((o) => o.value === value);
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    event.currentTarget.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 rounded-control border border-border bg-surface-2 p-1"
    >
      {options.map((opt, position) => {
        const checked = opt.value === value;
        // כשעוד לא נבחר דבר, האפשרות הראשונה היא נקודת הכניסה של המקלדת.
        const focusable = checked || (position === 0 && !options.some((o) => o.value === value));
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={focusable ? 0 : -1}
            data-value={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'pressable inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 text-sm',
              checked ? 'bg-surface font-medium text-text shadow-1' : 'text-muted hover:text-text',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
