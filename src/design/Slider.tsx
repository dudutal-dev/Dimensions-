import { useId, type CSSProperties } from 'react';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

/**
 * סליידר על בסיס פקד המערכת (range): נגיש למקלדת ולקוראי מסך, אזור מגע בגובה 48px.
 * המסילה והמילוי מצוירים ב-div-ים עם מאפיינים לוגיים, כי כיוון המילוי של ה-pseudo-elements
 * ב-RTL אינו עקבי בין דפדפנים. ב-RTL הערך הנמוך בצד ימין.
 */
export function Slider({ label, value, onChange, min = 0, max = 10, step = 1, minLabel, maxLabel }: SliderProps) {
  const id = useId();
  const ratio = (value - min) / (max - min);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-base font-medium">
          {label}
        </label>
        <output htmlFor={id} className="tabular font-display text-xl text-accent">
          {value}
        </output>
      </div>
      <div className="slider-wrap" style={{ '--ratio': ratio } as CSSProperties}>
        <div aria-hidden className="slider-track">
          <div className="slider-fill" />
        </div>
        <input
          id={id}
          type="range"
          className="slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-xs text-muted" aria-hidden>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
