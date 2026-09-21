import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { splashLinks } from './tools/pwa-assets.mjs';

// npm run dev:phone — שרת פיתוח ב-HTTPS (תעודה עצמית) שנגיש מהטלפון באותה רשת Wi-Fi.
// נדרש לבדיקות הקבלה על iPhone: Wake Lock, שיתוף קבצים ואחסון מוגן עובדים רק בהקשר מאובטח.
const forPhone = process.env.DC_PHONE === '1';

/** מסכי הפתיחה של iOS: תגית link לכל מכשיר ולכל ערכת צבע — נוצרות מאותה רשימה שממנה מופקות התמונות. */
const iosSplash: Plugin = {
  name: 'dc-ios-splash',
  transformIndexHtml: () => splashLinks('./') as HtmlTagDescriptor[],
};

export default defineConfig({
  // נתיבים יחסיים — האתר רץ מתת-תיקייה ב-GitHub Pages (ARD-10).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    iosSplash,
    VitePWA({
      // עדכון בהסכמה: גרסה חדשה ממתינה עד שהמשתמש בוחר לרענן — לעולם לא באמצע תרגול.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'מצפן המימדים',
        short_name: 'מצפן',
        description: 'מאמן אישי לזיהוי מצב התודעה ולמעבר בין מצבים. הכול נשמר במכשיר.',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0F1A',
        theme_color: '#0B0F1A',
        categories: ['health', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'בדיקת מימד', short_name: 'בדיקה', url: './#/checkin', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: '90 שניות', url: './#/sos', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // כל שלב א' עובד במצב טיסה אחרי טעינה ראשונה (SPEC פרק 11): קוד, סגנון, גופנים ואייקונים.
        // מסכי הפתיחה של iOS נטענים על ידי המערכת עצמה, ולכן אינם ב-precache.
        globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest}', 'icons/*.png'],
        globIgnores: ['splash/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
    ...(forPhone ? [basicSsl()] : []),
  ],
  server: forPhone ? { host: true } : undefined,
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    css: false,
  },
});
