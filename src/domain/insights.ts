/**
 * תובנות (SPEC 6.9) — לוגיקה טהורה מעל הבדיקות, יומן הערב ויומן הסשנים.
 * הנתון החשוב הוא מפת החום האישית: מתי, איפה ועם מי אני בכל מצב. מודדים זמן התאוששות ושכיחות — לא "רמה".
 */
import type { Dim, Domain, DomainsContent } from '../content/schema';
import { primaryDim } from './checkin-scoring';
import type { CheckIn, EveningEntry, SessionLog } from './records';
import { toolStats } from './shift';
import { dayPartOf, MIN_CHECKINS_FOR_PATTERNS, type DayPart } from './today';

const DIMS: readonly Dim[] = ['d3', 'd4', 'd5'];
export const DAY_PARTS: readonly DayPart[] = ['morning', 'noon', 'evening', 'night'];
const WEEK_MS = 7 * 24 * 3_600_000;

type Counts = Record<Dim, number>;
const emptyCounts = (): Counts => ({ d3: 0, d4: 0, d5: 0 });

/** המצב השכיח; בשוויון — המצב של הבדיקה האחרונה מבין המובילים. */
function dominantOf(items: CheckIn[]): Dim | undefined {
  if (items.length === 0) return undefined;
  const counts = emptyCounts();
  for (const item of items) counts[primaryDim(item.result)] += 1;
  const top = Math.max(...DIMS.map((dim) => counts[dim]));
  const tied = DIMS.filter((dim) => counts[dim] === top);
  if (tied.length === 1) return tied[0];
  const latest = [...items].sort((a, b) => b.ts - a.ts).find((item) => tied.includes(primaryDim(item.result)));
  return latest ? primaryDim(latest.result) : tied[0];
}

// ---------- מפת החום ----------

export interface HeatCell {
  weekday: number;
  dayPart: DayPart;
  counts: Counts;
  total: number;
  dominant?: Dim;
}

export interface Heatmap {
  ready: boolean;
  /** כמה בדיקות עוד חסרות עד שהמפה מוצגת. */
  remaining: number;
  total: number;
  cells: HeatCell[];
}

export function buildHeatmap(checkins: CheckIn[], domain?: Domain): Heatmap {
  const total = checkins.length;
  const filtered = domain ? checkins.filter((c) => c.domain === domain) : checkins;
  const cells: HeatCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (const dayPart of DAY_PARTS) {
      const items = filtered.filter((c) => {
        const date = new Date(c.ts);
        return date.getDay() === weekday && dayPartOf(date) === dayPart;
      });
      const counts = emptyCounts();
      for (const item of items) counts[primaryDim(item.result)] += 1;
      cells.push({ weekday, dayPart, counts, total: items.length, dominant: dominantOf(items) });
    }
  }
  return { ready: total >= MIN_CHECKINS_FOR_PATTERNS, remaining: Math.max(0, MIN_CHECKINS_FOR_PATTERNS - total), total, cells };
}

// ---------- אחוז 5D לפי שבוע ----------

export interface WeekShare {
  weekStart: number;
  total: number;
  /** חלקן של בדיקות 5D (0..1), או null כשאין בדיקות בשבוע הזה. */
  share: number | null;
}

export function fiveDShareByWeek(checkins: CheckIn[], now: number, weeks = 8): WeekShare[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = now - (weeks - i) * WEEK_MS;
    const items = checkins.filter((c) => c.ts > weekStart && c.ts <= weekStart + WEEK_MS);
    const fiveD = items.filter((c) => primaryDim(c.result) === 'd5').length;
    return { weekStart, total: items.length, share: items.length ? fiveD / items.length : null };
  });
}

// ---------- זמן התאוששות — המדד המרכזי ----------

export interface RecoveryWeek {
  weekStart: number;
  events: number;
  avgMin: number | null;
}

export function recoveryByWeek(evenings: EveningEntry[], now: number, weeks = 8): RecoveryWeek[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = now - (weeks - i) * WEEK_MS;
    const events = evenings.filter((e) => e.ts > weekStart && e.ts <= weekStart + WEEK_MS).flatMap((e) => e.events);
    const sum = events.reduce((total, event) => total + event.recoveryMin, 0);
    return { weekStart, events: events.length, avgMin: events.length ? sum / events.length : null };
  });
}

/** "45 דקות" · "3 שעות" · "יומיים" — זמן התאוששות בלשון בני אדם. */
export function formatRecovery(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)} דקות`;
  const hours = minutes / 60;
  if (hours < 36) return `${Math.round(hours * 2) / 2} שעות`;
  const days = Math.round((hours / 24) * 2) / 2;
  return days === 2 ? 'יומיים' : `${days} ימים`;
}

// ---------- מפת תחומי החיים ----------

export interface DomainRow {
  domain: Domain;
  checkins: number;
  dominant?: Dim;
  /** הטריגר השכיח בסשנים שהתחילו מ-3D בתחום הזה; אם אין — נושא המחשבה השכיח בבדיקות 3D. */
  mainTrigger?: { kind: 'trigger' | 'thought'; id: string };
  /** הכלי עם השיפור הממוצע הגבוה ביותר בתחום הזה. */
  bringsBack?: { toolId: string; avgImprovement: number };
}

function mostCommon<T>(items: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function buildDomainMap(domains: readonly Domain[], checkins: CheckIn[], sessions: SessionLog[]): DomainRow[] {
  return domains.map((domain) => {
    const inDomain = checkins.filter((c) => c.domain === domain);
    const logs = sessions.filter((s) => s.domain === domain);

    const trigger = mostCommon(logs.filter((s) => s.before === 'd3' && s.trigger).map((s) => s.trigger!));
    const thought = mostCommon(
      inDomain.filter((c) => primaryDim(c.result) === 'd3' && typeof c.answers['thought-topic'] === 'string').map((c) => c.answers['thought-topic'] as string),
    );
    const best = [...toolStats(logs).values()]
      .filter((s) => s.avgImprovement !== null && s.avgImprovement > 0)
      .sort((a, b) => b.avgImprovement! - a.avgImprovement!)[0];

    return {
      domain,
      checkins: inDomain.length,
      dominant: dominantOf(inDomain),
      mainTrigger: trigger ? { kind: 'trigger', id: trigger } : thought ? { kind: 'thought', id: thought } : undefined,
      bringsBack: best ? { toolId: best.toolId, avgImprovement: best.avgImprovement! } : undefined,
    };
  });
}

// ---------- דפוס אישי ----------

/** כמה בדיקות נדרשות בתחום כדי לומר עליו משהו. */
export const MIN_CHECKINS_PER_DOMAIN = 3;

type Pattern = DomainsContent['patterns'][number];

/** הדפוס שתואם לנתונים, אם יש כזה. תמיד מוצג כהשערה — לא כאבחנה. */
export function matchPattern(rows: DomainRow[], patterns: readonly Pattern[]): Pattern | undefined {
  const known = new Map(rows.filter((r) => r.checkins >= MIN_CHECKINS_PER_DOMAIN && r.dominant).map((r) => [r.domain, r.dominant!]));
  return patterns.find((pattern) => {
    const named = [...(pattern.rule.d3 ?? []), ...(pattern.rule.d5 ?? []), ...(Array.isArray(pattern.rule.d4) ? pattern.rule.d4 : [])];
    const matches = (dim: Dim, list: readonly Domain[] | undefined) => (list ?? []).every((domain) => known.get(domain) === dim);
    if (!matches('d3', pattern.rule.d3) || !matches('d5', pattern.rule.d5)) return false;
    if (Array.isArray(pattern.rule.d4) && !matches('d4', pattern.rule.d4)) return false;
    if (pattern.rule.d4 === 'all-others') {
      const others = [...known.entries()].filter(([domain]) => !named.includes(domain));
      if (others.length < 2 || !others.every(([, dim]) => dim === 'd4')) return false;
    }
    return true;
  });
}
