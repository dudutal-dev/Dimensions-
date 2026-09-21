/**
 * ערוץ השפה (SPEC 6.10): ספירת סמני 3D מול סמני 5D בטקסט שהמשתמש כתב.
 * ביטויים רגולריים מקומיים בלבד — בלי AI, ובלי לשלוח שום דבר לשום מקום.
 * רשימת הסמנים והצורות שלהם נמצאת ב-channels.json, לא בקוד.
 */
import type { ChannelsContent, Dim } from '../content/schema';

type Markers = ChannelsContent['languageMarkers'];

const HEBREW = 'א-ת';
/** אותיות שימוש שיכולות להיצמד לפני המילה: ו, ש, כ, כש ("וחייב", "שתמיד", "כשאין ברירה"). */
const PREFIX = '(?:כש|[ושכ])?';

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternFor(forms: string[]): RegExp {
  // הצורות הארוכות קודם, כדי ש"אין לי ברירה" לא ייספר גם כ"אין ברירה".
  const alternatives = [...forms].sort((a, b) => b.length - a.length).map((form) => escape(form).replace(/ /g, '\\s+'));
  return new RegExp(`(?<![${HEBREW}])${PREFIX}(?:${alternatives.join('|')})(?![${HEBREW}])`, 'g');
}

export interface MarkerHit {
  id: string;
  label: string;
  dim: Dim;
  count: number;
}

export interface MarkerCounts {
  d3: number;
  d4: number;
  d5: number;
  words: number;
  hits: MarkerHit[];
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countMarkers(text: string, markers: Markers): MarkerCounts {
  const result: MarkerCounts = { d3: 0, d4: 0, d5: 0, words: countWords(text), hits: [] };
  for (const dim of ['d3', 'd4', 'd5'] as const) {
    for (const marker of markers[dim]) {
      const count = text.match(patternFor(marker.forms))?.length ?? 0;
      if (count === 0) continue;
      result[dim] += count;
      result.hits.push({ id: marker.id, label: marker.label, dim, count });
    }
  }
  result.hits.sort((a, b) => b.count - a.count);
  return result;
}

export interface DatedText {
  ts: number;
  text: string;
}

export interface LanguageWeek {
  weekStart: number;
  d3: number;
  d5: number;
  words: number;
  /** סמני 3D לכל 100 מילים — כך שבוע שבו כתבת הרבה לא נראה "גרוע" יותר. */
  d3Per100: number;
  d5Per100: number;
}

const WEEK_MS = 7 * 24 * 3_600_000;

/** מגמה שבועית עדינה. שבועות עם מעט מדי טקסט לא מוצגים — מספרים קטנים מטעים. */
export function languageTrend(texts: DatedText[], markers: Markers, now: number, weeks = 8, minWords = 30): LanguageWeek[] {
  const result: LanguageWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = now - (i + 1) * WEEK_MS;
    const combined = texts
      .filter((t) => t.ts > weekStart && t.ts <= weekStart + WEEK_MS)
      .map((t) => t.text)
      .join('\n');
    const counts = countMarkers(combined, markers);
    if (counts.words < minWords) continue;
    result.push({
      weekStart,
      d3: counts.d3,
      d5: counts.d5,
      words: counts.words,
      d3Per100: (counts.d3 / counts.words) * 100,
      d5Per100: (counts.d5 / counts.words) * 100,
    });
  }
  return result;
}
