export type SaveFileOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * שומר קובץ אצל המשתמש. בטלפון (ובמיוחד ב-PWA מותקן ב-iOS, שבו הורדה רגילה אינה אמינה)
 * נפתח גיליון השיתוף — "שמור בקבצים"; בדסקטופ — הורדה רגילה.
 */
export async function saveTextFile(fileName: string, text: string, mimeType = 'application/json'): Promise<SaveFileOutcome> {
  const file = new File([text], fileName, { type: mimeType });
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  if (touch && navigator.canShare?.({ files: [file] })) {
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
