import { loadContent } from '../../content';
import type { DiagDomain } from '../../content/schema';
import { SharesBar, SharesValues, type Shares } from '../../design';

interface ProfileBarsProps {
  byDomain: Partial<Record<DiagDomain, Shares>>;
  /** תחום שמודגש כ"מוקד העבודה". */
  highlight?: DiagDomain;
}

/** הפרופיל לפי תחום (SPEC 6.4): חמישה פסים מפולחים, והערכים כתובים מתחת לכל פס. */
export function ProfileBars({ byDomain, highlight }: ProfileBarsProps) {
  const { diagnosis } = loadContent();
  return (
    <ul className="flex flex-col gap-4">
      {diagnosis.domains.map((domain) => {
        const shares = byDomain[domain.id] ?? { d3: 0, d4: 0, d5: 0 };
        return (
          <li key={domain.id}>
            <p className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium">
              {domain.label}
              {highlight === domain.id && <span className="text-xs font-normal text-accent">מוקד העבודה</span>}
            </p>
            <SharesBar shares={shares} label={domain.label} />
            <SharesValues shares={shares} className="mt-1.5" />
          </li>
        );
      })}
    </ul>
  );
}

export const formatDate = (ts: number) => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts));
