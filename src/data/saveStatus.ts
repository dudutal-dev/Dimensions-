/**
 * מצב השמירה האוטומטית. כל כתיבה שמקורה בקלט של המשתמש עוברת דרך tracked(),
 * והמסכים מציגים את החיווי העדין "נשמר" (SPEC פרק 7) דרך useSavedFlash().
 */
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusStore {
  state: SaveState;
  /** מונה שמירות שהצליחו — משמש להבהוב החיווי. */
  savedCount: number;
  pending: number;
}

export const useSaveStatus = create<SaveStatusStore>(() => ({ state: 'idle', savedCount: 0, pending: 0 }));

/** עוטף פעולת כתיבה ומעדכן את מצב השמירה. השגיאה נזרקת הלאה — המסך מחליט מה להציג. */
export async function tracked<T>(operation: Promise<T>): Promise<T> {
  useSaveStatus.setState((s) => ({ state: 'saving', pending: s.pending + 1 }));
  try {
    const value = await operation;
    useSaveStatus.setState((s) => {
      const pending = Math.max(0, s.pending - 1);
      return { pending, savedCount: s.savedCount + 1, state: pending === 0 ? 'saved' : 'saving' };
    });
    return value;
  } catch (error) {
    useSaveStatus.setState((s) => ({ pending: Math.max(0, s.pending - 1), state: 'error' }));
    throw error;
  }
}

const FLASH_MS = 2000;

/** true למשך שתי שניות אחרי כל שמירה מוצלחת. */
export function useSavedFlash(): boolean {
  const savedCount = useSaveStatus((s) => s.savedCount);
  const [visible, setVisible] = useState(false);
  // המונה גלובלי: מהבהבים רק על שמירה שקרתה אחרי שהמסך הזה עלה, לא על שמירות קודמות בסשן
  const seen = useRef(savedCount);

  useEffect(() => {
    if (savedCount === seen.current) return;
    seen.current = savedCount;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [savedCount]);

  return visible;
}
