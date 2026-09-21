import {
  BookOpen,
  ChartColumn,
  Compass,
  DatabaseBackup,
  House,
  LifeBuoy,
  NotebookPen,
  Route,
  Settings,
  Wind,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** התאמה מדויקת לנתיב (לדף הבית). */
  end?: boolean;
}

/** ניווט ראשי — חמישה פריטים בדיוק (SPEC פרק 5). */
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: '/', label: 'היום', Icon: House, end: true },
  { to: '/checkin', label: 'בדיקה', Icon: Compass },
  { to: '/shift', label: 'מעבר', Icon: Wind },
  { to: '/journey', label: 'מסע', Icon: Route },
  { to: '/insights', label: 'תובנות', Icon: ChartColumn },
];

/** ניווט משני — מאייקון הפרופיל בראש "היום". */
export const SECONDARY_NAV: readonly NavItem[] = [
  { to: '/journal', label: 'יומן', Icon: NotebookPen },
  { to: '/library', label: 'ספרייה', Icon: BookOpen },
  { to: '/settings', label: 'הגדרות', Icon: Settings },
  { to: '/backup', label: 'גיבוי', Icon: DatabaseBackup },
  { to: '/help', label: 'צריך עזרה?', Icon: LifeBuoy },
];
