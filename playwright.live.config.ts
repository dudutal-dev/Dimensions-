import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** אותן בדיקות, מול האתר הפרוס ב-GitHub Pages במקום מול ה-build המקומי:  npx playwright test -c playwright.live.config.ts */
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'https://dudutal-dev.github.io/Dimensions-/' },
  webServer: undefined,
});
