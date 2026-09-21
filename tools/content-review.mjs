// מחולל CONTENT-REVIEW.md מתוך קובצי ה-JSON — כך המסמך לקריאה תמיד תואם לתוכן עצמו.
// הרצה: npm run content:review
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateContent } from '../src/content/validate.ts';
import { ROOT, readRawContent } from './read-content.mjs';

const { raw, issues: readIssues } = await readRawContent();
const { bundle: b, issues } = validateContent(raw);
const errors = [...readIssues, ...issues].filter((i) => i.level === 'error');
if (!b || errors.length) {
  console.error('חבילת התוכן אינה תקינה — הרץ קודם npm run content:check');
  process.exit(1);
}

const DIM = { d3: '3D', d4: '4D', d5: '5D' };
const LAYER = Object.fromEntries(Object.entries(b.library.layers).map(([k, v]) => [k, v.label]));

const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const tag = (layer) => (layer ? ` · [${LAYER[layer]}]` : '');
const inline = (text) => text.replace(/\{\{(\w+)\}\}/g, (_, l) => `[${LAYER[l]}]`);
const pattern = (p) =>
  [p.inhaleSec, ...(p.topUpSec ? [`+${p.topUpSec}`] : []), p.holdInSec, p.exhaleSec, p.holdOutSec].join('-');
const pct = (w) => `${Math.round(w.d3 * 100)} / ${Math.round(w.d4 * 100)} / ${Math.round(w.d5 * 100)}`;

function renderSegments(segments, formSteps = []) {
  const fieldBySegment = new Map(formSteps.map((s) => [s.segmentId, s]));
  return segments
    .map((seg) => {
      const n = seg.id.split('.')[1];
      switch (seg.type) {
        case 'bell':
          return `- \`${n}\` — פעמון —`;
        case 'silence':
          return `- \`${n}\` — שקט ${clock(seg.durationSec)} —`;
        case 'breath':
          return `- \`${n}\` — נשימה ${clock(seg.durationSec)} · ${pattern(seg.breathPattern)} · כיתוב מסך: ${seg.text} —`;
        case 'prompt': {
          const step = fieldBySegment.get(seg.id);
          const field = step ? ` _(שדה כתיבה: ${step.label}${step.optional ? ', לא חובה' : ''})_` : '';
          return `- \`${n}\` **שאלה:** ${seg.text}${field} _(${seg.durationSec} שנ׳)_`;
        }
        default:
          return `- \`${n}\` ${seg.text} _(${seg.durationSec} שנ׳)_`;
      }
    })
    .join('\n');
}

const table = (columns, rows) =>
  [`| ${columns.join(' | ')} |`, `|${columns.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

const out = [];
const add = (...lines) => out.push(...lines, '');

add('<div dir="rtl">', '');
add('# מצפן המימדים — סקירת תוכן (אבן דרך M0)');
add(
  '> הקובץ הזה **נוצר אוטומטית** מתוך `src/content/*.json` (`npm run content:review`). אל תערוך אותו ישירות —',
  '> כתוב לי את התיקון בצ׳אט (למשל: ״t4.s05 — להחליף ל…״), אני אעדכן את ה-JSON ואפיק את הקובץ מחדש.',
);
add(await readFile(join(ROOT, 'tools', 'content-review-notes.md'), 'utf8'));

// ---------- תרגילי ליבה ----------
add('---', '', '## 1. תרגילי הליבה', '');
add('מזהה מקטע מלא = מזהה התרגיל + מספר המקטע (למשל `t1.s04`). הזמנים בסוגריים כוללים את הקריאה ואת השהות שאחריה.');
for (const e of b.exercises.exercises) {
  const mode = e.mode === 'form' ? 'טופס מודרך — כל שאלה ממתינה לך' : 'נגן מתוזמן';
  add(`### ${e.code} · ${e.name} — ${clock(e.durationSec)}${tag(e.layer)}`);
  add(`${e.summary}`, '', `_${mode} · מקור: ${e.source}${e.weeks.length ? ` · שבועות ${e.weeks.join(', ')}` : ''}_`);
  if (e.caution) add(`> **זהירות:** ${e.caution}`);
  if (e.note) add(`> הערה${tag(e.note.layer)}: ${e.note.text}`);
  add(renderSegments(e.segments, e.form?.steps));
}

// ---------- כלי מעבר ----------
add('---', '', '## 2. ארגז הכלים — מעבר', '');
add('**עקרונות:**', ...b.tools.principles.map((p) => `- ${p}`));
for (const g of b.tools.groups) {
  add(`### ${g.title} — ${g.subtitle}`);
  if (g.intro) add(g.intro);
  if (g.obstacle) add(`- **המכשול:** ${g.obstacle}`, `- **המטרה:** ${g.goal}`, `- **סימן שעברת:** ${g.passSign}`);
  for (const t of b.tools.tools.filter((x) => x.group === g.id).sort((a, c) => a.order - c.order)) {
    add(`#### ${t.order}. ${t.name} — ${clock(t.durationSec)}${tag(t.layer)} · \`${t.id}\``);
    add(`${t.summary}`, '', `_מתי להשתמש: ${t.whenToUse} · מקור: ${t.source}_`);
    if (t.caution) add(`> **זהירות:** ${t.caution}`);
    add(t.segments ? renderSegments(t.segments) : `_רץ כתרגיל \`${t.exerciseRef}\` (ראה פרק 1)._`);
  }
}
add(`### ${b.tools.gates.title}`, b.tools.gates.intro, '', ...b.tools.gates.items.map((i) => `- ${i.label}`), '', `**משימה:** ${b.tools.gates.task}`);

// ---------- טריגרים ----------
add('---', '', '## 3. פרוטוקולים לפי טריגר', '');
for (const t of b.triggers.triggers) {
  add(`### ${t.label} — ${clock(t.durationSec)} · \`${t.id}\``);
  add(`- **תגובת 3D:** ${t.d3Reaction}`, `- **מהלך המעבר:** ${t.move.join(' ← ')}`, `- **כלים קשורים:** ${t.relatedToolIds.map((id) => b.tools.tools.find((x) => x.id === id).name).join(' · ')}`);
  if (t.caution) add(`> **זהירות:** ${t.caution}`);
  add(renderSegments(t.segments));
}

// ---------- תחומים ----------
add('---', '', '## 4. פרוטוקולים לפי תחום חיים', '');
for (const d of b.domains.domains) {
  add(`### ${d.label}`);
  if (!d.protocol) {
    add('_אין פרוטוקול במקור לתחום הזה — משמש לסיווג בדיקות בלבד._');
    continue;
  }
  if (d.protocol.intro) add(d.protocol.intro);
  add(...d.protocol.practices.map((p) => `- \`${p.id}\` ${p.text}`));
}
add('### דפוסים אישיים (לתובנות)', ...b.domains.patterns.map((p) => `- **${p.name}** — ${p.description}${p.note ? ` ${p.note}` : ''}`));

// ---------- מסע ----------
add('---', '', `## 5. ${b.journey.title}`, '', inline(b.journey.disclaimer));
add('**עקרונות:**', ...b.journey.principles.map((p) => `- **${p.title}** — ${p.text}`));
add(`### ${b.journey.week0.title}`, ...b.journey.week0.steps.map((s, i) => `${i + 1}. ${s.text}`), '', `**מדדים:** ${b.journey.week0.metrics.map((m) => `${m.label} (${m.unit})`).join(' · ')}`, '', '**פתיח קולי:**', renderSegments(b.journey.week0.intro));
const exName = (id) => {
  const e = b.exercises.exercises.find((x) => x.id === id);
  return `${e.name} (${e.code})`;
};
const FREQ = { daily: 'כל יום', evening: 'כל ערב', '3x-day': 'שלוש פעמים ביום', '2x-week': 'פעמיים בשבוע' };
for (const p of b.journey.phases) {
  add(`### ${p.formalName}: ״${p.name}״ (שבועות ${p.fromWeek}–${p.toWeek})`, `**מטרה:** ${p.goal}`);
  if (p.warning) add(`> **אזהרה:** ${p.warning}`);
  for (const w of b.journey.weeks.filter((x) => x.phase === p.id)) {
    add(`#### שבוע ${w.week}`);
    const practices = w.practices.map(
      (x) => `- ${x.carried ? 'נמשך' : '**חדש**'}: ${exName(x.exerciseId)}${x.minutes ? ` · ${x.minutes} דק׳` : ''} · ${FREQ[x.frequency]}${x.note ? ` · ${x.note}` : ''}`,
    );
    if (w.freePractice) practices.push(`- ${w.freePractice.text}`);
    add(...practices, `- **משימת חיים — ${w.lifeTask.title}:** ${w.lifeTask.text}`);
    if (w.checkpoint) add(`- **נקודת בדיקה:** ${w.checkpoint.text}`);
    add('**פתיח קולי:**', renderSegments(w.intro));
  }
  add(`**${p.criteriaTitle}**${p.criteriaNote ? ` (${p.criteriaNote})` : ''}`, ...p.criteria.map((c) => `- ${c}`));
}
add('### מכשולים', table(['מכשול', 'מה לעשות'], b.journey.obstacles.map((o) => [o.obstacle, o.remedy])));
add('### הודעות רכות', `- **להישאר עוד שבוע:** ${b.journey.stayAnotherWeek}`, `- **יום שהוחמץ:** ${b.journey.missedDay}`, `- **חזרה אחרי הפסקה:** ${b.journey.returnAfterBreak.text}`);
add(`### ${b.journey.maintenance.title}`, ...b.journey.maintenance.items.map((m) => `- **${m.cadence}:** ${m.text}`));

// ---------- בדיקת מימד ----------
add('---', '', '## 6. בדיקת מימד — 60 שניות', '', `_${b.checkin.intro}_`);
const { scoring } = b.checkin;
add(
  `**ניקוד:** ציון כל ערוץ = ממוצע השאלות שלו; מכפילים: ${Object.entries(scoring.channelMultipliers).map(([c, m]) => `${b.checkin.explain.channelLabels[c]} ×${m}`).join(' · ')}; ` +
    `אם הפער בין שני המצבים המובילים קטן מ-${scoring.blendThreshold * 100}% — מוצגת תוצאת ביניים.`,
  '',
  'המשקלים בטבלאות: **3D / 4D / 5D** באחוזים.',
);
for (const step of b.checkin.steps) {
  add(`### ${step.title} _(ערוץ: ${b.checkin.explain.channelLabels[step.channel]})_`);
  for (const q of step.questions) {
    add(`**${q.prompt}**`);
    if (q.kind === 'choice') add(table(['תשובה', 'משקלים'], q.options.map((o) => [o.label, pct(o.weights)])));
    if (q.kind === 'scale') {
      let from = q.min;
      const rows = q.bands.map((band) => {
        const row = [`${from}–${band.upTo}`, pct(band.weights)];
        from = band.upTo + 1;
        return row;
      });
      add(table(['ערך', 'משקלים'], rows), '', `צ׳יפים (לרישום בלבד): ${q.chips.map((c) => c.label).join(' · ')}`);
    }
    if (q.kind === 'wheel') add(table(['טבעת', 'מילים', 'משקלים'], q.rings.map((r) => [DIM[r.ring], r.words.map((w) => w.label).join(' · '), pct(r.weights)])));
  }
}
add('### טקסטי התוצאה', ...Object.entries(b.checkin.results).map(([, r]) => `- **${r.title}** — ${r.text}`), '', `_כשהערוצים חלוקים:_ ${b.checkin.explain.mixedNote}`);
add('### עוגנים (ברירות מחדל, ניתנות לשינוי בהגדרות)', b.checkin.anchors.map((a) => `${a.label} ${a.defaultTime}`).join(' · '));

// ---------- אבחון ----------
add('---', '', `## 7. אבחון מלא — ״${b.diagnosis.title}״`, '', `_${b.diagnosis.instruction}_`, '', 'התשובות מוצגות כאן בסדר 3D / 4D / 5D; באפליקציה הסדר מעורבב והמפתח אינו נחשף.');
for (const d of b.diagnosis.domains) {
  add(`### ${d.label}`);
  for (const q of b.diagnosis.questions.filter((x) => x.domain === d.id)) {
    add(`**${q.id.slice(1)}. ${q.stem}**`, ...q.options.map((o) => `- ${DIM[o.dim]}: ${o.text}`), '', `_גוף שלישי:_ ${q.thirdPerson.stem}`, ...q.thirdPerson.options.map((o) => `- ${DIM[o.dim]}: ${o.text}`));
  }
}
add('### פענוח', ...b.diagnosis.interpretation.profiles.map((p) => `- **${p.title}** (${p.condition}) — ${p.text}`), '', b.diagnosis.interpretation.gapNote, '', b.diagnosis.interpretation.truthNote);
add('### ״שאל אדם קרוב״', b.diagnosis.askOther.intro, '', `**טקסט לשיתוף:** ${b.diagnosis.askOther.shareText}`);

// ---------- מודל, ערוצים, זיוף ----------
add('---', '', '## 8. המודל, הערוצים וזיוף 5D', '', `**המסגור:** ${b.model.framing.full}`);
add('### משפט לכל מצב (Onboarding) — ניסוח שלי, לאישור', ...b.model.states.map((s) => `- **${s.label}** — ${s.oneLiner}`), '', `**${b.model.nesting.title}:** ${b.model.nesting.text}`);
add('### טבלת ההשוואה', table(['ציר', '3D', '4D', '5D'], b.model.comparison.map((r) => [r.axis, r.d3, r.d4, r.d5])));
add('### סמני שפה לניתוח היומן (מקומי בלבד)', ...Object.entries(b.channels.languageMarkers).map(([dim, ms]) => `- **${DIM[dim]}:** ${ms.map((m) => m.label).join(' · ')}`));
add(`### ${b.fake5d.title}`, table(['נראה כמו 5D', 'בפועל', 'איך מבחינים'], b.fake5d.rows.map((r) => [r.looksLike, r.actually, r.howToTell])), '', b.fake5d.goldenTest);

// ---------- בטיחות ----------
add('---', '', '## 9. גבולות ובטיחות', '', `**Onboarding:** ${b.safety.onboarding.text} ${b.safety.onboarding.ifDistress}`);
add(...b.safety.boundaries.map((x) => `- **${x.title}** — ${x.text}`));
add(`### ${b.safety.help.title}`, b.safety.help.intro, '', b.safety.help.healthyPractice, '', '**סימנים שכדאי לעצור ולפנות לעזרה:**', ...b.safety.help.warningSigns.map((s) => `- ${s.text}`), '', '**מה עושים:**', ...b.safety.help.whatToDo.map((s) => `- ${s}`), '', ...b.safety.resources.map((r) => `**${r.name} — ${r.phone}** · ${r.description}`));
add(`**הצעה עדינה** (כיווץ ${b.safety.gentleNudge.rule.value}, ${b.safety.gentleNudge.rule.consecutive} פעמים ברצף): ${b.safety.gentleNudge.text}`, '', b.safety.notRecommended);

// ---------- Onboarding ----------
add(
  '---',
  '',
  '## 10. Onboarding',
  '',
  `**${b.onboarding.welcome.title}** — ${b.onboarding.welcome.text}`,
  '',
  `**${b.onboarding.framing.title}:** ${b.model.framing.full}`,
  '',
  `**${b.onboarding.start.title}**`,
  ...b.onboarding.start.options.map((o) => `- **${o.title}** (${o.meta}) — ${o.text}`),
);

// ---------- ספרייה ----------
add('---', '', '## 11. ספרייה', '', 'מאמרי הספרייה הועתקו מהמקור כמעט כלשונם (עריכת פיסוק בלבד, ואימוג׳י הרובד הוחלפו בתגיות). נספח הפיזיקה מלא.');
for (const s of b.library.sections) {
  add(`### ${s.title}`, ...b.library.articles.filter((a) => a.section === s.id).map((a) => `- **${a.title}**${tag(a.layer)}${a.lockedUntilJourneyComplete ? ' · _נפתח אחרי 12 השבועות_' : ''} · _${a.source}_`));
}

add('</div>');

await writeFile(join(ROOT, 'CONTENT-REVIEW.md'), out.join('\n'), 'utf8');
console.log(`CONTENT-REVIEW.md נוצר (${out.length} שורות)`);
