/** מחיל את ערכת הצבע ואת גודל הטקסט מההגדרות על <html>. ההגדרות עצמן: data/settingsStore.ts. */
import { useEffect } from 'react';
import { useSettings } from '../data/settingsStore';
import type { ThemeChoice } from '../domain/records';

export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): 'dark' | 'light' {
  if (choice !== 'system') return choice;
  return prefersLight ? 'light' : 'dark';
}

/** עוקב גם אחרי שינוי ערכת המערכת, ואחרי הסתרת הלשונית (לעצירת ההילה). */
export function useApplyAppearance(): void {
  const theme = useSettings((s) => s.settings.theme);
  const textScale = useSettings((s) => s.settings.textScale);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = resolveTheme(theme, media.matches);
      const root = document.documentElement;
      root.dataset.theme = resolved;
      // צבע שורת הסטטוס נלקח מה-token עצמו, כדי שלא יהיה hex כפול בקוד.
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(textScale));
  }, [textScale]);

  useEffect(() => {
    const onVisibility = () => {
      document.documentElement.toggleAttribute('data-hidden', document.hidden);
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
