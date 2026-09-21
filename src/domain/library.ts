/**
 * ספרייה (SPEC 6.11) — לוגיקה טהורה: טקסט לחיפוש מתוך המאמרים (כולל תוכן שמופנה מקבצים אחרים),
 * חיפוש חופשי בעברית, ונעילת "תרגולים מתקדמים" עד סוף המסע.
 */
import type { ContentBundle, LibraryBlock, LibraryContent } from '../content/schema';
import type { JourneyState } from './records';

export type Article = LibraryContent['articles'][number];

const MARKUP = /\*\*|\*|\{\{(?:established|speculative|metaphoric)\}\}/g;
/** טעמים וניקוד (U+0591–U+05C7) — נבנה מקודי תווים, כדי שלא יהיו בקוד תווים בלתי-נראים. */
const NIQQUD = new RegExp(`[${String.fromCharCode(0x0591)}-${String.fromCharCode(0x05c7)}]`, 'g');
const QUOTES = /["'“”‘’״׳`]/g;
const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** טקסט נקי לחיפוש ולתצוגת קטע: בלי סימוני העיצוב ובלי ניקוד ("חיוּת" נמצא גם כשמחפשים "חיות"). */
export const plain = (text: string): string => text.replace(MARKUP, '').replace(NIQQUD, '');

/** מנרמל להשוואה: גרשיים כרווח, אותיות סופיות כרגילות, לטיניות קטנות. האורך נשמר — כדי שמיקום ההתאמה יתאים לטקסט הנקי. */
export function normalize(text: string): string {
  return plain(text)
    .replace(QUOTES, ' ')
    .replace(/[ךםןףץ]/g, (letter) => FINALS[letter] ?? letter)
    .toLowerCase();
}

/** הטקסט שמאחורי בלוק — כולל בלוקי הפניה, כדי שחיפוש "ריצוי" ימצא את טבלת זיוף 5D. */
function blockTexts(block: LibraryBlock, content: ContentBundle): string[] {
  switch (block.type) {
    case 'p':
    case 'h':
    case 'formula':
    case 'callout':
      return [block.text];
    case 'list':
      return block.items;
    case 'table':
      return [...block.columns, ...block.rows.flat()];
    case 'ref':
      return refTexts(block.ref, content);
  }
}

function refTexts(ref: Extract<LibraryBlock, { type: 'ref' }>['ref'], content: ContentBundle): string[] {
  const { model, channels, fake5d, tools, safety } = content;
  switch (ref) {
    case 'model.states':
      return [...model.states.flatMap((s) => [s.label, s.title, s.causality, ...s.aspects.flatMap((a) => [a.label, a.text]), s.gift, ...(s.traps ?? []), s.hallmark ?? '']), model.nesting.title, model.nesting.text];
    case 'model.summary':
      return model.summary.flatMap((r) => [r.axis, r.d3, r.d4, r.d5]);
    case 'model.comparison':
      return model.comparison.flatMap((r) => [r.axis, r.d3, r.d4, r.d5]);
    case 'model.parallels':
      return [...model.parallels.rows.flatMap((r) => [r.model, r.d3, r.d4, r.d5]), model.parallels.note];
    case 'channels':
      return [
        channels.principle,
        ...channels.channels.flatMap((c) => [
          c.title,
          c.tagline ?? '',
          ...(c.table ?? []).flatMap((r) => [r.axis, r.d3, r.d4, r.d5]),
          ...(c.descriptions ? [c.descriptions.d3, c.descriptions.d4, c.descriptions.d5] : []),
          ...(c.quickTest ? [c.quickTest.question, c.quickTest.answers.d3, c.quickTest.answers.d4, c.quickTest.answers.d5] : []),
          ...(c.notes ?? []).map((n) => n.text),
          c.exercise ?? '',
        ]),
      ];
    case 'channels.recognitionLevels':
      return channels.recognitionLevels.flatMap((l) => [l.name, l.weeks, l.text]);
    case 'fake5d':
      return [fake5d.intro, ...fake5d.rows.flatMap((r) => [r.looksLike, r.actually, r.howToTell]), fake5d.goldenTest];
    case 'tools.gates':
      return [tools.gates.intro, ...tools.gates.items.map((i) => i.label), tools.gates.task];
    case 'safety.warningSigns':
      return [safety.help.healthyPractice, ...safety.help.warningSigns.map((s) => s.text)];
  }
}

export function articleText(article: Article, content: ContentBundle): string {
  return [article.title, article.summary ?? '', ...article.blocks.flatMap((b) => blockTexts(b, content))].map(plain).join(' · ');
}

export interface LibraryHit {
  article: Article;
  /** קטע קצר סביב ההתאמה הראשונה בגוף המאמר; ריק כשההתאמה בכותרת בלבד. */
  snippet: string;
  inTitle: boolean;
}

const SNIPPET_BEFORE = 40;
const SNIPPET_AFTER = 90;

function snippetAround(text: string, index: number): string {
  let start = Math.max(0, index - SNIPPET_BEFORE);
  let end = Math.min(text.length, index + SNIPPET_AFTER);
  // לא חותכים מילה באמצע
  if (start > 0) start = text.indexOf(' ', start) + 1 || start;
  if (end < text.length) end = text.lastIndexOf(' ', end) > start ? text.lastIndexOf(' ', end) : end;
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export const MIN_QUERY_LENGTH = 2;

/** חיפוש חופשי: כל מילות השאילתה חייבות להופיע במאמר. התאמות בכותרת קודמות. */
export function searchLibrary(content: ContentBundle, query: string, options: { includeLocked?: boolean } = {}): LibraryHit[] {
  const words = normalize(query)
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.join('').length < MIN_QUERY_LENGTH) return [];

  const hits: Array<LibraryHit & { score: number }> = [];
  for (const article of content.library.articles) {
    // מאמר נעול אינו נחשף דרך החיפוש
    if (article.lockedUntilJourneyComplete && !options.includeLocked) continue;
    const text = articleText(article, content);
    const haystack = normalize(text);
    if (!words.every((w) => haystack.includes(w))) continue;

    const title = normalize(article.title);
    const inTitle = words.every((w) => title.includes(w));
    const body = text.slice(plain(article.title).length);
    const bodyIndex = normalize(body).indexOf(words[0]!);
    const occurrences = words.reduce((sum, w) => sum + (haystack.split(w).length - 1), 0);
    hits.push({ article, inTitle, snippet: bodyIndex >= 0 ? snippetAround(body, bodyIndex) : '', score: (inTitle ? 1000 : 0) + occurrences });
  }
  return hits.sort((a, b) => b.score - a.score).map(({ score: _score, ...hit }) => hit);
}

/** "תרגולים מתקדמים" נפתחים רק אחרי השלמת 12 השבועות. */
export function isLocked(article: Article, journey: Pick<JourneyState, 'completedAt'> | undefined): boolean {
  return Boolean(article.lockedUntilJourneyComplete) && !journey?.completedAt;
}

export function articlesBySection(library: LibraryContent): Array<{ section: LibraryContent['sections'][number]; articles: Article[] }> {
  return library.sections.map((section) => ({ section, articles: library.articles.filter((a) => a.section === section.id) }));
}
