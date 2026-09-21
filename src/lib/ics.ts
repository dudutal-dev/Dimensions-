/**
 * תזכורות בלי שרת (SPEC 6.8): קובץ iCalendar עם חמשת עוגני הבדיקה היומיים, ליומן של המכשיר.
 * השעות "צפות" (בלי אזור זמן) — היומן מפרש אותן כשעון המקומי, גם בחו״ל וגם במעבר לשעון קיץ.
 * ה-UID קבוע לכל עוגן, כך שייבוא חוזר אחרי שינוי שעה מעדכן את האירוע במקום לשכפל אותו.
 */

export interface IcsAnchor {
  id: string;
  label: string;
  /** HH:MM */
  time: string;
}

export interface IcsInput {
  anchors: IcsAnchor[];
  /** קישור עמוק לבדיקת המימד, למשל https://…/#/checkin */
  checkinUrl: string;
  now: Date;
}

export const ICS_FILE_NAME = 'dimension-compass-anchors.ics';
export const ICS_MIME = 'text/calendar';

const CRLF = String.fromCharCode(13, 10);
const BACKSLASH = String.fromCharCode(92);
const two = (n: number) => String(n).padStart(2, '0');

/** RFC 5545 §3.3.11: לוכסן הפוך, נקודה-פסיק, פסיק ושורה חדשה דורשים escape. */
export function escapeIcsText(text: string): string {
  return text
    .split(BACKSLASH)
    .join(BACKSLASH + BACKSLASH)
    .split(';')
    .join(`${BACKSLASH};`)
    .split(',')
    .join(`${BACKSLASH},`)
    .split(/\r?\n/)
    .join(`${BACKSLASH}n`);
}

/** RFC 5545 §3.1: שורה עד 75 אוקטטים; המשך מתחיל ברווח. עברית היא 2 בתים לתו, ולכן סופרים בתים ולא תווים. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // שורת המשך מתחילה ברווח שתופס אוקטט
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const localStamp = (date: Date, time: string) => `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}T${time.replace(':', '')}00`;
const utcStamp = (date: Date) =>
  `${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}T${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`;

export function buildAnchorsIcs({ anchors, checkinUrl, now }: IcsInput): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dimension Compass//Anchors//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const anchor of anchors) {
    const summary = `בדיקת מימד — ${anchor.label}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:anchor-${anchor.id}@dimension-compass`,
      `DTSTAMP:${utcStamp(now)}`,
      // SEQUENCE עולה עם הזמן, כדי שיומן שכבר מכיר את ה-UID יקבל את השעה החדשה
      `SEQUENCE:${Math.floor(now.getTime() / 60_000)}`,
      `DTSTART:${localStamp(now, anchor.time)}`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(`60 שניות: באיזה מימד אני עכשיו?\n${checkinUrl}`)}`,
      `URL:${checkinUrl}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(summary)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
