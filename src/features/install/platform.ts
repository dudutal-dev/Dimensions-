export type Platform = 'ios' | 'android' | 'desktop';

/** זיהוי גס של המכשיר — רק כדי להציג קודם את ההוראות הרלוונטיות. iPad מודרני מזדהה כ-Mac, ולכן בודקים גם מגע. */
export function platformOf(userAgent: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}
