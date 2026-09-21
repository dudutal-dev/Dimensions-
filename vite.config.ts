import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// npm run dev:phone — שרת פיתוח ב-HTTPS (תעודה עצמית) שנגיש מהטלפון באותה רשת Wi-Fi.
// נדרש לבדיקות הקבלה על iPhone: Wake Lock, שיתוף קבצים ואחסון מוגן עובדים רק בהקשר מאובטח.
const forPhone = process.env.DC_PHONE === '1';

export default defineConfig({
  // נתיבים יחסיים — האתר רץ מתת-תיקייה ב-GitHub Pages (ARD-10).
  base: './',
  plugins: [react(), tailwindcss(), ...(forPhone ? [basicSsl()] : [])],
  server: forPhone ? { host: true } : undefined,
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    css: false,
  },
});
