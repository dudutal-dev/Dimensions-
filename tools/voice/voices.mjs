/**
 * npm run voice:voices — רשימת קולות מועמדים, בלי להפיק דבר ובלי עלות:
 * הקולות שכבר בחשבון + קולות מהספרייה שמתאימים לעברית ולאנגלית רגועה, עם דוגמאות ההאזנה של ElevenLabs.
 * הפלט: tools/voice/out/candidates.html (נפתח בדפדפן). הקריאות הן GET בלבד; שום דבר בחשבון אינו משתנה.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { API, OUT_DIR, explainHttpError, rankLibraryVoices, readApiKey, redact, renderCandidatesHtml } from './lib.mjs';

const apiKey = readApiKey();

async function get(path) {
  const response = await fetch(`${API}${path}`, { headers: { 'xi-api-key': apiKey } });
  if (!response.ok) throw new Error(explainHttpError(response.status, await response.text(), apiKey));
  return response.json();
}

const pick = (voice) => ({
  voice_id: voice.voice_id,
  name: voice.name,
  category: voice.category,
  gender: voice.gender ?? voice.labels?.gender,
  age: voice.age ?? voice.labels?.age,
  accent: voice.accent ?? voice.labels?.accent,
  use_case: voice.use_case ?? voice.labels?.use_case,
  descriptive: voice.descriptive ?? voice.labels?.descriptive,
  description: voice.description,
  preview_url: voice.preview_url,
  usage_character_count_1y: voice.usage_character_count_1y,
});

async function library(params) {
  const query = new URLSearchParams({ page_size: '60', sort: 'usage_character_count_1y', ...params });
  const data = await get(`/v1/shared-voices?${query}`);
  return rankLibraryVoices((data.voices ?? []).map(pick));
}

try {
  const account = ((await get('/v1/voices')).voices ?? []).map(pick);
  const he = (await library({ language: 'he' })).slice(0, 24);
  const calmEnglish = [...(await library({ language: 'en', use_cases: 'meditation' })), ...(await library({ language: 'en', search: 'calm meditation' }))];
  const en = [...new Map(calmEnglish.map((voice) => [voice.voice_id, voice])).values()].slice(0, 16);

  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, 'candidates.html');
  writeFileSync(file, renderCandidatesHtml({ account, library: { he, en }, generatedAt: new Date().toLocaleString('he-IL') }));
  writeFileSync(join(OUT_DIR, 'candidates.json'), JSON.stringify({ account, library: { he, en } }, null, 2));
  console.log(`בחשבון: ${account.length} קולות · ספרייה: ${he.length} לעברית, ${en.length} לאנגלית`);
  console.log(`לפתוח בדפדפן: ${file}`);
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : error, apiKey));
  process.exit(1);
}
