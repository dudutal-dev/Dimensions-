import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

/** בדיקות קצה-לקצה (ARD-9): מובייל תחילה — iPhone 14 (WebKit) ו-Pixel 7 (Chromium), ואז דסקטופ. */
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  // WebKit על Windows איטי; מעט workers וזמן נדיב מונעים כישלונות-שווא של עומס.
  workers: 3,
  timeout: 60_000,
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
