import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

// זמנים קבועים בבדיקות (למשל "21:40" ליומן הערב) נכתבים ב-new Date('…') ומפוענחים באזור הזמן של תהליך הבדיקה.
// ב-CI התהליך רץ ב-UTC, ולכן "21:40" הפך שם ל-00:40 בישראל והבדיקות נכשלו. מיישרים את תהליך הבדיקות לאזור הזמן של הדפדפן.
process.env.TZ = 'Asia/Jerusalem';

/**
 * שלוש הרצות: ברירת המחדל (הזרימות), "sweep" (סריקת QA כבדה של כל המסכים), ו-"perf" (מדידת טעינה — worker יחיד,
 * כי מדידה לצד בדיקות אחרות על אותה מכונה חסרת משמעות). ההפרדה שומרת על החבילה הרגילה יציבה תחת עומס.
 */
const RUN = process.env.DC_E2E;

/** בדיקות קצה-לקצה (ARD-9): מובייל תחילה — iPhone 14 (WebKit) ו-Pixel 7 (Chromium), ואז דסקטופ. */
export default defineConfig({
  testDir: 'tests/e2e',
  grep: RUN === 'sweep' ? /@sweep/ : RUN === 'perf' ? /@perf/ : undefined,
  grepInvert: RUN ? undefined : /@sweep|@perf/,
  outputDir: 'test-results',
  fullyParallel: true,
  // WebKit על Windows איטי; מעט workers וזמן נדיב מונעים כישלונות-שווא של עומס.
  workers: RUN === 'perf' ? 1 : RUN === 'sweep' ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'pixel', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    // רצים מול ה-build האמיתי (כמו ב-GitHub Pages), לא מול שרת הפיתוח.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
