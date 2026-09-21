export type SaveFileOutcome = 'shared' | 'downloaded' | 'cancelled';
/**
 * share-on-touch — בכל מכשיר מגע נפתח גיליון השיתוף (גיבוי).
 * open-in-browser — בדפדפן רגיל הקובץ נפתח ישירות (כך Safari מציע "הוסף ליומן" לקובץ ics); רק ב-PWA מותקן, שבו הורדה אינה אמינה, משתפים.
 */
export type SaveFileMode = 'share-on-touch' | 'open-in-browser';

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || (window.matchMedia?.('(display-mode: standalone)').matches ?? false);
}

/**
 * שומר קובץ אצל המשתמש. בטלפון (ובמיוחד ב-PWA מותקן ב-iOS, שבו הורדה רגילה אינה אמינה)
 * נפתח גיליון השיתוף — "שמור בקבצים"; בדסקטופ — הורדה רגילה.
 */
export async function saveTextFile(fileName: string, text: string, mimeType = 'application/json', mode: SaveFileMode = 'share-on-touch'): Promise<SaveFileOutcome> {
  const file = new File([text], fileName, { type: mimeType });
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const wantsShare = mode === 'share-on-touch' ? touch : touch && isStandalone();

  if (wantsShare && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // שיתוף נכשל מסיבה אחרת — ממשיכים להורדה רגילה.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
