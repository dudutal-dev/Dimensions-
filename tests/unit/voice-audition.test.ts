import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditionTexts,
  buildPlan,
  estimate,
  explainHttpError,
  rankLibraryVoices,
  readApiKey,
  redact,
  renderAuditionHtml,
  renderCandidatesHtml,
  speakable,
  ttsRequest,
  validateConfig,
  withKey,
} from '../../tools/voice/lib.mjs';

const ROOT = join(__dirname, '..', '..');
const baseConfig = JSON.parse(readFileSync(join(ROOT, 'tools', 'voice', 'audition.config.json'), 'utf8'));
const FAKE_KEY = `sk_${'a1b2c3d4'.repeat(5)}`;
const withVoices = () => ({
  ...baseConfig,
  voices: {
    he: [
      { voice_id: 'HebrewVoiceId0000001', name: 'נועה' },
      { voice_id: 'HebrewVoiceId0000002', name: 'אורי' },
    ],
    en: [{ voice_id: 'EnglishVoiceId000001', name: 'Grace' }],
  },
});
const texts = (config: typeof baseConfig) => ({ he: auditionTexts(config, 'he'), en: auditionTexts(config, 'en') });

describe('אודישן קולות — טקסטים', () => {
  it('שלוש פסקאות המבחן נלקחות מהתוכן עצמו, נקיות מסימוני עיצוב ומספרות', () => {
    const he = auditionTexts(baseConfig, 'he');
    expect(he.map((p) => p.id)).toEqual(['breath', 'explain', 'heart']);
    expect(he[0]!.text).toContain('שב בנוחות. תן לגוף להיות כבד.');
    expect(he[2]!.text).toContain('הלוואי שאהיה בטוח.');
    for (const paragraph of he) {
      expect(paragraph.text).not.toMatch(/[*{}“”"0-9]/);
      expect(paragraph.text.length).toBeGreaterThan(120);
      expect(paragraph.text.length).toBeLessThan(400);
    }
  });

  it('מקטעים מופרדים בשורה ריקה — כך נוצרת ההפסקה ב-v3, שאינו תומך ב-SSML break', () => {
    expect(auditionTexts(baseConfig, 'he')[0]!.text.split('\n\n').length).toBe(4);
  });

  it('לכל פסקה יש גרסה אנגלית', () => {
    const en = auditionTexts(baseConfig, 'en');
    expect(en.map((p) => p.id)).toEqual(['breath', 'explain', 'heart']);
    for (const paragraph of en) expect(paragraph.text).toMatch(/^[A-Z][\s\S]+\.$/);
  });

  it('מקטע שאינו קיים בתוכן עוצר את התכנון', () => {
    const broken = { ...baseConfig, paragraphs: [{ id: 'x', title: 'x', segments: ['t1.s99'] }] };
    expect(() => auditionTexts(broken, 'he')).toThrow(/אינו קיים/);
  });

  it('speakable מסיר הדגשות, תגיות רובד ומירכאות, והופך קו מפריד לפסיק', () => {
    expect(speakable('**הגוף** הוא “הערוץ” — הישר {{established}}')).toBe('הגוף הוא הערוץ, הישר');
  });
});

describe('אודישן קולות — תכנון והערכה', () => {
  it('ברירת המחדל: עברית רק ב-eleven_v3, ויציבות במצבים שהמודל מקבל', () => {
    expect(validateConfig(baseConfig)).toEqual([]);
    expect(baseConfig.variants.he.every((v: { model_id: string }) => v.model_id === 'eleven_v3')).toBe(true);
  });

  it('תצורה שגויה נתפסת: מודל בלי עברית, יציבות לא חוקית, קול כפול, מזהה משובש', () => {
    const bad = withVoices();
    bad.variants = { ...bad.variants, he: [{ id: 'x', model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.7 } }, { id: 'y', model_id: 'eleven_v3', voice_settings: { stability: 0.7 } }] };
    bad.voices.he = [bad.voices.he[0]!, bad.voices.he[0]!, { voice_id: 'קול', name: 'שבור' }];
    const problems = validateConfig(bad);
    expect(problems.some((p) => p.includes('רק eleven_v3 תומך בעברית'))).toBe(true);
    expect(problems.some((p) => p.includes('0, 0.5 או 1'))).toBe(true);
    expect(problems.some((p) => p.includes('פעמיים'))).toBe(true);
    expect(problems.some((p) => p.includes('voice_id לא תקין'))).toBe(true);
  });

  it('קולות × גרסאות × פסקאות; language_code נשלח רק ל-v3', () => {
    const config = withVoices();
    const items = buildPlan(config, texts(config));
    expect(items).toHaveLength(2 * 2 * 3 + 1 * 2 * 3);
    expect(items.filter((i) => i.body.model_id === 'eleven_v3').every((i) => i.body.language_code === i.lang)).toBe(true);
    expect(items.filter((i) => i.body.model_id === 'eleven_multilingual_v2').every((i) => !('language_code' in i.body))).toBe(true);
    expect(new Set(items.map((i) => i.file)).size).toBe(items.length);
  });

  it('שם הקובץ נגזר מהתוכן: שינוי מילה או הגדרה נותן קובץ חדש, והפקה זהה מדולגת', () => {
    const config = withVoices();
    const first = buildPlan(config, texts(config));
    const again = buildPlan(config, texts(config));
    expect(again.map((i) => i.file)).toEqual(first.map((i) => i.file));

    const changed = texts(config);
    changed.he[0] = { ...changed.he[0]!, text: `${changed.he[0]!.text} עוד מילה.` };
    const after = buildPlan(config, changed);
    const differing = after.filter((item, index) => item.file !== first[index]!.file);
    expect(differing).toHaveLength(2 * 2); // רק הפסקה ששונתה, בשני הקולות ובשתי הגרסאות

    const existing = new Set(first.slice(0, 5).map((i) => i.file));
    const summary = estimate(first, existing);
    expect(summary).toMatchObject({ total: 18, skipped: 5, pending: 13 });
    expect(summary.chars).toBe(first.slice(5).reduce((sum, i) => sum + i.chars, 0));
    expect(summary.charsAll).toBeGreaterThan(summary.chars);
  });
});

describe('אודישן קולות — המפתח אינו דולף', () => {
  it('הבקשה נבנית בלי המפתח; הוא מתווסף רק ברגע השליחה', () => {
    const config = withVoices();
    const item = buildPlan(config, texts(config))[0]!;
    const { url, init } = ttsRequest(item, config.output_format);
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/HebrewVoiceId0000001?output_format=mp3_44100_128');
    expect(JSON.stringify(init)).not.toContain('xi-api-key');
    expect(JSON.parse(init.body)).toMatchObject({ model_id: 'eleven_v3', language_code: 'he', voice_settings: { stability: 0.5 } });
    expect(withKey(init, FAKE_KEY).headers['xi-api-key']).toBe(FAKE_KEY);
    expect(init.headers).not.toHaveProperty('xi-api-key'); // המקור לא השתנה
  });

  it('redact מוחק את המפתח מכל טקסט — גם אם חזר בתוך הודעת שגיאה', () => {
    expect(redact(`bad key ${FAKE_KEY} rejected`, FAKE_KEY)).not.toContain(FAKE_KEY);
    expect(redact(`leaked ${FAKE_KEY}`, undefined)).not.toContain(FAKE_KEY);
    expect(explainHttpError(401, JSON.stringify({ detail: { message: `Invalid API key ${FAKE_KEY}` } }), FAKE_KEY)).not.toContain(FAKE_KEY);
  });

  it('שגיאות HTTP מוסברות בעברית', () => {
    expect(explainHttpError(401, '{}', FAKE_KEY)).toContain('המפתח אינו תקין');
    expect(explainHttpError(422, JSON.stringify({ detail: { message: 'stability must be one of 0.0, 0.5, 1.0' } }), FAKE_KEY)).toContain('stability must be');
    expect(explainHttpError(500, 'oops', FAKE_KEY)).toContain('HTTP 500');
  });

  it('בלי מפתח — הודעה ברורה שמפנה ל-.env.example; ערך ה-placeholder אינו נחשב מפתח', () => {
    expect(() => readApiKey({}, join(ROOT, 'no-such.env'))).toThrow(/\.env\.example/);
    expect(() => readApiKey({ ELEVENLABS_API_KEY: 'PUT_YOUR_KEY_HERE' }, join(ROOT, 'no-such.env'))).toThrow(/\.env\.example/);
    expect(readApiKey({ ELEVENLABS_API_KEY: ` ${FAKE_KEY} ` }, join(ROOT, 'no-such.env'))).toBe(FAKE_KEY);
  });

  it('הקובץ .env.example מכיל placeholder בלבד, ו-.env ותוצרי הקול ב-.gitignore', () => {
    expect(readFileSync(join(ROOT, '.env.example'), 'utf8')).toMatch(/^ELEVENLABS_API_KEY=PUT_YOUR_KEY_HERE$/m);
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^tools\/voice\/out\/$/m);
  });
});

describe('אודישן קולות — דפי ההשוואה', () => {
  it('דף האודישן: נגן לכל הפקה, דירוג והערה, האזנה עיוורת, וטקסט זדוני אינו הופך ל-HTML', () => {
    const config = withVoices();
    config.voices.he[0] = { voice_id: 'HebrewVoiceId0000001', name: '<img src=x onerror=alert(1)>' };
    const items = buildPlan(config, texts(config));
    items[1]!.error = 'HTTP 404';
    const html = renderAuditionHtml({ items, textsByLang: texts(config), generatedAt: 'היום' });

    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(html.match(/<audio /g)).toHaveLength(items.length - 1);
    expect(html).toContain('לא הופק: HTTP 404');
    expect(html).toContain('האזנה עיוורת');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toMatch(/https?:\/\//); // דף מקומי לגמרי: בלי משאבים חיצוניים
  });

  it('דף המועמדים מציג מזהה להעתקה ודוגמת האזנה, ומסביר שהוספה לחשבון נעשית באתר', () => {
    const voice = { voice_id: 'LibraryVoiceId000001', name: 'Calm Dana', gender: 'female', use_case: 'meditation', preview_url: 'https://example.com/p.mp3' };
    const html = renderCandidatesHtml({ account: [], library: { he: [voice], en: [] }, generatedAt: 'היום' });
    expect(html).toContain('"voice_id": "LibraryVoiceId000001"');
    expect(html).toContain('<audio controls preload="none" src="https://example.com/p.mp3">');
    expect(html).toContain('My Voices');
  });

  it('קולות שתויגו למדיטציה או לקריינות רגועה קודמים לקולות פופולריים סתם', () => {
    const ranked = rankLibraryVoices([
      { voice_id: 'a', name: 'Hype Ad', use_case: 'advertisement', usage_character_count_1y: 9_000_000 },
      { voice_id: 'b', name: 'Soft Guide', use_case: 'meditation', usage_character_count_1y: 10 },
      { voice_id: 'c', name: 'Story', descriptive: 'calm', usage_character_count_1y: 500 },
    ]);
    expect(ranked.map((v) => v.voice_id)).toEqual(['c', 'b', 'a']);
  });
});
