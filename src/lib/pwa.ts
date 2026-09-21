/**
 * PWA בזמן ריצה: רישום ה-service worker, עדכון בהסכמה, והתקנה למסך הבית.
 * עדכון לעולם אינו מרענן את הדף מעצמו — גרסה חדשה ממתינה עד שהמשתמש בוחר (ולא מוצעת בתוך תרגול).
 */
import { create } from 'zustand';

/** אירוע ההתקנה של Chrome/Android — אינו חלק מהטיפוסים התקניים. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** גרסה חדשה הורדה וממתינה. */
  needRefresh: boolean;
  /** כל הקבצים נשמרו — האפליקציה תעבוד גם בלי רשת. מוצג בשקט במסך ההתקנה, בלי הודעה קופצת. */
  offlineReady: boolean;
  /** הדפדפן מציע התקנה בלחיצה (Android, דסקטופ). ב-iOS ההתקנה ידנית בלבד. */
  canPromptInstall: boolean;
  installed: boolean;
  applyUpdate: () => void;
  dismissUpdate: () => void;
  promptInstall: () => Promise<boolean>;
}

let updateServiceWorker: ((reload?: boolean) => Promise<void>) | undefined;
let installEvent: BeforeInstallPromptEvent | undefined;

export const usePwa = create<PwaState>((set) => ({
  needRefresh: false,
  // service worker שכבר שולט בדף = ביקור חוזר, והקבצים כבר שמורים
  offlineReady: typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller),
  canPromptInstall: false,
  installed: false,
  applyUpdate: () => void updateServiceWorker?.(true),
  dismissUpdate: () => set({ needRefresh: false }),
  promptInstall: async () => {
    if (!installEvent) return false;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = undefined;
    set({ canPromptInstall: false, installed: outcome === 'accepted' });
    return outcome === 'accepted';
  },
}));

let started = false;

export function initPwa(): void {
  if (started) return;
  started = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // ההצעה מוצגת במסך "איך מתקינים", לא כבאנר של הדפדפן
    installEvent = event as BeforeInstallPromptEvent;
    usePwa.setState({ canPromptInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = undefined;
    usePwa.setState({ canPromptInstall: false, installed: true });
  });

  // בפיתוח אין service worker — כדי שקבצים ישנים לא יוגשו מה-cache בזמן עבודה.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => {
    updateServiceWorker = registerSW({
      onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
      onOfflineReady: () => usePwa.setState({ offlineReady: true }),
    });
  });
}
