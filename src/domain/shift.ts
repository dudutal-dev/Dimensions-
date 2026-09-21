/**
 * "מה עובד לי" וההמלצה החכמה של מסך המעבר (SPEC 6.5) — לוגיקה טהורה מעל יומן הסשנים.
 * שיפור = כמה מדרגות עלה המצב בין "לפני" ל"אחרי" (3D→4D = ‎+1, 3D→5D = ‎+2, ירידה = שלילי).
 */
import type { Dim, Domain } from '../content/schema';
import type { SessionLog } from './records';

const RANK: Record<Dim, number> = { d3: 0, d4: 1, d5: 2 };

/** שיפור של סשן בודד, או null אם אי אפשר לדעת (לא הושלם, או שלא סומן לפני/אחרי). */
export function improvementOf(log: SessionLog): number | null {
  if (!log.completed || !log.before || !log.after) return null;
  return RANK[log.after] - RANK[log.before];
}

export interface ToolStats {
  toolId: string;
  /** כמה פעמים הכלי הושלם. */
  uses: number;
  /** כמה מהן עם לפני/אחרי — רק הן נספרות בממוצע. */
  measured: number;
  avgImprovement: number | null;
}

export function toolStats(logs: SessionLog[]): Map<string, ToolStats> {
  const sums = new Map<string, { uses: number; measured: number; total: number }>();
  for (const log of logs) {
    if (!log.completed) continue;
    const entry = sums.get(log.toolId) ?? { uses: 0, measured: 0, total: 0 };
    entry.uses += 1;
    const improvement = improvementOf(log);
    if (improvement !== null) {
      entry.measured += 1;
      entry.total += improvement;
    }
    sums.set(log.toolId, entry);
  }
  return new Map(
    [...sums].map(([toolId, s]) => [toolId, { toolId, uses: s.uses, measured: s.measured, avgImprovement: s.measured ? s.total / s.measured : null }]),
  );
}

export interface ShiftContext {
  trigger?: string;
  domain?: Domain;
}

export type Recommendation =
  | { kind: 'history'; toolId: string; avgImprovement: number; measured: number; scope: 'context' | 'overall' }
  | { kind: 'default'; toolId: string };

/** כמה מדידות נדרשות כדי שכלי ייחשב "עבד לי" — פעם אחת יכולה להיות מקרה. */
export const MIN_MEASURED = 2;

function bestOf(stats: Map<string, ToolStats>, candidates: ReadonlySet<string>): ToolStats | undefined {
  return [...stats.values()]
    .filter((s) => candidates.has(s.toolId) && s.avgImprovement !== null && s.avgImprovement > 0 && s.measured >= MIN_MEASURED)
    .sort((a, b) => b.avgImprovement! - a.avgImprovement! || b.measured - a.measured)[0];
}

/**
 * הכלי שהכי שיפר את המצב בעבר — קודם כול בהקשר הזה (אותו טריגר או אותו תחום), ואם אין שם מספיק נתונים — בכלל.
 * בלי היסטוריה: הכלי הראשון ברשימה (הכלים מסודרים מהמהיר אל העמוק).
 */
export function recommend(logs: SessionLog[], candidateIds: string[], context: ShiftContext = {}): Recommendation | null {
  const first = candidateIds[0];
  if (!first) return null;
  const candidates = new Set(candidateIds);

  if (context.trigger || context.domain) {
    const inContext = logs.filter(
      (log) => (context.trigger && log.trigger === context.trigger) || (context.domain && log.domain === context.domain),
    );
    const best = bestOf(toolStats(inContext), candidates);
    if (best) return { kind: 'history', toolId: best.toolId, avgImprovement: best.avgImprovement!, measured: best.measured, scope: 'context' };
  }

  const best = bestOf(toolStats(logs), candidates);
  if (best) return { kind: 'history', toolId: best.toolId, avgImprovement: best.avgImprovement!, measured: best.measured, scope: 'overall' };
  return { kind: 'default', toolId: first };
}
