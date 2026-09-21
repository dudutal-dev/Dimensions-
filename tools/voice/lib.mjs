/**
 * שלב ב' — כלי הקול (SPEC פרק 10). כאן הלוגיקה הטהורה: תכנון האודישן, הערכת היקף, בניית בקשות, ודפי ההשוואה.
 * אין כאן קריאות רשת ואין כאן מפתח — את אלה עושים הסקריפטים שמסביב (voices / estimate / audition), והמפתח מגיע רק מ-.env.
 *
 * מה נבדק בתיעוד של ElevenLabs (2026-09-21, https://elevenlabs.io/docs/models):
 *  - עברית מופיעה רק ברשימת השפות של Eleven v3 (model_id: eleven_v3). ב-Multilingual v2 וב-Flash v2.5 אין עברית.
 *  - v3: עד 5,000 תווים לבקשה; אין תמיכה בתגי SSML break — הפסקות נעשות בפיסוק (שלוש נקודות), במבנה הטקסט ובתגי אודיו.
 *  - v3: היציבות היא אחד משלושה מצבים — Creative (0.0) · Natural (0.5) · Robust (1.0).
 *  - language_code נתמך ב-v3 ואינו נתמך ב-Multilingual v2.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const API = 'https://api.elevenlabs.io';
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = join(ROOT, 'tools', 'voice', 'out');
export const V3_CHAR_LIMIT = 5000;
const V3_STABILITY_MODES = [0, 0.5, 1];

// ---------- טקסט ----------

const MARKUP = /\*\*|\*|\{\{[a-z]+\}\}/g;

/** טקסט להקראה: בלי סימוני העיצוב של התוכן, ובלי מירכאות מסולסלות (המנוע קורא אותן לפעמים בקול). */
export function speakable(text) {
  return text
    .replace(MARKUP, '')
    .replace(/[“”"]/g, '')
    .replace(/\s+—\s+/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8'));
}

/** מקטעי ההדרכה לפי מזהה — מתוך חבילת התוכן עצמה, כדי שפסקאות המבחן יהיו הטקסט האמיתי ולא עותק שלו. */
export function loadSegmentIndex() {
  const index = new Map();
  const add = (segments) => {
    for (const segment of segments ?? []) if (segment.text) index.set(segment.id, segment.text);
  };
  for (const exercise of readJson('src/content/exercises.json').exercises) add(exercise.segments);
  for (const tool of readJson('src/content/tools.json').tools) add(tool.segments);
  return index;
}

/**
 * שלוש פסקאות המבחן (SPEC 10.2): הנחיית נשימה איטית · הסבר קצר · משפט חם מתרגול הלב.
 * בעברית — מתוך התוכן; באנגלית — תרגום נאמן שלהן (tools/voice/audition-texts.en.json).
 */
export function auditionTexts(config, lang, { segments = loadSegmentIndex(), channels = readJson('src/content/channels.json'), english } = {}) {
  if (lang === 'en') {
    const texts = english ?? readJson('tools/voice/audition-texts.en.json');
    return config.paragraphs.map((p) => ({ id: p.id, title: p.title, text: texts[p.id] }));
  }
  return config.paragraphs.map((p) => {
    const parts = p.source === 'channels.principle' ? [channels.principle] : p.segments.map((id) => segments.get(id));
    if (parts.some((part) => !part)) throw new Error(`פסקת המבחן "${p.id}" מפנה למקטע שאינו קיים בתוכן`);
    // שורה ריקה בין מקטעים: v3 אינו תומך ב-SSML break, ומבנה הטקסט הוא שיוצר את ההפסקה
    return { id: p.id, title: p.title, text: parts.map(speakable).join('\n\n') };
  });
}

// ---------- תכנון ----------

export function validateConfig(config) {
  const problems = [];
  for (const lang of ['he', 'en']) {
    for (const variant of config.variants?.[lang] ?? []) {
      if (variant.model_id === 'eleven_v3' && !V3_STABILITY_MODES.includes(variant.voice_settings?.stability ?? 0.5)) {
        problems.push(`${lang}/${variant.id}: ב-eleven_v3 היציבות היא 0, 0.5 או 1`);
      }
      if (lang === 'he' && variant.model_id !== 'eleven_v3') {
        problems.push(`${lang}/${variant.id}: רק eleven_v3 תומך בעברית לפי התיעוד`);
      }
    }
    const ids = (config.voices?.[lang] ?? []).map((v) => v.voice_id);
    if (new Set(ids).size !== ids.length) problems.push(`${lang}: אותו קול מופיע פעמיים`);
    for (const voice of config.voices?.[lang] ?? []) {
      if (!/^[A-Za-z0-9]{10,40}$/.test(voice.voice_id ?? '')) problems.push(`${lang}: voice_id לא תקין עבור "${voice.name ?? '?'}"`);
    }
  }
  return problems;
}

/** כל ההפקות של האודישן: שפה × קול × גרסת הגדרות × פסקה. המזהה נגזר מהתוכן — הפקה חוזרת של אותו דבר מדולגת. */
export function buildPlan(config, textsByLang) {
  const items = [];
  for (const lang of ['he', 'en']) {
    for (const voice of config.voices?.[lang] ?? []) {
      for (const variant of config.variants[lang]) {
        for (const paragraph of textsByLang[lang]) {
          const body = {
            text: paragraph.text,
            model_id: variant.model_id,
            voice_settings: variant.voice_settings,
            ...(variant.model_id === 'eleven_v3' ? { language_code: lang } : {}),
          };
          const hash = createHash('sha256').update(JSON.stringify({ voice: voice.voice_id, body, format: config.output_format })).digest('hex').slice(0, 12);
          items.push({
            lang,
            voice,
            variant,
            paragraph,
            body,
            hash,
            chars: paragraph.text.length,
            file: `audition/${lang}/${voice.voice_id}/${variant.id}/${paragraph.id}-${hash}.mp3`,
          });
        }
      }
    }
  }
  const tooLong = items.find((item) => item.body.model_id === 'eleven_v3' && item.chars > V3_CHAR_LIMIT);
  if (tooLong) throw new Error(`הפסקה "${tooLong.paragraph.id}" ארוכה מ-${V3_CHAR_LIMIT} תווים — מעל המגבלה של eleven_v3`);
  return items;
}

export function estimate(items, existingFiles = new Set()) {
  const pending = items.filter((item) => !existingFiles.has(item.file));
  const sum = (list) => list.reduce((total, item) => total + item.chars, 0);
  const byLang = {};
  for (const item of pending) byLang[item.lang] = (byLang[item.lang] ?? 0) + item.chars;
  return { total: items.length, pending: pending.length, skipped: items.length - pending.length, chars: sum(pending), charsAll: sum(items), byLang };
}

// ---------- בקשות ----------

/** הבקשה בלי המפתח. את הכותרת xi-api-key מוסיפים רק ברגע השליחה, והיא אינה נכתבת לשום קובץ או לוג. */
export function ttsRequest(item, outputFormat) {
  return {
    url: `${API}/v1/text-to-speech/${item.voice.voice_id}?output_format=${encodeURIComponent(outputFormat)}`,
    init: { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(item.body) },
  };
}

export function withKey(init, apiKey) {
  return { ...init, headers: { ...init.headers, 'xi-api-key': apiKey } };
}

/** מוחק מפתח מכל טקסט שעומד להיות מודפס או נשמר — גם אם הגיע בתוך הודעת שגיאה. */
export function redact(text, apiKey) {
  let clean = String(text);
  if (apiKey) clean = clean.split(apiKey).join('[המפתח הוסתר]');
  return clean.replace(/sk_[A-Za-z0-9]{16,}/g, '[המפתח הוסתר]');
}

/** המפתח מגיע רק מ-.env (או ממשתנה סביבה). הערך אינו מוחזר לשום מקום מלבד הקורא. */
export function readApiKey(env = process.env, envFile = join(ROOT, '.env')) {
  if (!env.ELEVENLABS_API_KEY) {
    try {
      process.loadEnvFile(envFile);
    } catch {
      // אין קובץ .env — ההודעה למטה מסבירה מה לעשות
    }
  }
  const key = (env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEY ?? '').trim();
  if (!key || key.startsWith('PUT_')) {
    throw new Error('לא נמצא ELEVENLABS_API_KEY. צור קובץ .env בשורש הפרויקט לפי .env.example (הקובץ ב-.gitignore, ואינו נכנס לקוד או ל-build).');
  }
  return key;
}

const HTTP_HINTS = {
  401: 'המפתח אינו תקין, או שאין לו הרשאת Text to Speech.',
  402: 'התוכנית אינה כוללת את הפעולה הזו (למשל קול מהספרייה בתוכנית חינמית).',
  403: 'אין הרשאה לקול הזה — ייתכן שצריך להוסיף אותו ל-My Voices.',
  404: 'הקול לא נמצא בחשבון. קול מהספרייה צריך להתווסף קודם ל-My Voices.',
  422: 'אחד הפרמטרים נדחה על ידי המודל.',
  429: 'יותר מדי בקשות במקביל, או שהמכסה נגמרה.',
};

export function explainHttpError(status, bodyText, apiKey) {
  let detail = '';
  try {
    const parsed = JSON.parse(bodyText);
    detail = parsed?.detail?.message ?? parsed?.detail?.status ?? JSON.stringify(parsed.detail ?? parsed).slice(0, 300);
  } catch {
    detail = bodyText.slice(0, 300);
  }
  return redact(`HTTP ${status}: ${HTTP_HINTS[status] ?? ''} ${detail}`.trim(), apiKey);
}

// ---------- דפי ההשוואה ----------

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const PAGE_STYLE = `
  :root { color-scheme: dark; --bg:#0b0f1a; --surface:#141a2a; --border:#2f3a57; --text:#eef0f6; --muted:#a3abc2; --accent:#f2d492; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 80px; background:var(--bg); color:var(--text); font:17px/1.65 system-ui, 'Segoe UI', Arial, sans-serif; }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; } h2 { font-size: 1.2rem; margin: 40px 0 8px; } h3 { font-size: 1rem; margin: 0; }
  p { margin: 6px 0; } .muted { color: var(--muted); font-size: .9rem; }
  .text { white-space: pre-wrap; border-inline-start: 3px solid var(--accent); padding: 8px 14px; background: var(--surface); border-radius: 10px; }
  .take { border:1px solid var(--border); background:var(--surface); border-radius:14px; padding:14px; margin:10px 0; display:grid; gap:10px; }
  .take header { display:flex; flex-wrap:wrap; gap:6px 14px; align-items:baseline; justify-content:space-between; }
  audio { width:100%; min-height:48px; }
  .row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
  select, textarea, button, input { font: inherit; color: var(--text); background: #1c2438; border:1px solid var(--border); border-radius:10px; padding:10px 12px; min-height:48px; }
  textarea { width:100%; min-height:48px; } button { cursor:pointer; } button.primary { background:var(--accent); color:#1a1405; border-color:transparent; font-weight:600; }
  .blind .who { visibility:hidden; } .blind .who::before { content: attr(data-alias); visibility: visible; }
  #summary { white-space:pre-wrap; direction:ltr; text-align:left; background:#05070d; padding:14px; border-radius:10px; border:1px solid var(--border); }
  a { color: var(--accent); }
`;

/** דף האודישן: כל פסקה, וכל קול × גרסה מתחתיה. דירוג והערות נשמרים בדפדפן; "האזנה עיוורת" מסתירה שמות כדי לבחור באוזן. */
export function renderAuditionHtml({ items, generatedAt, textsByLang }) {
  const LANG_TITLE = { he: 'עברית', en: 'אנגלית' };
  const sections = ['he', 'en']
    .filter((lang) => items.some((item) => item.lang === lang))
    .map((lang) => {
      const paragraphs = textsByLang[lang]
        .map((paragraph) => {
          const takes = items
            .filter((item) => item.lang === lang && item.paragraph.id === paragraph.id)
            .map((item, index) => {
              const key = `${item.lang}|${item.voice.voice_id}|${item.variant.id}|${item.paragraph.id}`;
              return `
        <article class="take" data-key="${escapeHtml(key)}" data-voice="${escapeHtml(item.voice.voice_id)}" data-lang="${lang}" data-variant="${escapeHtml(item.variant.id)}">
          <header>
            <h3 class="who" data-alias="הקלטה ${index + 1}">${escapeHtml(item.voice.name)} · ${escapeHtml(item.variant.label ?? item.variant.id)}</h3>
            <span class="muted who" data-alias="">${escapeHtml(item.variant.model_id)} · ${escapeHtml(item.voice.voice_id)}</span>
          </header>
          ${item.error ? `<p class="muted">לא הופק: ${escapeHtml(item.error)}</p>` : `<audio controls preload="none" src="${escapeHtml(item.file)}"></audio>`}
          <div class="row">
            <label>דירוג <select class="rating"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>
            <label style="flex:1">הערה <textarea class="note" rows="1" placeholder="רובוטי? מהיר מדי? הגייה שגויה במילה…"></textarea></label>
          </div>
        </article>`;
            })
            .join('');
          return `
      <section>
        <h2>${escapeHtml(paragraph.title)}</h2>
        <p class="text" ${lang === 'en' ? 'dir="ltr"' : ''}>${escapeHtml(paragraph.text)}</p>
        ${takes}
      </section>`;
        })
        .join('');
      return `<h1 style="margin-top:48px">${LANG_TITLE[lang]}</h1>${paragraphs}`;
    })
    .join('');

  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>אודישן קולות — מצפן המימדים</title><style>${PAGE_STYLE}</style></head>
<body><main>
  <h1>אודישן קולות</h1>
  <p class="muted">הופק ב-${escapeHtml(generatedAt)}. הבחירה נעשית באוזן: מומלץ להאזין באוזניות, בעוצמה שבה מתרגלים, ולהתחיל ב"האזנה עיוורת".</p>
  <div class="row" style="margin:16px 0">
    <button id="blind" type="button" aria-pressed="false">האזנה עיוורת: כבויה</button>
    <button id="export" type="button" class="primary">סיכום הבחירה שלי</button>
  </div>
  ${sections}
  <h2>סיכום</h2>
  <p class="muted">ממוצע הדירוג לכל קול וגרסה. את הטקסט הזה אפשר להעתיק ולהדביק ל-Claude.</p>
  <pre id="summary">עוד אין דירוגים.</pre>
</main>
<script>
  const STORE = 'dc-audition-v1';
  const saved = JSON.parse(localStorage.getItem(STORE) || '{}');
  const takes = [...document.querySelectorAll('.take')];
  for (const take of takes) {
    const state = saved[take.dataset.key] || {};
    const rating = take.querySelector('.rating'), note = take.querySelector('.note');
    rating.value = state.rating || ''; note.value = state.note || '';
    const persist = () => { saved[take.dataset.key] = { rating: rating.value, note: note.value }; localStorage.setItem(STORE, JSON.stringify(saved)); };
    rating.addEventListener('change', persist); note.addEventListener('input', persist);
  }
  // רק הקלטה אחת מתנגנת בכל רגע
  document.addEventListener('play', (event) => { for (const audio of document.querySelectorAll('audio')) if (audio !== event.target) audio.pause(); }, true);
  const blind = document.getElementById('blind');
  blind.addEventListener('click', () => {
    const on = document.body.classList.toggle('blind');
    blind.setAttribute('aria-pressed', String(on)); blind.textContent = 'האזנה עיוורת: ' + (on ? 'פועלת' : 'כבויה');
  });
  document.getElementById('export').addEventListener('click', () => {
    const groups = {};
    for (const take of takes) {
      const state = saved[take.dataset.key]; if (!state || !state.rating) continue;
      const id = take.dataset.lang + ' | ' + take.querySelector('h3').textContent.trim() + ' | ' + take.dataset.voice;
      (groups[id] ||= { sum: 0, n: 0, notes: [] }); groups[id].sum += Number(state.rating); groups[id].n += 1; if (state.note) groups[id].notes.push(state.note);
    }
    const lines = Object.entries(groups).sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n)
      .map(([id, g]) => (g.sum / g.n).toFixed(1) + '  (' + g.n + ')  ' + id + (g.notes.length ? '\\n      ' + g.notes.join(' / ') : ''));
    document.getElementById('summary').textContent = lines.length ? lines.join('\\n') : 'עוד אין דירוגים.';
    document.getElementById('summary').scrollIntoView({ behavior: 'smooth' });
  });
</script>
</body></html>`;
}

/** דף המועמדים: קולות החשבון וקולות מהספרייה, עם דוגמת ההאזנה של ElevenLabs עצמה — בלי להפיק דבר ובלי עלות. */
export function renderCandidatesHtml({ account, library, generatedAt }) {
  const card = (voice, source) => `
    <article class="take">
      <header>
        <h3>${escapeHtml(voice.name)}</h3>
        <span class="muted" dir="ltr">${escapeHtml(voice.voice_id)}</span>
      </header>
      <p class="muted">${escapeHtml([source, voice.gender, voice.age, voice.accent, voice.use_case, voice.descriptive, voice.category].filter(Boolean).join(' · '))}</p>
      ${voice.description ? `<p dir="auto">${escapeHtml(voice.description)}</p>` : ''}
      ${voice.preview_url ? `<audio controls preload="none" src="${escapeHtml(voice.preview_url)}"></audio>` : '<p class="muted">אין דוגמת האזנה.</p>'}
      <p class="muted" dir="ltr">{ "voice_id": "${escapeHtml(voice.voice_id)}", "name": "${escapeHtml(voice.name)}" }</p>
    </article>`;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>קולות מועמדים — מצפן המימדים</title><style>${PAGE_STYLE}</style></head>
<body><main>
  <h1>קולות מועמדים</h1>
  <p class="muted">נוצר ב-${escapeHtml(generatedAt)}. הדוגמאות כאן הן של ElevenLabs — ההאזנה אינה עולה דבר. בוחרים 4–6 קולות לעברית (לפחות אישה אחת וגבר אחד) ו-2–3 לאנגלית, ומעתיקים את השורה שמתחת לכל קול אל <span dir="ltr">tools/voice/audition.config.json</span>.</p>
  <p class="muted">קול מהספרייה צריך להתווסף קודם ל-My Voices בחשבון ElevenLabs (הוספה תופסת מקום ברשימת הקולות של התוכנית). את זה עושים באתר, לא מכאן.</p>
  <h2>הקולות שכבר בחשבון (${account.length})</h2>
  ${account.map((v) => card(v, 'בחשבון')).join('') || '<p class="muted">אין.</p>'}
  <h2>מהספרייה — מתאימים לעברית (${library.he.length})</h2>
  ${library.he.map((v) => card(v, 'ספרייה')).join('') || '<p class="muted">לא נמצאו.</p>'}
  <h2>מהספרייה — אנגלית רגועה (${library.en.length})</h2>
  ${library.en.map((v) => card(v, 'ספרייה')).join('') || '<p class="muted">לא נמצאו.</p>'}
</main></body></html>`;
}

/** קולות מהספרייה שמתאימים להדרכה רגועה: קודם אלה שתויגו למדיטציה/קריינות, ואז לפי שימוש. */
export function rankLibraryVoices(voices) {
  const CALM = /meditat|calm|sooth|relax|narrat|story|audiobook|gentle|warm|soft/i;
  const score = (voice) => (CALM.test(`${voice.use_case} ${voice.descriptive} ${voice.description} ${voice.name}`) ? 1_000_000_000 : 0) + (voice.usage_character_count_1y ?? 0);
  return [...voices].sort((a, b) => score(b) - score(a));
}
