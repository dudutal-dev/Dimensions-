// ולידציית חבילת התוכן: סכמות Zod + בדיקות צולבות. הרצה: npm run content:check
import { collectSegmentOwners, sumDuration, validateContent } from '../src/content/validate.ts';
import { readRawContent } from './read-content.mjs';

const { raw, issues: readIssues } = await readRawContent();
const { bundle, issues: contentIssues } = readIssues.length
  ? { bundle: null, issues: [] }
  : validateContent(raw);
const issues = [...readIssues, ...contentIssues];

for (const issue of issues) {
  const mark = issue.level === 'error' ? 'ERROR' : 'warn ';
  console.log(`${mark}  ${issue.file}  ${issue.message}`);
}

const errors = issues.filter((i) => i.level === 'error').length;
const warnings = issues.length - errors;

if (bundle) {
  const owners = collectSegmentOwners(bundle);
  const segments = owners.flatMap((o) => o.segments);
  const spoken = segments.filter((s) => s.type === 'instruction' || s.type === 'prompt');
  const chars = spoken.reduce((sum, s) => sum + s.text.length, 0);
  const minutes = Math.round(owners.reduce((sum, o) => sum + sumDuration(o.segments), 0) / 60);
  console.log(
    `\nתוכן: ${bundle.exercises.exercises.length} תרגילים · ${bundle.tools.tools.length} כלים · ` +
      `${bundle.triggers.triggers.length} טריגרים · ${bundle.library.articles.length} מאמרים`,
  );
  console.log(
    `מקטעים: ${segments.length} (מתוכם ${spoken.length} מדוברים, ${chars} תווים לקול) · כ-${minutes} דקות הנחיה`,
  );
}

console.log(`\n${errors} שגיאות · ${warnings} אזהרות`);
process.exit(errors > 0 ? 1 : 0);
