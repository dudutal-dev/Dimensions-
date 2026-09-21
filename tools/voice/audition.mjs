/**
 * npm run voice:audition -- --yes — מפיק את פסקאות המבחן בכל קול × גרסה, ובונה דף השוואה מקומי (SPEC 10.2).
 *
 * - בלי  --yes  הסקריפט רק מציג את ההיקף ויוצא: הפקה עולה תווים מהמכסה, ולכן דורשת אישור מפורש.
 * - הפקה שכבר קיימת (אותו קול, אותו טקסט, אותן הגדרות) מדולגת — אפשר לעצור ולהמשיך.
 * - הפלט ב-tools/voice/out/ (ב-.gitignore): קובצי MP3, audition.html, ו-audition-log.json בלי המפתח.
 * - אפשר לצמצם:  -- --yes --lang he   או   -- --yes --voice <voice_id>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OUT_DIR, ROOT, auditionTexts, buildPlan, estimate, explainHttpError, readApiKey, redact, renderAuditionHtml, ttsRequest, validateConfig, withKey } from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const config = JSON.parse(readFileSync(join(ROOT, 'tools', 'voice', 'audition.config.json'), 'utf8'));
const problems = validateConfig(config);
if (problems.length > 0) {
  console.error(`audition.config.json:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

const textsByLang = { he: auditionTexts(config, 'he'), en: auditionTexts(config, 'en') };
let items = buildPlan(config, textsByLang);
if (option('lang')) items = items.filter((item) => item.lang === option('lang'));
if (option('voice')) items = items.filter((item) => item.voice.voice_id === option('voice'));
if (items.length === 0) {
  console.log('אין מה להפיק. לבחור קולות (npm run voice:voices) ולמלא את voices ב-tools/voice/audition.config.json.');
  process.exit(0);
}

const existing = new Set(items.filter((item) => existsSync(join(OUT_DIR, item.file))).map((item) => item.file));
const summary = estimate(items, existing);
console.log(`הפקות: ${summary.total} (${summary.skipped} קיימות, ${summary.pending} חדשות) · תווים להפקה: ${summary.chars.toLocaleString('en-US')}`);
if (!flag('yes')) {
  console.log('זו הערכה בלבד. כדי להפיק בפועל (עולה תווים מהמכסה):  npm run voice:audition -- --yes');
  process.exit(0);
}

const apiKey = readApiKey();
const log = [];
let spent = 0;

async function generate(item) {
  const { url, init } = ttsRequest(item, config.output_format);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url, withKey(init, apiKey));
    if (response.ok) {
      const audio = Buffer.from(await response.arrayBuffer());
      const target = join(OUT_DIR, item.file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, audio);
      const cost = Number(response.headers.get('character-cost') ?? item.chars);
      spent += cost;
      return { ok: true, cost, bytes: audio.length, requestId: response.headers.get('request-id') };
    }
    const message = explainHttpError(response.status, await response.text(), apiKey);
    // רק עומס זמני שווה ניסיון חוזר; שגיאת פרמטר או הרשאה תחזור על עצמה
    if (response.status !== 429 && response.status < 500) return { ok: false, error: message };
    if (attempt === 4) return { ok: false, error: message };
    await sleep(1500 * 2 ** (attempt - 1));
  }
  return { ok: false, error: 'לא הופק' };
}

try {
  let index = 0;
  for (const item of items) {
    index++;
    const label = `[${index}/${items.length}] ${item.lang} · ${item.voice.name} · ${item.variant.id} · ${item.paragraph.id}`;
    if (existing.has(item.file)) {
      console.log(`${label} — קיים`);
      continue;
    }
    const result = await generate(item);
    if (result.ok) console.log(`${label} — הופק (${result.cost} תווים)`);
    else {
      item.error = result.error;
      console.log(`${label} — נכשל: ${result.error}`);
    }
    log.push({ file: item.file, lang: item.lang, voice: item.voice.voice_id, variant: item.variant.id, paragraph: item.paragraph.id, chars: item.chars, ...result });
    await sleep(400); // קצב מתון: בקשה אחת בכל פעם
  }
} finally {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'audition.html'), renderAuditionHtml({ items, textsByLang, generatedAt: new Date().toLocaleString('he-IL') }));
  writeFileSync(join(OUT_DIR, 'audition-log.json'), redact(JSON.stringify({ at: new Date().toISOString(), spent, log }, null, 2), apiKey));
  console.log(`\nנוצלו ${spent.toLocaleString('en-US')} תווים. לפתוח בדפדפן: ${join(OUT_DIR, 'audition.html')}`);
}
