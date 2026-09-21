# מצפן המימדים — הנחיות ל-Claude Code

אפליקציית PWA בעברית (RTL) לאימון תודעת 3D/4D/5D. המפרט המלא: `SPEC.md`. מקור האמת לתוכן: `content-source/` (קריאה בלבד).

## פקודות
- `npm run dev` · `npm run build` · `npm run test` (Vitest) · `npm run e2e` (Playwright) · `npm run content:check`
- `npm run content:review` — מפיק מחדש את `CONTENT-REVIEW.md` מתוך `src/content/*.json` (לא לערוך את הקובץ ידנית) · `npm run typecheck`
- שלב ב': `npm run voice:estimate` · `npm run voice:audition` · `npm run voice:generate -- --only <ids>`

## כללים שאסור להפר
- עובדים לפי אבני הדרך ב-SPEC פרק 12, אחת בכל פעם. בסוף כל אחת: בדיקות, commit, סיכום, **והמתנה לאישור דודו**.
- M0 (חבילת תוכן) לפני כל קוד UI.
- לא להמציא תוכן מקצועי. רק מה שב-`content-source/`. עריכת ניסוח — כן.
- אין לטעון שהפיזיקה מוכיחה את המודל. "מימד" = מצב תודעה. תגיות רובד בספרייה: מבוסס / ספקולטיבי / מטפורי.
- אין gamification: בלי XP, בלי streak אדום, בלי מסך "הגעת ל-5D". 3D אינו "רע" — בלי צבעי רמזור.
- הכול מקומי. בלי אנליטיקס, בלי קריאות רשת בשלב א'.
- מפתח ElevenLabs רק ב-`.env` (ב-.gitignore). לעולם לא בקוד, ב-commit או ב-`dist/`.
- כל צליל עובר דרך `AudioEngine` (SPEC פרק 9). אודיו נבדק על iPhone פיזי.
- כל טקסט הדרכה מפורק ל-`segments` עם `id` יציב — זה גם תסריט הקול של שלב ב'.

## קוד
- **מובייל תחילה** (SPEC 4.6): מתכננים ובודקים ב-375px קודם; iPhone Safari/PWA ראשי, Android Chrome נתמך.
- TypeScript strict. `domain/` טהור (בלי React/Dexie) ומכוסה בבדיקות.
- צבעים רק דרך tokens סמנטיים. מאפייני CSS לוגיים בלבד (RTL). יעדי מגע ≥48px. אין emoji כאייקונים (Lucide + גליפים ייעודיים).
- כל קלט משתמש נשמר אוטומטית ומיד.
- `prefers-reduced-motion` נתמך בכל אנימציה.
- לפני מסירה ויזואלית: Pre-Delivery Checklist של הסקיל `ui-ux-pro-max`.

## סקילים לשימוש
`ui-ux-pro-max` (עיצוב) · `app-builder` (ארכיטקטורה, auto-save, בדיקות) · `hebrew-tts-expert` (שלב ב') · `quantum-dimensions-expert` (תוכן).
