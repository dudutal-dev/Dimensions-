import {
  BookOpen,
  ChartColumn,
  Compass,
  DatabaseBackup,
  LifeBuoy,
  NotebookPen,
  Route as RouteIcon,
  Settings,
  Timer,
  Wind,
} from 'lucide-react';
import { createHashRouter, type RouteObject } from 'react-router-dom';
import { TodayPage } from '../features/today/TodayPage';
import { ComingSoon } from './ComingSoon';
import { Shell } from './Shell';

/**
 * Hash router — תואם GitHub Pages, ומאפשר deep link לכל מסך ראשי
 * (#/checkin · #/shift/heart-drop · #/journey/w04 · #/design).
 * המסכים שעוד לא נבנו מוצגים כ-ComingSoon, ויוחלפו אחד-אחד באבני הדרך הבאות.
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <TodayPage /> },
      {
        path: 'checkin',
        element: <ComingSoon title="בדיקת מימד" text="חמישה צעדים, שישים שניות: נשימה, כיווץ, מחשבה, רגש, זמן." milestone="M3" Icon={Compass} />,
      },
      {
        path: 'shift/:toolId?',
        element: <ComingSoon title="מעבר" text="ארגז הכלים: מאיפה אני בא, לפי טריגר, ולפי תחום חיים." milestone="M5" Icon={Wind} />,
      },
      {
        path: 'journey/:weekId?',
        element: <ComingSoon title="מסע" text="תכנית 12 השבועות: קרקע, המתבונן והצל, לב ונוכחות." milestone="M7" Icon={RouteIcon} />,
      },
      {
        path: 'insights',
        element: <ComingSoon title="תובנות" text="מפת החום האישית שלך, זמן התאוששות, ומה עובד לך." milestone="M8" Icon={ChartColumn} />,
      },
      {
        path: 'sos',
        element: <ComingSoon title="90 שניות" text="שם, גוף, רווח, לב, פעולה — המעבר המהיר." milestone="M4" Icon={Timer} />,
      },
      {
        path: 'journal',
        element: <ComingSoon title="יומן" text="יומן ערב, יומן טריגרים וחקירת אמונות." milestone="M8" Icon={NotebookPen} />,
      },
      {
        path: 'library',
        element: <ComingSoon title="ספרייה" text="המודל, חמשת הערוצים, זיוף 5D ונספח הפיזיקה." milestone="M9" Icon={BookOpen} />,
      },
      {
        path: 'settings',
        element: <ComingSoon title="הגדרות" text="ערכת צבע, גודל טקסט, צלילים ושעות העוגנים." milestone="M9" Icon={Settings} />,
      },
      {
        path: 'backup',
        element: <ComingSoon title="גיבוי" text="ייצוא וייבוא של כל הנתונים שלך, בקובץ אחד." milestone="M2" Icon={DatabaseBackup} />,
      },
      {
        path: 'help',
        element: <ComingSoon title="צריך עזרה?" text="סימנים שכדאי לעצור, ואל מי לפנות." milestone="M9" Icon={LifeBuoy} />,
      },
      {
        path: 'design',
        lazy: async () => ({ Component: (await import('../features/design/DesignPage')).DesignPage }),
      },
      { path: '*', element: <ComingSoon title="לא מצאתי את המסך הזה" text="אפשר לחזור דרך הניווט שלמטה." milestone="—" Icon={Compass} /> },
    ],
  },
];

export const router = createHashRouter(routes);
