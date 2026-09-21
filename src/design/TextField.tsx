import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

// גודל הגופן בשדות הוא 17px (‎≥16px) — מונע זום אוטומטי ב-iOS (SPEC 4.6).
const FIELD =
  'w-full rounded-control border border-border-strong bg-surface-2 px-4 text-base text-text placeholder:text-muted/80 ' +
  'transition-[border-color,box-shadow] duration-[180ms] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40';

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
}

function FieldShell({ id, label, hint, error, children }: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type TextFieldProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        className={cn(FIELD, 'min-h-12', error && 'border-danger', className)}
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function TextArea({ label, hint, error, className, rows = 4, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        className={cn(FIELD, 'resize-y py-3 leading-[1.65]', error && 'border-danger', className)}
        {...rest}
      />
    </FieldShell>
  );
}
