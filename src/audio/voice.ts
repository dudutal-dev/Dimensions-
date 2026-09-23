/**
 * קול ההדרכה של המכשיר (Web Speech API) — הגשר עד שיגיעו קובצי הקול המופקים מראש של שלב ב' (SPEC פרק 10).
 * מקומי לגמרי: אין רשת, אין מפתח. איכות הקול העברי תלויה במכשיר (ב-iOS יש קול עברי מובנה; ב-Android — אם חבילת
 * הקולות של Google מותקנת; בדסקטופ לא תמיד). כשאין קול בשפה — hasVoice() מחזיר false והנגן נופל לפעמון רך.
 *
 * הכללים (SPEC 10.3): מדברים רק הנחיות ושאלות; שתיקות וספירת הנשימות אינן מדוברות.
 */

export type VoiceLang = 'he' | 'en';

const LANG_TAG: Record<VoiceLang, string> = { he: 'he-IL', en: 'en-US' };

/** קצב איטי מעט מהרגיל — טון מדיטטיבי; מתחת ל-0.85 קולות מערכת מתחילים להישמע מרוחים. */
const RATE = 0.88;

function synth(): SpeechSynthesis | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;
}

/** הקולות נטענים אסינכרונית בחלק מהדפדפנים — הרשימה עשויה להיות ריקה בקריאה הראשונה. */
export function voicesFor(lang: VoiceLang): SpeechSynthesisVoice[] {
  const all = synth()?.getVoices() ?? [];
  const prefix = lang === 'he' ? 'he' : 'en';
  return all.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));
}

export function hasVoice(lang: VoiceLang): boolean {
  return voicesFor(lang).length > 0;
}

/** מעדיף קול מקומי (לא רשת) — עובד גם במצב טיסה — ואחריו את ברירת המחדל של המערכת. */
function pickVoice(lang: VoiceLang): SpeechSynthesisVoice | undefined {
  const candidates = voicesFor(lang);
  return candidates.find((v) => v.localService && v.default) ?? candidates.find((v) => v.localService) ?? candidates[0];
}

export interface SpeakOptions {
  lang: VoiceLang;
  /** 0–1 */
  volume: number;
  onStart?: () => void;
}

export class DeviceVoice {
  private current: SpeechSynthesisUtterance | null = null;

  get supported(): boolean {
    return Boolean(synth());
  }

  /** מדבר משפט אחד; ההבטחה נפתרת כשהדיבור נגמר (או נעצר). דיבור קודם נעצר. */
  speak(text: string, { lang, volume, onStart }: SpeakOptions): Promise<void> {
    const s = synth();
    const clean = text.trim();
    if (!s || !clean) return Promise.resolve();
    this.stop();
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = LANG_TAG[lang];
      const voice = pickVoice(lang);
      if (voice) utterance.voice = voice;
      utterance.rate = RATE;
      utterance.pitch = 1;
      utterance.volume = Math.max(0, Math.min(1, volume));
      const done = () => {
        if (this.current === utterance) this.current = null;
        resolve();
      };
      utterance.onstart = () => onStart?.();
      utterance.onend = done;
      utterance.onerror = done;
      this.current = utterance;
      s.speak(utterance);
    });
  }

  stop(): void {
    const s = synth();
    if (!s) return;
    this.current = null;
    if (s.speaking || s.pending) s.cancel();
  }

  get speaking(): boolean {
    return Boolean(synth()?.speaking);
  }
}
