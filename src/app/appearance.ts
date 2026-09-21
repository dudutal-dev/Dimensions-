/**
 * ערכת צבע וגודל טקסט. נשמרים ב-localStorage (ולא ב-Dexie) כדי שה-script שב-index.html
 * יוכל להחיל אותם לפני הציור הראשון. שאר ההגדרות יעברו ל-Dexie ב-M2.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeChoice = 'system' | 'dark' | 'light';
export const TEXT_SCALES = [0.9, 1, 1.12, 1.25] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

interface AppearanceState {
  theme: ThemeChoice;
  textScale: TextScale;
  setTheme: (theme: ThemeChoice) => void;
  setTextScale: (scale: TextScale) => void;
}

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'system',
      textScale: 1,
      setTheme: (theme) => set({ theme }),
      setTextScale: (textScale) => set({ textScale }),
    }),
    { name: 'dc.appearance' },
  ),
);

export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): 'dark' | 'light' {
  if (choice !== 'system') return choice;
  return prefersLight ? 'light' : 'dark';
}

/** מחיל את ההגדרות על <html>, ועוקב אחרי שינוי ערכת המערכת ואחרי הסתרת הלשונית (לעצירת ההילה). */
export function useApplyAppearance(): void {
  const theme = useAppearance((s) => s.theme);
  const textScale = useAppearance((s) => s.textScale);

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
