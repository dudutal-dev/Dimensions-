/**
 * הגנה על הנתונים מפני פינוי אוטומטי. דפדפנים (בעיקר Safari) עלולים למחוק אחסון של אתר
 * שלא נפתח זמן רב; בקשת persist ואפליקציה מותקנת למסך הבית מצמצמות את הסיכון.
 * הנתונים כאן מצטברים חודשים — לכן מבקשים פעם אחת, בשקט, בלי לחסום דבר.
 */
export type PersistenceStatus = 'persisted' | 'best-effort' | 'unsupported';

export async function ensurePersistentStorage(): Promise<PersistenceStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}
