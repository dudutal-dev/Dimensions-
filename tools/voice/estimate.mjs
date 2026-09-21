/**
 * npm run voice:estimate — כמה תווים יעלה האודישן, לפני שמפיקים משהו (SPEC 10.4: הערכת עלות לפני הרצה).
 * בלי רשת ובלי מפתח. עם  -- --quota  נשאלת גם המכסה שנותרה בחשבון (קריאת GET אחת, בלי עלות).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API, OUT_DIR, ROOT, auditionTexts, buildPlan, estimate, explainHttpError, readApiKey, redact, validateConfig } from './lib.mjs';

const config = JSON.parse(readFileSync(join(ROOT, 'tools', 'voice', 'audition.config.json'), 'utf8'));
const problems = validateConfig(config);
if (problems.length > 0) {
  console.error(`audition.config.json:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

const textsByLang = { he: auditionTexts(config, 'he'), en: auditionTexts(config, 'en') };
const items = buildPlan(config, textsByLang);
const existing = new Set(items.filter((item) => existsSync(join(OUT_DIR, item.file))).map((item) => item.file));
const summary = estimate(items, existing);

for (const lang of ['he', 'en']) {
  console.log(`\n${lang === 'he' ? 'עברית' : 'אנגלית'}: ${config.voices[lang].length} קולות × ${config.variants[lang].length} גרסאות × ${textsByLang[lang].length} פסקאות`);
  for (const paragraph of textsByLang[lang]) console.log(`  ${paragraph.id.padEnd(8)} ${String(paragraph.text.length).padStart(4)} תווים`);
}
if (items.length === 0) {
  console.log('\nעוד לא נבחרו קולות. להריץ  npm run voice:voices , לבחור, ולמלא את voices ב-tools/voice/audition.config.json.');
  process.exit(0);
}
console.log(`\nהפקות: ${summary.total} (${summary.skipped} כבר קיימות, ${summary.pending} חדשות)`);
console.log(`תווים להפקה עכשיו: ${summary.chars.toLocaleString('en-US')}  (עברית ${summary.byLang.he ?? 0} · אנגלית ${summary.byLang.en ?? 0})`);
console.log('העלות בקרדיטים תלויה במודל ובתוכנית — ב-ElevenLabs תו אחד הוא בדרך כלל קרדיט אחד; המספר המדויק מופיע בכותרת התשובה של כל הפקה ונרשם בלוג.');

if (process.argv.includes('--quota')) {
  let apiKey;
  try {
    apiKey = readApiKey();
    const response = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': apiKey } });
    if (!response.ok) throw new Error(explainHttpError(response.status, await response.text(), apiKey));
    const sub = await response.json();
    const left = sub.character_limit - sub.character_count;
    console.log(`\nתוכנית: ${sub.tier} · נותרו ${left.toLocaleString('en-US')} מתוך ${sub.character_limit.toLocaleString('en-US')} תווים`);
    if (summary.chars > left) console.log('שים לב: האודישן גדול מהמכסה שנותרה. אפשר לצמצם קולות או גרסאות.');
  } catch (error) {
    console.error(redact(error instanceof Error ? error.message : error, apiKey));
    process.exit(1);
  }
}
