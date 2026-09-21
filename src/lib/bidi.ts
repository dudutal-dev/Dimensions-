/**
 * טווחי מספרים בתוך טקסט עברי ("שבועות 1–3", "20–30 דקות").
 * הקו המפריד (–) הוא תו ניטרלי, ולכן אלגוריתם הכיווניות הופך את הסדר ומציג "3–1".
 * הפתרון: לעטוף את הטווח בבידוד LTR. התווים נבנים מקודי תווים — בקוד המקור אין תווים בלתי-נראים.
 */
const LTR_ISOLATE = String.fromCharCode(0x2066);
const POP_ISOLATE = String.fromCharCode(0x2069);
const NUMBER = String.raw`\d+(?:[.:]\d+)?`;
const RANGE = new RegExp(`${NUMBER}(?:\\s?[–—-]\\s?${NUMBER})+`, 'g');

export function isolateRanges(text: string): string {
  return text.replace(RANGE, (range) => `${LTR_ISOLATE}${range}${POP_ISOLATE}`);
}

/** מספר עם סימן (‎+2‎): בלי בידוד, הסימן קופץ לצד השני של המספר. */
export function isolateLtr(text: string): string {
  return `${LTR_ISOLATE}${text}${POP_ISOLATE}`;
}
