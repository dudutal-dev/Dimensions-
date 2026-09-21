/**
 * ניקוד בדיקת המימד (SPEC 6.3). לוגיקה טהורה; כל המשקלים באים מ-checkin.json ולא מהקוד.
 *
 *  1. כל תשובה ממופה למשקלים {d3,d4,d5}.
 *  2. ציון ערוץ = ממוצע השאלות שנענו בו ("channel-mean").
 *  3. הציון הכולל = ממוצע הערוצים, משוקלל במכפילים (הגוף ×1.5), מנורמל לסכום 1.
 *  4. התוצאה = המצב המוביל. אם הפער משני קטן מהסף — תוצאת ביניים ("בין 3D ל-4D").
 *     אם שני המובילים אינם סמוכים (3D מול 5D) — הגוף מכריע: "הגוף הוא הערוץ הישר ביותר".
 */
import type { CheckinContent, CheckinQuestion, CheckinResult, Dim, Weights } from '../content/schema';
import type { CheckIn } from './records';

export type CheckinAnswers = Record<string, string | number>;
export type ScoredChannel = CheckinContent['steps'][number]['channel'];

export interface CheckinScore {
  scores: Record<Dim, number>;
  result: CheckinResult;
  /** לאן הצביע כל ערוץ שנענה — להסבר "למה" בתוצאה. */
  votes: Array<{ channel: ScoredChannel; dim: Dim }>;
  /** true כשהערוצים חלוקים בין 3D ל-5D, והגוף הכריע. */
  mixed: boolean;
}

const DIMS: readonly Dim[] = ['d3', 'd4', 'd5'];
const ZERO: Weights = { d3: 0, d4: 0, d5: 0 };

export function weightsFor(question: CheckinQuestion, answer: string | number | undefined): Weights | null {
  if (answer === undefined) return null;
  switch (question.kind) {
    case 'choice':
      return question.options.find((o) => o.id === answer)?.weights ?? null;
    case 'scale': {
      if (typeof answer !== 'number') return null;
      return question.bands.find((band) => answer <= band.upTo)?.weights ?? null;
    }
    case 'wheel':
      return question.rings.find((ring) => ring.words.some((w) => w.id === answer))?.weights ?? null;
  }
}

function mean(list: Weights[]): Weights {
  const sum = list.reduce((acc, w) => ({ d3: acc.d3 + w.d3, d4: acc.d4 + w.d4, d5: acc.d5 + w.d5 }), ZERO);
  return { d3: sum.d3 / list.length, d4: sum.d4 / list.length, d5: sum.d5 / list.length };
}

function ranked(weights: Record<Dim, number>): Dim[] {
  // במקרה של שוויון מוחלט הסדר יציב: 3D, 4D, 5D.
  return [...DIMS].sort((a, b) => weights[b] - weights[a]);
}

export function scoreCheckin(content: CheckinContent, answers: CheckinAnswers): CheckinScore | null {
  const byChannel = new Map<ScoredChannel, Weights[]>();
  for (const step of content.steps) {
    for (const question of step.questions) {
      const weights = weightsFor(question, answers[question.id]);
      if (!weights) continue;
      byChannel.set(step.channel, [...(byChannel.get(step.channel) ?? []), weights]);
    }
  }
  if (byChannel.size === 0) return null;

  const total = { ...ZERO };
  let multiplierSum = 0;
  const votes: CheckinScore['votes'] = [];
  let bodyVote: Dim | undefined;

  for (const [channel, list] of byChannel) {
    const channelScore = mean(list);
    const multiplier = content.scoring.channelMultipliers[channel] ?? 1;
    for (const dim of DIMS) total[dim] += channelScore[dim] * multiplier;
    multiplierSum += multiplier;
    const vote = ranked(channelScore)[0]!;
    votes.push({ channel, dim: vote });
    if (channel === 'body') bodyVote = vote;
  }

  const scores = { d3: total.d3 / multiplierSum, d4: total.d4 / multiplierSum, d5: total.d5 / multiplierSum };
  const [first, second] = ranked(scores) as [Dim, Dim, Dim];
  const close = scores[first] - scores[second] < content.scoring.blendThreshold;

  let result: CheckinResult = first;
  let mixed = false;
  if (close) {
    const pair = new Set([first, second]);
    if (pair.has('d4')) result = pair.has('d3') ? 'd3-d4' : 'd4-d5';
    else {
      mixed = true;
      result = bodyVote ?? first;
    }
  }
  return { scores, result, votes, mixed };
}

/** רישום מהיר: המשתמש בחר מצב ישירות. */
export function quickScore(dim: Dim): Pick<CheckinScore, 'scores' | 'result'> {
  return { scores: { ...ZERO, [dim]: 1 }, result: dim };
}

/** האם כל שאלות הצעד נענו. */
export function isStepComplete(step: CheckinContent['steps'][number], answers: CheckinAnswers): boolean {
  return step.questions.every((q) => answers[q.id] !== undefined);
}

/** המצב ה"ראשי" של תוצאה — לצבע ההילה ולגליף יחיד. תוצאת ביניים מיוצגת על ידי 4D. */
export function primaryDim(result: CheckinResult): Dim {
  return result === 'd3-d4' || result === 'd4-d5' ? 'd4' : result;
}

/** שני המצבים של תוצאת ביניים, או מצב יחיד. */
export function dimsOf(result: CheckinResult): Dim[] {
  if (result === 'd3-d4') return ['d3', 'd4'];
  if (result === 'd4-d5') return ['d4', 'd5'];
  return [result];
}

/**
 * הצעה עדינה לעזרה (SPEC 6.12): אותה תשובה קיצונית בכמה בדיקות מלאות ברצף.
 * recent — מהחדש לישן. רישומים מהירים לא נספרים, כי אין בהם תשובה.
 */
export function shouldNudge(recent: CheckIn[], rule: { questionId: string; value: number; consecutive: number }): boolean {
  const full = recent.filter((c) => !c.quick).slice(0, rule.consecutive);
  return full.length === rule.consecutive && full.every((c) => c.answers[rule.questionId] === rule.value);
}
