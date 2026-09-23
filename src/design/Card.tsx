import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** raised — כרטיס מורם (surface-2), למשל בתוך כרטיס אחר או ל-input. hero — הכרטיס הראשי של המסך, עם גוון עדין מלמעלה (--hero-tint). */
  tone?: 'surface' | 'raised' | 'hero';
  elevation?: 0 | 1 | 2;
  padding?: 'md' | 'lg';
}

const ELEVATION = { 0: '', 1: 'shadow-1', 2: 'shadow-2' } as const;

export function Card({ tone = 'surface', elevation = 1, padding = 'md', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border',
        tone === 'surface' ? 'surface-card' : tone === 'hero' ? 'surface-hero' : 'surface-raised',
        tone !== 'hero' && ELEVATION[elevation],
        padding === 'md' ? 'p-4' : 'p-6',
        className,
      )}
      {...rest}
    />
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}

/** מצב ריק: תמיד הסבר + הצעד הבא, אף פעם לא מסך ריק. */
export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <h3 className="text-lg">{title}</h3>
      {text && <p className="max-w-[32ch] text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
