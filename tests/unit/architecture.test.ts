/**
 * שומרי ארכיטקטורה (SPEC פרק 3 ו-CLAUDE.md):
 *   - domain/ טהור: בלי React, בלי Dexie, ובלי תלות בשכבות שמעליו.
 *   - המסכים לא מדברים עם Dexie ישירות — רק דרך data/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function importsOf(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  return [...code.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

describe('ארכיטקטורה', () => {
  it('domain/ אינו מייבא React, Dexie או שכבות עליונות', () => {
    const forbidden = /^(react|react-dom|dexie|dexie-react-hooks|zustand|framer-motion)$|\/(data|app|design|features)(\/|$)/;
    const violations = sourceFiles(join(SRC, 'domain')).flatMap((file) =>
      importsOf(file)
        .filter((spec) => forbidden.test(spec))
        .map((spec) => `${relative(SRC, file)} → ${spec}`),
    );
    expect(violations).toEqual([]);
  });

  it('רק data/ מייבא את Dexie (חוץ מ-useLiveQuery במסכים)', () => {
    const violations = sourceFiles(SRC)
      .filter((file) => !relative(SRC, file).startsWith('data'))
      .flatMap((file) =>
        importsOf(file)
          .filter((spec) => spec === 'dexie')
          .map((spec) => `${relative(SRC, file)} → ${spec}`),
      );
    expect(violations).toEqual([]);
  });

  it('design/ אינו תלוי במסכים או בנתונים', () => {
    const forbidden = /\/(data|app|features)(\/|$)/;
    const violations = sourceFiles(join(SRC, 'design')).flatMap((file) =>
      importsOf(file)
        .filter((spec) => forbidden.test(spec))
        .map((spec) => `${relative(SRC, file)} → ${spec}`),
    );
    expect(violations).toEqual([]);
  });
});
