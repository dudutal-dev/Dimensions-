import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // נתיבים יחסיים — האתר רץ מתת-תיקייה ב-GitHub Pages (ARD-10).
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    css: false,
  },
});
