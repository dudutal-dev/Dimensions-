/**
 * תרשימים ב-SVG/HTML ידני (ARD-5). כללים:
 *  - צבע אינו נושא מידע לבדו: לכל מצב גם גליף ותווית, והערכים כתובים תמיד בטקסט.
 *  - הטקסט לובש צבעי טקסט, לא את צבע הסדרה; הסימן הצבעוני שלידו נושא את הזהות.
 *  - סדר המצבים קבוע (3D, 4D, 5D) — הצבע הולך עם הישות, לא עם הדירוג.
 *  - מקטעים מופרדים ברווח של 2px; קווי רשת וצירים מאופקים; ציר אחד בלבד.
 *  - האפליקציה RTL: הערך הראשון בצד ימין, וגם ציר הזמן מתקדם מימין לשמאל.
 */
import type { Dim } from '../content/schema';
import { cn } from '../lib/cn';
import { DimensionGlyph } from './DimensionGlyph';
import { DIM_LABEL } from './dims';

export type Shares = Record<Dim, number>;

const DIMS: readonly Dim[] = ['d3', 'd4', 'd5'];
const FILL: Record<Dim, string> = { d3: 'bg-d3-fill', d4: 'bg-d4-fill', d5: 'bg-d5-fill' };
const STROKE: Record<Dim, string> = { d3: 'var(--d3-fill)', d4: 'var(--d4-fill)', d5: 'var(--d5-fill)' };

export const pct = (share: number) => Math.round(share * 100);

function describeShares(shares: Shares): string {
  return DIMS.map((dim) => `${DIM_LABEL[dim]} ${pct(shares[dim])}%`).join(', ');
}

interface SharesBarProps {
  shares: Shares;
  /** תיאור לקורא מסך, למשל "כסף וחומר". */
  label: string;
  size?: 'sm' | 'md';
}

/** פס מפולח של 100%: חלקם של 3D / 4D / 5D. */
export function SharesBar({ shares, label, size = 'md' }: SharesBarProps) {
  const empty = DIMS.every((dim) => shares[dim] === 0);
  return (
    <div
      role="img"
      aria-label={`${label}: ${empty ? 'אין נתונים' : describeShares(shares)}`}
      className={cn('flex w-full gap-0.5 overflow-hidden rounded-[4px]', size === 'md' ? 'h-3' : 'h-2')}
    >
      {empty ? (
        <span className="h-full w-full rounded-[4px] bg-border" />
      ) : (
        DIMS.filter((dim) => shares[dim] > 0).map((dim) => (
          <span key={dim} className={cn('h-full rounded-[3px]', FILL[dim])} style={{ width: `${shares[dim] * 100}%` }} />
        ))
      )}
    </div>
  );
}

/** הערכים בטקסט, עם גליף לכל מצב — משמש גם כמקרא. */
export function SharesValues({ shares, className }: { shares: Shares; className?: string }) {
  return (
    <p className={cn('tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted', className)}>
      {DIMS.map((dim) => (
        <span key={dim} className="inline-flex items-center gap-1.5">
          <DimensionGlyph dim={dim} size={16} variant="solid" decorative />
          <span dir="ltr">{DIM_LABEL[dim]}</span>
          <span dir="ltr" className="font-medium text-text">
            {pct(shares[dim])}%
          </span>
        </span>
      ))}
    </p>
  );
}

export interface TrendPoint {
  id: string;
  label: string;
  shares: Shares;
}

const W = 320;
const H = 168;
// ימין: תוויות ציר האחוזים. שמאל: תוויות הקצה של הקווים (המדידה האחרונה נמצאת בצד שמאל).
const PAD = { top: 12, bottom: 28, left: 58, right: 38 };

/** מגמה בין מדידות: שלושה קווים (3D / 4D / 5D) על ציר אחד של אחוזים. */
export function TrendChart({ points, title }: { points: TrendPoint[]; title: string }) {
  if (points.length < 2) return null;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  // RTL: המדידה הראשונה בצד ימין.
  const x = (index: number) => W - PAD.right - (index / (points.length - 1)) * plotW;
  const y = (share: number) => PAD.top + (1 - share) * plotH;
  const last = points[points.length - 1]!;

  // תוויות הקצה (בצד שמאל) — מרחיקים אותן זו מזו כדי שלא יעלו זו על זו.
  const endLabels = DIMS.map((dim) => ({ dim, y: y(last.shares[dim]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i]!.y - endLabels[i - 1]!.y < 14) endLabels[i]!.y = endLabels[i - 1]!.y + 14;
  }

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${points.map((p) => `${p.label}: ${describeShares(p.shares)}`).join('. ')}`} className="w-full">
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={1} />
            <text x={W - 2} y={y(tick) + 3.5} textAnchor="end" fontSize={10} fill="var(--text-muted)" direction="ltr">
              {pct(tick)}%
            </text>
          </g>
        ))}
        {points.map((point, index) => (
          <text key={point.id} x={x(index)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
            {point.label}
          </text>
        ))}
        {DIMS.map((dim) => (
          <g key={dim}>
            <polyline
              fill="none"
              stroke={STROKE[dim]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points.map((p, i) => `${x(i)},${y(p.shares[dim])}`).join(' ')}
            />
            {points.map((p, i) => (
              <circle key={p.id} cx={x(i)} cy={y(p.shares[dim])} r={4} fill={STROKE[dim]} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        ))}
        {endLabels.map(({ dim, y: labelY }) => (
          <text key={dim} x={PAD.left - 10} y={labelY + 4} textAnchor="end" fontSize={11} fill="var(--text)" direction="ltr">
            {DIM_LABEL[dim]} {pct(last.shares[dim])}%
          </text>
        ))}
      </svg>
      <figcaption className="mt-2">
        <SharesLegend />
        <details className="mt-3 text-sm">
          <summary className="flex min-h-12 cursor-pointer items-center text-muted">הצג כטבלה</summary>
          <table className="tabular w-full text-start">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-start font-medium">מדידה</th>
                {DIMS.map((dim) => (
                  <th key={dim} className="py-1 text-start font-medium" dir="ltr">
                    {DIM_LABEL[dim]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.id} className="border-t border-border">
                  <td className="py-1.5">{point.label}</td>
                  {DIMS.map((dim) => (
                    <td key={dim} className="py-1.5" dir="ltr">
                      {pct(point.shares[dim])}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figcaption>
    </figure>
  );
}

/** מקרא: גליף + תווית לכל מצב. תמיד מופיע כשיש יותר מסדרה אחת. */
export function SharesLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted', className)} aria-label="מקרא">
      {DIMS.map((dim) => (
        <li key={dim} className="inline-flex items-center gap-1.5">
          <DimensionGlyph dim={dim} size={16} variant="solid" decorative />
          <span dir="ltr">{DIM_LABEL[dim]}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- סדרה שבועית אחת: עמודות או קו ----------

export interface WeeklyPoint {
  id: string;
  label: string;
  /** null = אין נתונים בשבוע הזה (לא אפס). */
  value: number | null;
}

interface WeeklyChartProps {
  title: string;
  kind: 'bar' | 'line';
  points: WeeklyPoint[];
  /** צבע הסימנים (CSS). סדרה אחת — אין צורך במקרא, הכותרת נותנת לה שם. */
  color: string;
  formatValue: (value: number) => string;
  /** גבול עליון קבוע לציר (למשל 1 לאחוזים). בלי זה — לפי הערך המרבי. */
  max?: number;
}

/** גרף שבועי קטן של סדרה אחת. ציר הזמן RTL; הערך האחרון מתויג ישירות; יש טבלה חלופית. */
export function WeeklyChart({ title, kind, points, color, formatValue, max }: WeeklyChartProps) {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  if (values.length === 0) return null;
  const top = max ?? (Math.max(...values) * 1.15 || 1);
  const pad = { top: 18, bottom: 24, left: 8, right: 8 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const slot = plotW / points.length;
  const x = (index: number) => W - pad.right - slot * (index + 0.5);
  const y = (value: number) => pad.top + (1 - Math.min(value / top, 1)) * plotH;
  const lastIndex = points.reduce((found, p, i) => (p.value === null ? found : i), -1);
  const drawn = points.map((p, i) => ({ ...p, i })).filter((p): p is WeeklyPoint & { i: number; value: number } => p.value !== null);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${drawn.map((p) => `${p.label}: ${formatValue(p.value)}`).join('. ')}`} className="w-full">
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
        {kind === 'bar' &&
          drawn.map((p) => {
            const barW = Math.min(16, slot * 0.5);
            const barH = Math.max(y(0) - y(p.value), 2);
            return <rect key={p.id} x={x(p.i) - barW / 2} y={y(0) - barH} width={barW} height={barH} rx={4} fill={color} />;
          })}
        {kind === 'line' && (
          <>
            <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={drawn.map((p) => `${x(p.i)},${y(p.value)}`).join(' ')} />
            {drawn.map((p) => (
              <circle key={p.id} cx={x(p.i)} cy={y(p.value)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </>
        )}
        {points.map((p, i) => (
          <text key={p.id} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
            {p.label}
          </text>
        ))}
        {lastIndex >= 0 && (
          <text x={x(lastIndex)} y={y(points[lastIndex]!.value!) - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">
            {formatValue(points[lastIndex]!.value!)}
          </text>
        )}
      </svg>
      <figcaption>
        <details className="text-sm">
          <summary className="flex min-h-12 cursor-pointer items-center text-muted">הצג כטבלה</summary>
          <table className="tabular w-full">
            <tbody>
              {points.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <th scope="row" className="py-1.5 text-start font-normal text-muted">
                    {p.label}
                  </th>
                  <td className="py-1.5 text-end">{p.value === null ? '—' : formatValue(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </figcaption>
    </figure>
  );
}
