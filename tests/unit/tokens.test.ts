/**
 * ניגודיות אוטומטית לכל זוגות ה-tokens (SPEC פרק 11): טקסט ‎≥4.5:1‎, גבול פקדים ‎≥3:1‎ — בכהה ובבהיר.
 * הבדיקה קוראת את tokens.css עצמו, כך ששינוי צבע שמפר ניגודיות נכשל מיד.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', '..', 'src', 'design', 'tokens.css'), 'utf8');

function readTheme(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`לא נמצא ${selector}`);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]!] = match[2]!;
  }
  return tokens;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const THEMES = {
  dark: readTheme("[data-theme='dark']"),
  light: readTheme("[data-theme='light']"),
};

const SURFACES = ['bg', 'surface', 'surface-2'];
const TEXT_LIKE = ['text', 'text-muted', 'd3', 'd4', 'd5', 'accent', 'danger'];

describe.each(Object.entries(THEMES))('ניגודיות — ערכה %s', (_name, t) => {
  it('כל ה-tokens הוגדרו', () => {
    for (const token of [...SURFACES, ...TEXT_LIKE, 'border', 'border-strong', 'accent-fill', 'on-accent', 'on-danger']) {
      expect(t[token], token).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(TEXT_LIKE)('%s קריא כטקסט על כל המשטחים (4.5:1)', (fg) => {
    for (const surface of SURFACES) {
      expect(contrast(t[fg]!, t[surface]!), `${fg} על ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('טקסט על כפתור ראשי ועל כפתור מחיקה (4.5:1)', () => {
    expect(contrast(t['on-accent']!, t['accent-fill']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['on-danger']!, t.danger!)).toBeGreaterThanOrEqual(4.5);
  });

  it('גבול הפקדים נראה על כל המשטחים (3:1)', () => {
    for (const surface of SURFACES) {
      expect(contrast(t['border-strong']!, t[surface]!), `border-strong על ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });
});
