/**
 * הגליפים של שלושת המצבים (SPEC 4.1): צבע אינו נושא מידע לבדו —
 * לכל מצב גם צורה: 3D קובייה איזומטרית · 4D שתי טבעות משולבות · 5D עיגול קורן.
 */
import { useId } from 'react';
import type { Dim } from '../content/schema';
import { cn } from '../lib/cn';
import { DIM_LABEL } from './dims';

const DIM_TEXT_CLASS: Record<Dim, string> = { d3: 'text-d3', d4: 'text-d4', d5: 'text-d5' };

interface DimensionGlyphProps {
  dim: Dim;
  /** גודל בפיקסלים. ברירת מחדל 32. */
  size?: number;
  /** solid — גרסה מלאה, לסימון עוגן שנרשם ולתוצאה. */
  variant?: 'line' | 'solid';
  /** כשהגליף מלווה טקסט זהה — מוסתר מקוראי מסך. */
  decorative?: boolean;
  className?: string;
}

export function DimensionGlyph({ dim, size = 32, variant = 'line', decorative = false, className }: DimensionGlyphProps) {
  const id = useId();
  const solid = variant === 'solid';
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': `מצב ${DIM_LABEL[dim]}` } as const);

  return (
    <svg
      {...a11y}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', DIM_TEXT_CLASS[dim], className)}
    >
      {dim === 'd3' && (
        <>
          {solid && (
            <>
              <path d="M24 6 39.6 15 24 24 8.4 15Z" fill="currentColor" fillOpacity={0.5} stroke="none" />
              <path d="M8.4 15 24 24V42L8.4 33Z" fill="currentColor" fillOpacity={0.28} stroke="none" />
              <path d="M39.6 15 24 24V42L39.6 33Z" fill="currentColor" fillOpacity={0.14} stroke="none" />
            </>
          )}
          <path d="M24 6 39.6 15V33L24 42 8.4 33V15Z" />
          <path d="M8.4 15 24 24 39.6 15M24 24V42" />
        </>
      )}

      {dim === 'd4' && (
        <>
          <defs>
            {/* הפסקה קטנה בכל טבעת בנקודת החצייה — כך הן נראות שזורות זו בזו */}
            <mask id={`${id}-a`} maskUnits="userSpaceOnUse">
              <rect width="48" height="48" fill="white" />
              <circle cx="24" cy="33.2" r="3.4" fill="black" />
            </mask>
            <mask id={`${id}-b`} maskUnits="userSpaceOnUse">
              <rect width="48" height="48" fill="white" />
              <circle cx="24" cy="14.8" r="3.4" fill="black" />
            </mask>
          </defs>
          {solid && (
            <path
              d="M24 14.8a11 11 0 0 1 0 18.4 11 11 0 0 1 0-18.4Z"
              fill="currentColor"
              fillOpacity={0.4}
              stroke="none"
            />
          )}
          <circle cx="18" cy="24" r="11" mask={`url(#${id}-a)`} />
          <circle cx="30" cy="24" r="11" mask={`url(#${id}-b)`} />
        </>
      )}

      {dim === 'd5' && (
        <>
          {/* ליבה, הילה וקרניים קצרות שיוצאות ממנה — "עיגול קורן", ושונה במובהק מאייקון שמש רגיל */}
          <circle cx="24" cy="24" r="6.5" fill={solid ? 'currentColor' : 'none'} fillOpacity={solid ? 0.55 : undefined} />
          <circle cx="24" cy="24" r="12.5" strokeOpacity={0.55} strokeWidth={1.75} />
          <path d="M24 3v4.5M24 40.5V45M3 24h4.5M40.5 24H45M9.2 9.2l3.1 3.1M35.7 35.7l3.1 3.1M38.8 9.2l-3.1 3.1M12.3 35.7l-3.1 3.1" />
        </>
      )}
    </svg>
  );
}

interface DimBadgeProps {
  dim: Dim;
  size?: 'sm' | 'md';
  className?: string;
}

/** גליף + תווית טקסט. תמיד מופיע גם הטקסט "3D/4D/5D". */
export function DimBadge({ dim, size = 'md', className }: DimBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 font-medium text-text',
        size === 'md' ? 'min-h-9 ps-2 pe-3.5 text-sm' : 'min-h-7 ps-1.5 pe-2.5 text-xs',
        className,
      )}
    >
      <DimensionGlyph dim={dim} size={size === 'md' ? 22 : 16} variant="solid" decorative />
      <span dir="ltr">{DIM_LABEL[dim]}</span>
    </span>
  );
}
