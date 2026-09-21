// קריאת קובצי ה-JSON של חבילת התוכן מהדיסק (משותף לסקריפטים שב-tools/).
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_FILES } from '../src/content/validate.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT_DIR = join(ROOT, 'src', 'content');

export async function readRawContent() {
  const raw = {};
  const issues = [];
  for (const name of CONTENT_FILES) {
    const file = `${name}.json`;
    try {
      raw[name] = JSON.parse(await readFile(join(CONTENT_DIR, file), 'utf8'));
    } catch (error) {
      issues.push({ level: 'error', file, message: `קריאת JSON נכשלה: ${error.message}` });
    }
  }
  return { raw, issues };
}
