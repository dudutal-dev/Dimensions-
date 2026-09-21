/**
 * מקור אמת יחיד לנכסי ההתקנה: ציור האייקון, רשימת הגדלים, ומסכי הפתיחה של iOS.
 * משמש גם את tools/make-icons.mjs (הפקת ה-PNG) וגם את vite.config.ts (תגיות ה-link ב-index.html).
 * הצבעים כאן הם ערכי ה-tokens של הערכה הכהה/הבהירה (src/design/tokens.css) — קובצי תמונה אינם יכולים לקרוא משתני CSS.
 */

export const COLORS = {
  dark: { bg: '#0B0F1A', bgGlow: '#1B2447', ring: '#F2D492', needleNorth: '#F2D492', needleSouth: '#8B7CF6', core: '#5EDCC8' },
  light: { bg: '#F7F5F0', bgGlow: '#FFFFFF', ring: '#7D5C14', needleNorth: '#B8860B', needleSouth: '#5B48D6', core: '#0F8F7E' },
};

/** המצפן: טבעת, ארבעה סימני כיוון, מחט (זהב — לאן; אינדיגו — מאין), וליבה בצבע 5D. מצויר סביב (256,256), רדיוס 160. */
function compass(c) {
  return `
    <circle cx="256" cy="256" r="132" fill="none" stroke="${c.ring}" stroke-width="10" stroke-opacity="0.92"/>
    <path d="M256 96v26M256 390v26M96 256h26M390 256h26" stroke="${c.ring}" stroke-width="10" stroke-linecap="round"/>
    <g transform="rotate(35 256 256)">
      <path d="M256 150 286 256H226Z" fill="${c.needleNorth}"/>
      <path d="M256 362 286 256H226Z" fill="${c.needleSouth}"/>
    </g>
    <circle cx="256" cy="256" r="22" fill="${c.bg}"/>
    <circle cx="256" cy="256" r="12" fill="${c.core}"/>`;
}

/** אייקון האפליקציה. full-bleed: הרקע ממלא את כל הריבוע (apple-touch, maskable); אחרת — פינות מעוגלות ושקיפות סביבן. */
export function iconSvg({ fullBleed }) {
  const c = COLORS.dark;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="aurora" cx="50%" cy="36%" r="78%">
      <stop offset="0" stop-color="${c.bgGlow}"/>
      <stop offset="0.6" stop-color="#0F1428"/>
      <stop offset="1" stop-color="${c.bg}"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${c.core}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${c.core}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" ${fullBleed ? '' : 'rx="112"'} fill="url(#aurora)"/>
  <circle cx="256" cy="256" r="176" fill="url(#glow)"/>
  ${compass(c)}
</svg>`;
}

/** מסך פתיחה: רקע הערכה, והמצפן במרכז. בלי טקסט — כדי לא לתלות את ההפקה בגופן. */
export function splashSvg({ width, height, scheme }) {
  const c = COLORS[scheme];
  const size = Math.round(Math.min(width, height) * 0.34);
  const x = Math.round((width - size) / 2);
  const y = Math.round((height - size) / 2 - height * 0.03);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${c.bg}"/>
  <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="64 64 384 384">${compass(c)}</svg>
</svg>`;
}

export const ICONS = [
  { file: 'icon-192.png', size: 192, fullBleed: false },
  { file: 'icon-512.png', size: 512, fullBleed: false },
  { file: 'icon-maskable-512.png', size: 512, fullBleed: true },
  { file: 'apple-touch-icon.png', size: 180, fullBleed: true },
];

/** מכשירי iPhone נפוצים, לאורך בלבד (ה-manifest נועל לאורך): רוחב וגובה בנקודות, ויחס הפיקסלים. */
export const SPLASH_DEVICES = [
  { w: 440, h: 956, dpr: 3 },
  { w: 402, h: 874, dpr: 3 },
  { w: 430, h: 932, dpr: 3 },
  { w: 393, h: 852, dpr: 3 },
  { w: 428, h: 926, dpr: 3 },
  { w: 390, h: 844, dpr: 3 },
  { w: 375, h: 812, dpr: 3 },
  { w: 414, h: 896, dpr: 3 },
  { w: 414, h: 896, dpr: 2 },
  { w: 375, h: 667, dpr: 2 },
];

export const SCHEMES = ['dark', 'light'];

export const splashFile = (device, scheme) => `splash/${scheme}-${device.w * device.dpr}x${device.h * device.dpr}.png`;

/** תגיות ה-link של מסכי הפתיחה — iOS בוחר לפי מידות המכשיר, יחס הפיקסלים וערכת הצבע. */
export function splashLinks(base = './') {
  return SPLASH_DEVICES.flatMap((device) =>
    SCHEMES.map((scheme) => ({
      tag: 'link',
      injectTo: 'head',
      attrs: {
        rel: 'apple-touch-startup-image',
        href: `${base}${splashFile(device, scheme)}`,
        media: `screen and (device-width: ${device.w}px) and (device-height: ${device.h}px) and (-webkit-device-pixel-ratio: ${device.dpr}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`,
      },
    })),
  );
}
