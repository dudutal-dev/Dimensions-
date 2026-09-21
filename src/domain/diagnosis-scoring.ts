/**
 * האבחון המלא — "הדפוס הדומיננטי שלי" (SPEC 6.4). לוגיקה טהורה.
 *  - סדר התשובות מעורבב (לא תמיד א = 3D), באופן דטרמיניסטי לפי seed — כדי שהסדר יישאר יציב
 *    ברענון, ושהאותיות בטקסט ששותף עם אדם קרוב יתאימו למסך הזנת התשובות.
 *  - ניקוד: אחוזי 3D / 4D / 5D בסך הכול ולכל תחום; הפער הגדול ביותר בין התחומים הוא מוקד העבודה.
 */
import type { DiagDomain, DiagnosisContent, Dim } from '../content/schema';
import type { Diagnosis } from './records';

export type DiagAnswers = Record<string, Dim>;
export type Shares = Record<Dim, number>;

const DIMS: readonly Dim[] = ['d3', 'd4', 'd5'];
export const LETTERS = ['א', 'ב', 'ג'] as const;

// ---------- ערבוב דטרמיניסטי ----------

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** סדר התשובות של שאלה, לפי ה-seed של השאלון הנוכחי. */
export function optionOrder(seed: string, questionId: string): Dim[] {
  const random = mulberry32(hash(`${seed}:${questionId}`));
  const order = [...DIMS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

export function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- ניקוד ----------

function sharesOf(dims: Dim[]): Shares {
  const total = dims.length || 1;
  const count = (dim: Dim) => dims.filter((d) => d === dim).length / total;
  return { d3: count('d3'), d4: count('d4'), d5: count('d5') };
}

export interface DiagnosisScore {
  overall: Shares;
  byDomain: Record<DiagDomain, Shares>;
}

export function scoreDiagnosis(content: DiagnosisContent, answers: DiagAnswers): DiagnosisScore {
  const answered = content.questions.filter((q) => answers[q.id]);
  const byDomain = {} as Record<DiagDomain, Shares>;
  for (const domain of content.domains) {
    byDomain[domain.id] = sharesOf(answered.filter((q) => q.domain === domain.id).map((q) => answers[q.id]!));
  }
  return { overall: sharesOf(answered.map((q) => answers[q.id]!)), byDomain };
}

export function isComplete(content: DiagnosisContent, answers: DiagAnswers): boolean {
  return content.questions.every((q) => answers[q.id]);
}

export type ProfileId = DiagnosisContent['interpretation']['profiles'][number]['id'];

/** דומיננטיות: מעל הסף ב-3D או ב-5D; אחרת 4D — "או פיזור", כלשון המקור. */
export function profileOf(overall: Shares, threshold: number): ProfileId {
  if (overall.d3 > threshold) return 'd3-dominant';
  if (overall.d5 > threshold) return 'd5-dominant';
  return 'd4-dominant';
}

/** "מדרגה" ממוצעת של תחום: 0 = כולו 3D, 2 = כולו 5D. משמשת רק להשוואה בין תחומים ובין מדידות. */
export function levelOf(shares: Shares): number {
  return shares.d4 + 2 * shares.d5;
}

export interface DomainGap {
  lowest: DiagDomain;
  highest: DiagDomain;
  /** ההפרש במדרגות (0..2). */
  size: number;
}

/** הפער הגדול ביותר בין התחומים — מוקד העבודה. null כשכל התחומים באותה מדרגה. */
export function biggestGap(byDomain: Record<DiagDomain, Shares>, order: DiagDomain[]): DomainGap | null {
  const levels = order.map((id) => ({ id, level: levelOf(byDomain[id]) }));
  const lowest = levels.reduce((a, b) => (b.level < a.level ? b : a));
  const highest = levels.reduce((a, b) => (b.level > a.level ? b : a));
  const size = highest.level - lowest.level;
  return size > 0 ? { lowest: lowest.id, highest: highest.id, size } : null;
}

// ---------- "שאל אדם קרוב" ----------

/** הטקסט לשיתוף: 12 השאלות בגוף שלישי, עם תשובות א/ב/ג בסדר המעורבב. המפתח אינו נחשף. */
export function buildShareText(content: DiagnosisContent, userName: string, seed: string): string {
  const name = userName.trim() || 'הוא';
  const lines: string[] = [content.askOther.shareText, ''];
  content.questions.forEach((question, index) => {
    lines.push(`${index + 1}. ${question.thirdPerson.stem.replaceAll('{name}', name)}`);
    optionOrder(seed, question.id).forEach((dim, position) => {
      const option = question.thirdPerson.options.find((o) => o.dim === dim)!;
      lines.push(`   ${LETTERS[position]}. ${option.text}`);
    });
    lines.push('');
  });
  return lines.join('\n').trim();
}

/** ממיר אות שהתקבלה (א/ב/ג) למצב, לפי אותו seed שבו נבנה הטקסט. */
export function dimForLetter(seed: string, questionId: string, letterIndex: number): Dim | undefined {
  return optionOrder(seed, questionId)[letterIndex];
}

// ---------- השוואה ומגמה ----------

export interface DomainComparison {
  domain: DiagDomain;
  self: Shares;
  other: Shares;
  /** חיובי = אני רואה את עצמי גבוה יותר ממה שרואים אותי (ההטיה הצפויה של שאלון עצמי). */
  bias: number;
}

export function compareDiagnoses(self: Diagnosis, other: Diagnosis, order: DiagDomain[]): { overallBias: number; domains: DomainComparison[] } {
  return {
    overallBias: levelOf(self.overall) - levelOf(other.overall),
    domains: order.map((domain) => {
      const mine = self.byDomain[domain] ?? { d3: 0, d4: 0, d5: 0 };
      const theirs = other.byDomain[domain] ?? { d3: 0, d4: 0, d5: 0 };
      return { domain, self: mine, other: theirs, bias: levelOf(mine) - levelOf(theirs) };
    }),
  };
}

/** המדידות העצמיות לאורך זמן, מהישנה לחדשה — לגרף המגמה. */
export function trendOf(diagnoses: Diagnosis[]): Array<{ id: string; ts: number; weekMarker?: number; overall: Shares }> {
  return diagnoses
    .filter((d) => d.by === 'self')
    .sort((a, b) => a.ts - b.ts)
    .map((d) => ({ id: d.id, ts: d.ts, weekMarker: d.weekMarker, overall: d.overall }));
}

export const MARKER_WEEKS = [0, 4, 8, 12] as const;

/** סימון נקודת הבדיקה (שבוע 0 / 4 / 8 / 12) — פעם אחת לכל נקודה. */
export function weekMarkerFor(currentWeek: number, existing: Diagnosis[]): 0 | 4 | 8 | 12 | undefined {
  const marker = MARKER_WEEKS.find((w) => w === currentWeek);
  if (marker === undefined) return undefined;
  return existing.some((d) => d.by === 'self' && d.weekMarker === marker) ? undefined : marker;
}
