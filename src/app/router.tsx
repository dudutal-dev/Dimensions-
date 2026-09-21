import {
  BookOpen,
  Compass,
  LifeBuoy,
  Settings,
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
    path: '/session/:id',
    lazy: async () => ({ Component: (await import('../features/session/SessionPage')).SessionPage }),
  },
  {
    path: '/sos',
    lazy: async () => {
      const { SessionPage } = await import('../features/session/SessionPage');
      return { Component: () => <SessionPage sessionId="sos90" source="sos" autoStart /> };
    },
  },
  {
    path: '/welcome',
    lazy: async () => ({ Component: (await import('../features/onboarding/OnboardingPage')).OnboardingPage }),
  },
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <TodayPage /> },
      {
        path: 'checkin',
        lazy: async () => ({ Component: (await import('../features/checkin/CheckinPage')).CheckinPage }),
      },
      {
        path: 'diagnosis',
        lazy: async () => ({ Component: (await import('../features/diagnosis/DiagnosisHubPage')).DiagnosisHubPage }),
      },
      {
        path: 'diagnosis/self',
        lazy: async () => ({ Component: (await import('../features/diagnosis/QuestionnairePage')).QuestionnairePage }),
      },
      {
        path: 'diagnosis/other',
        lazy: async () => ({ Component: (await import('../features/diagnosis/AskOtherPage')).AskOtherPage }),
      },
      {
        path: 'diagnosis/compare',
        lazy: async () => ({ Component: (await import('../features/diagnosis/ComparePage')).ComparePage }),
      },
      {
        path: 'diagnosis/result/:id',
        lazy: async () => ({ Component: (await import('../features/diagnosis/DiagnosisResultPage')).DiagnosisResultPage }),
      },
      {
        path: 'shift/:toolId?',
        lazy: async () => ({ Component: (await import('../features/shift/ShiftPage')).ShiftPage }),
      },
      {
        path: 'journey',
        lazy: async () => ({ Component: (await import('../features/journey/JourneyPage')).JourneyPage }),
      },
      {
        path: 'journey/:weekId',
        lazy: async () => ({ Component: (await import('../features/journey/WeekPage')).WeekPage }),
      },
      {
        path: 'insights',
        lazy: async () => ({ Component: (await import('../features/insights/InsightsPage')).InsightsPage }),
      },
      {
        path: 'practice',
        lazy: async () => ({ Component: (await import('../features/session/PracticeListPage')).PracticeListPage }),
      },
      {
        path: 'journal',
        lazy: async () => ({ Component: (await import('../features/journal/JournalPage')).JournalPage }),
      },
      {
        path: 'journal/evening/:date?',
        lazy: async () => ({ Component: (await import('../features/journal/EveningPage')).EveningPage }),
      },
      {
        path: 'journal/form/:id',
        lazy: async () => ({ Component: (await import('../features/journal/FormViewPage')).FormViewPage }),
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
        lazy: async () => ({ Component: (await import('../features/backup/BackupPage')).BackupPage }),
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
