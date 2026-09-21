/**
 * ולידציה של חבילת התוכן — לוגיקה טהורה (ללא fs), משותפת ל-tools/build-content.mjs ולבדיקות.
 * שלב 1: parseBundle — סכמות Zod לכל קובץ.
 * שלב 2: crossCheck — הפניות צולבות, מזהי מקטעים, משכים, וכללי "טקסט לקול".
 */
import {
  contentSchemas,
  LayerSchema,
  type ContentBundle,
  type ContentFileName,
  type Segment,
} from './schema';

export interface Issue {
  level: 'error' | 'warn';
  file: string;
  message: string;
}

export const CONTENT_FILES = Object.keys(contentSchemas) as ContentFileName[];

export function parseBundle(raw: Record<ContentFileName, unknown>): {
  bundle: ContentBundle | null;
  issues: Issue[];
} {
  const issues: Issue[] = [];
  const parsed: Partial<Record<ContentFileName, unknown>> = {};
  for (const name of CONTENT_FILES) {
    const result = contentSchemas[name].safeParse(raw[name]);
    if (result.success) {
      parsed[name] = result.data;
    } else {
      for (const issue of result.error.issues) {
        issues.push({
          level: 'error',
          file: `${name}.json`,
          message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        });
      }
    }
  }
  const ok = issues.length === 0;
  return { bundle: ok ? (parsed as unknown as ContentBundle) : null, issues };
}

// ---------- כללי טקסט ----------

/** טקסט מדובר: אותיות עבריות, רווחים וסימני פיסוק בסיסיים בלבד. בלי ספרות, סוגריים, מירכאות או סימנים. */
const SPOKEN_ALLOWED = /^[א-ת\s.,:?!\-…]+$/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const LAYER_TOKEN = /\{\{([^}]*)\}\}/g;
/** קצב קריאה מרבי סביר להנחיה רגועה, במילים לשנייה. */
const MAX_WORDS_PER_SEC = 2.5;

function isSpoken(seg: Segment): boolean {
  return seg.type === 'instruction' || seg.type === 'prompt';
}

function walkStrings(value: unknown, path: string, visit: (s: string, path: string) => void): void {
  if (typeof value === 'string') visit(value, path);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, visit));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walkStrings(v, path ? `${path}.${k}` : k, visit);
  }
}

// ---------- בעלי מקטעים ----------

interface SegmentOwner {
  file: string;
  ownerId: string;
  declaredDurationSec: number | null;
  segments: Segment[];
}

export function collectSegmentOwners(b: ContentBundle): SegmentOwner[] {
  const owners: SegmentOwner[] = [];
  for (const e of b.exercises.exercises) {
    owners.push({ file: 'exercises.json', ownerId: e.id, declaredDurationSec: e.durationSec, segments: e.segments });
  }
  for (const t of b.tools.tools) {
    if (t.segments) {
      owners.push({ file: 'tools.json', ownerId: t.id, declaredDurationSec: t.durationSec, segments: t.segments });
    }
  }
  for (const t of b.triggers.triggers) {
    owners.push({ file: 'triggers.json', ownerId: t.id, declaredDurationSec: t.durationSec, segments: t.segments });
  }
  owners.push({ file: 'journey.json', ownerId: b.journey.week0.id, declaredDurationSec: null, segments: b.journey.week0.intro });
  for (const w of b.journey.weeks) {
    owners.push({ file: 'journey.json', ownerId: w.id, declaredDurationSec: null, segments: w.intro });
  }
  return owners;
}

export function sumDuration(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + s.durationSec, 0);
}

// ---------- בדיקות צולבות ----------

export function crossCheck(b: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  const err = (file: string, message: string) => issues.push({ level: 'error', file, message });
  const warn = (file: string, message: string) => issues.push({ level: 'warn', file, message });

  // 1. אין אימוג'י בשום מחרוזת; תגיות רובד תקינות.
  for (const name of CONTENT_FILES) {
    walkStrings(b[name], '', (s, path) => {
      if (EMOJI.test(s)) err(`${name}.json`, `${path}: אימוג'י בטקסט — יש להחליף בתגית רובד`);
      for (const m of s.matchAll(LAYER_TOKEN)) {
        if (!LayerSchema.safeParse(m[1]).success) {
          err(`${name}.json`, `${path}: תגית רובד לא מוכרת {{${m[1]}}}`);
        }
      }
    });
  }

  // 2. מקטעים: מזהים, משכים, טקסט לקול.
  const owners = collectSegmentOwners(b);
  const ownerIds = new Set<string>();
  const segmentIds = new Set<string>();
  for (const o of owners) {
    if (ownerIds.has(o.ownerId)) err(o.file, `מזהה בעלים כפול: ${o.ownerId}`);
    ownerIds.add(o.ownerId);

    o.segments.forEach((seg, i) => {
      const expected = `${o.ownerId}.s${String(i + 1).padStart(2, '0')}`;
      if (seg.id !== expected) err(o.file, `${seg.id}: מזהה מקטע צפוי ${expected}`);
      if (segmentIds.has(seg.id)) err(o.file, `${seg.id}: מזהה מקטע כפול`);
      segmentIds.add(seg.id);

      if (isSpoken(seg)) {
        if (!SPOKEN_ALLOWED.test(seg.text)) {
          const bad = [...seg.text].filter((ch) => !SPOKEN_ALLOWED.test(ch));
          err(o.file, `${seg.id}: תווים שאינם מתאימים לקול: ${[...new Set(bad)].join(' ')}`);
        }
        const words = seg.text.trim().split(/\s+/).length;
        if (words / seg.durationSec > MAX_WORDS_PER_SEC) {
          warn(o.file, `${seg.id}: ${words} מילים ב-${seg.durationSec} שניות — מהיר מדי להנחיה רגועה`);
        }
      }
      if (seg.type === 'breath' && seg.breathPattern) {
        const p = seg.breathPattern;
        const cycle = p.inhaleSec + (p.topUpSec ?? 0) + p.holdInSec + p.exhaleSec + p.holdOutSec;
        if (seg.durationSec % cycle !== 0) {
          err(o.file, `${seg.id}: משך ${seg.durationSec} אינו כפולה של מחזור נשימה (${cycle})`);
        }
      }
    });

    if (o.declaredDurationSec !== null) {
      const total = sumDuration(o.segments);
      if (total !== o.declaredDurationSec) {
        err(o.file, `${o.ownerId}: durationSec=${o.declaredDurationSec} אך סכום המקטעים ${total}`);
      }
    }
  }

  // 3. תרגילים.
  const exerciseById = new Map(b.exercises.exercises.map((e) => [e.id, e]));
  if (exerciseById.size !== b.exercises.exercises.length) err('exercises.json', 'מזהה תרגיל כפול');
  for (const e of b.exercises.exercises) {
    if (e.form) {
      const prompts = new Set(e.segments.filter((s) => s.type === 'prompt').map((s) => s.id));
      const fieldIds = new Set<string>();
      for (const step of e.form.steps) {
        if (!prompts.has(step.segmentId)) {
          err('exercises.json', `${e.id}: שלב ${step.fieldId} מפנה למקטע שאינו prompt (${step.segmentId})`);
        }
        if (fieldIds.has(step.fieldId)) err('exercises.json', `${e.id}: fieldId כפול ${step.fieldId}`);
        fieldIds.add(step.fieldId);
      }
    }
    const weeksInJourney = b.journey.weeks
      .filter((w) => w.practices.some((p) => p.exerciseId === e.id))
      .map((w) => w.week);
    if (JSON.stringify(weeksInJourney) !== JSON.stringify(e.weeks)) {
      err('exercises.json', `${e.id}: weeks=${JSON.stringify(e.weeks)} אך במסע ${JSON.stringify(weeksInJourney)}`);
    }
  }

  // 4. כלים.
  const toolById = new Map(b.tools.tools.map((t) => [t.id, t]));
  if (toolById.size !== b.tools.tools.length) err('tools.json', 'מזהה כלי כפול');
  const groupIds = new Set(b.tools.groups.map((g) => g.id));
  for (const g of b.tools.groups) {
    const inGroup = b.tools.tools.filter((t) => t.group === g.id);
    if (inGroup.length === 0) err('tools.json', `קבוצה ללא כלים: ${g.id}`);
    const orders = inGroup.map((t) => t.order).sort((a, c) => a - c);
    orders.forEach((order, i) => {
      if (order !== i + 1) err('tools.json', `קבוצה ${g.id}: סדר הכלים אינו רציף`);
    });
  }
  for (const t of b.tools.tools) {
    if (t.exerciseRef) {
      const ex = exerciseById.get(t.exerciseRef);
      if (!ex) err('tools.json', `${t.id}: exerciseRef לא קיים (${t.exerciseRef})`);
      else if (ex.durationSec !== t.durationSec) err('tools.json', `${t.id}: משך שונה מהתרגיל ${ex.id}`);
    }
  }

  // 5. טריגרים ותחומים.
  for (const t of b.triggers.triggers) {
    for (const id of t.relatedToolIds) {
      if (!toolById.has(id)) err('triggers.json', `${t.id}: כלי לא קיים (${id})`);
    }
  }
  const domainIds = new Set(b.domains.domains.map((d) => d.id));
  if (domainIds.size !== 8) err('domains.json', 'כל אחד משמונת התחומים חייב להופיע פעם אחת');
  for (const d of b.domains.domains) {
    if (!d.protocol) continue;
    d.protocol.practices.forEach((p, i) => {
      const expected = `${d.id}.p${String(i + 1).padStart(2, '0')}`;
      if (p.id !== expected) err('domains.json', `${p.id}: מזהה צפוי ${expected}`);
    });
    for (const id of d.protocol.relatedExerciseIds ?? []) {
      if (!exerciseById.has(id)) err('domains.json', `${d.id}: תרגיל לא קיים (${id})`);
    }
    for (const id of d.protocol.relatedToolIds ?? []) {
      if (!toolById.has(id)) err('domains.json', `${d.id}: כלי לא קיים (${id})`);
    }
  }

  // 6. מסע.
  b.journey.weeks.forEach((w, i) => {
    if (w.week !== i + 1) err('journey.json', `שבוע במיקום ${i + 1} מסומן ${w.week}`);
    if (w.id !== `w${String(w.week).padStart(2, '0')}`) err('journey.json', `${w.id}: מזהה שבוע שגוי`);
    const phase = b.journey.phases.find((p) => w.week >= p.fromWeek && w.week <= p.toWeek);
    if (!phase || phase.id !== w.phase) err('journey.json', `${w.id}: שלב לא תואם לטווחי השלבים`);
    if (w.practices.length === 0 && !w.freePractice) err('journey.json', `${w.id}: אין תרגול`);

    const prev = b.journey.weeks[i - 1];
    for (const p of w.practices) {
      if (!exerciseById.has(p.exerciseId)) err('journey.json', `${w.id}: תרגיל לא קיים (${p.exerciseId})`);
      const inPrev = Boolean(prev && prev.phase === w.phase && prev.practices.some((q) => q.exerciseId === p.exerciseId));
      if (p.carried !== inPrev) warn('journey.json', `${w.id}/${p.exerciseId}: carried=${p.carried} אינו תואם לשבוע הקודם`);
    }
  });
  for (const id of b.journey.returnAfterBreak.exerciseIds) {
    if (!exerciseById.has(id)) err('journey.json', `returnAfterBreak: תרגיל לא קיים (${id})`);
  }

  // 7. אבחון.
  b.diagnosis.questions.forEach((q, i) => {
    if (q.id !== `q${String(i + 1).padStart(2, '0')}`) err('diagnosis.json', `${q.id}: מזהה שאלה לא רציף`);
    if (!q.thirdPerson.stem.includes('{name}')) err('diagnosis.json', `${q.id}: בגרסת גוף שלישי חסר {name}`);
  });
  for (const d of b.diagnosis.domains) {
    if (!b.diagnosis.questions.some((q) => q.domain === d.id)) err('diagnosis.json', `תחום ללא שאלות: ${d.id}`);
  }

  // 8. בדיקת מימד.
  const questionIds = new Set<string>();
  for (const step of b.checkin.steps) {
    if (!(step.channel in b.checkin.scoring.channelMultipliers)) {
      err('checkin.json', `${step.id}: לערוץ ${step.channel} אין מכפיל`);
    }
    for (const q of step.questions) {
      if (questionIds.has(q.id)) err('checkin.json', `מזהה שאלה כפול: ${q.id}`);
      questionIds.add(q.id);
      if (q.kind === 'choice') {
        if (new Set(q.options.map((o) => o.id)).size !== q.options.length) err('checkin.json', `${q.id}: אפשרות כפולה`);
      } else if (q.kind === 'scale') {
        const ups = q.bands.map((band) => band.upTo);
        if (ups.some((u, k) => k > 0 && u <= (ups[k - 1] ?? -Infinity))) err('checkin.json', `${q.id}: רצועות לא עולות`);
        if (ups[ups.length - 1] !== q.max) err('checkin.json', `${q.id}: הרצועה האחרונה חייבת להסתיים ב-max`);
      } else {
        const words = q.rings.flatMap((r) => r.words.map((w) => w.id));
        if (new Set(words).size !== words.length) err('checkin.json', `${q.id}: מילה כפולה בגלגל`);
        if (new Set(q.rings.map((r) => r.ring)).size !== 3) err('checkin.json', `${q.id}: טבעת לכל מצב`);
      }
    }
  }
  for (const [result, r] of Object.entries(b.checkin.results)) {
    if (r.shiftGroup && !groupIds.has(r.shiftGroup as never)) {
      err('checkin.json', `results.${result}: קבוצת כלים לא קיימת (${r.shiftGroup})`);
    }
  }
  for (const result of ['d3', 'd3-d4', 'd4', 'd4-d5', 'd5']) {
    if (!(result in b.checkin.results)) err('checkin.json', `חסר טקסט תוצאה: ${result}`);
  }

  // 9. בטיחות וספרייה.
  const nudgeQ = b.safety.gentleNudge.rule.questionId;
  const scaleIds = b.checkin.steps.flatMap((s) => s.questions.filter((q) => q.kind === 'scale').map((q) => q.id));
  if (!scaleIds.includes(nudgeQ)) err('safety.json', `gentleNudge: שאלת סולם לא קיימת (${nudgeQ})`);
  const articleIds = b.library.articles.map((a) => a.id);
  if (new Set(articleIds).size !== articleIds.length) err('library.json', 'מזהה מאמר כפול');

  return issues;
}

export function validateContent(raw: Record<ContentFileName, unknown>): {
  bundle: ContentBundle | null;
  issues: Issue[];
} {
  const { bundle, issues } = parseBundle(raw);
  if (!bundle) return { bundle, issues };
  return { bundle, issues: [...issues, ...crossCheck(bundle)] };
}
