/**
 * טיוטה שנשמרת אוטומטית — לזרימות רב-שלביות (בדיקה, אבחון, טפסים מודרכים).
 * סגירת הלשונית, נעילת המסך או קריסה לא מאבדות דבר: הערך נטען מחדש בכניסה הבאה.
 * הקשות נשמרות מיד; הקלדה נשמרת אחרי השהיה קצרה, ותמיד גם ביציאה מהמסך.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { repos as appRepos, type Repositories } from './repositories';
import { tracked } from './saveStatus';

const TYPING_DEBOUNCE_MS = 400;

interface DraftControls<T> {
  value: T;
  /** immediate: לשמירה מיידית (הקשה); ברירת המחדל מתאימה להקלדה. */
  setValue: (next: T | ((current: T) => T), options?: { immediate?: boolean }) => void;
  /** false עד שהטיוטה נטענה מהמסד. */
  loaded: boolean;
  /** מוחק את הטיוטה (אחרי שהזרימה הושלמה ונשמרה כרשומה). */
  clear: () => Promise<void>;
}

export function useDraft<T>(key: string, initial: T, repos: Repositories = appRepos): DraftControls<T> {
  const [value, setState] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(value);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    await tracked(repos.drafts.save(key, latest.current));
  }, [key, repos]);

  useEffect(() => {
    let cancelled = false;
    void repos.drafts.load<T>(key).then((draft) => {
      if (cancelled) return;
      if (draft && !dirty.current) {
        latest.current = draft.data;
        setState(draft.data);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key, repos]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  const setValue = useCallback<DraftControls<T>['setValue']>(
    (next, options) => {
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(latest.current) : next;
      latest.current = resolved;
      dirty.current = true;
      setState(resolved);
      window.clearTimeout(timer.current);
      if (options?.immediate) void flush();
      else timer.current = window.setTimeout(() => void flush(), TYPING_DEBOUNCE_MS);
    },
    [flush],
  );

  const clear = useCallback(async () => {
    window.clearTimeout(timer.current);
    dirty.current = false;
    await repos.drafts.clear(key);
  }, [key, repos]);

  return { value, setValue, loaded, clear };
}
