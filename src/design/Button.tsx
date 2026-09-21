import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary — אחד בלבד בכל מסך (SPEC 4.5). */
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent-fill text-on-accent border border-accent/50 shadow-2 hover:brightness-105',
  secondary: 'bg-surface-2 text-text border border-border-strong hover:bg-surface',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger text-on-danger hover:brightness-105',
};

const SIZE: Record<Size, string> = {
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading = false, fullWidth = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'pressable inline-flex select-none items-center justify-center gap-2 rounded-control font-medium',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle aria-hidden size={20} className="animate-[spin_0.9s_linear_infinite] motion-reduce:animate-none" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** חובה: כפתור אייקון בלי תווית נגישה אינו קביל. */
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'pressable inline-flex size-12 shrink-0 items-center justify-center rounded-full text-text hover:bg-surface-2',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
