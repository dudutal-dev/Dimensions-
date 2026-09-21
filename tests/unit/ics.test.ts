import { describe, expect, it } from 'vitest';
import { buildAnchorsIcs, escapeIcsText, foldIcsLine } from '../../src/lib/ics';

const CRLF = String.fromCharCode(13, 10);
const BACKSLASH = String.fromCharCode(92);
const NOW = new Date('2026-09-21T10:00:00');
const ANCHORS = [
  { id: 'wake', label: 'התעוררות', time: '07:00' },
  { id: 'before-first-meeting', label: 'לפני ישיבה ראשונה', time: '09:00' },
  { id: 'after-lunch', label: 'אחרי ארוחת צהריים', time: '13:30' },
  { id: 'home', label: 'כניסה הביתה', time: '18:30' },
  { id: 'before-sleep', label: 'לפני שינה', time: '22:30' },
];
const URL = 'https://example.github.io/dimension-compass/#/checkin';

/** מבטל קיפול שורות, כמו שעושה יומן שקורא את הקובץ. */
const unfold = (ics: string) => ics.split(`${CRLF} `).join('');

describe('ייצוא עוגנים ל-ics', () => {
  it('חמישה אירועים יומיים, בשעות שנקבעו, עם תזכורת וקישור לבדיקה', () => {
    const ics = buildAnchorsIcs({ anchors: ANCHORS, checkinUrl: URL, now: NOW });
    const lines = unfold(ics).split(CRLF);

    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(5);
    expect(lines.filter((l) => l === 'RRULE:FREQ=DAILY')).toHaveLength(5);
    expect(lines.filter((l) => l === 'BEGIN:VALARM')).toHaveLength(5);
    expect(lines.filter((l) => l === `URL:${URL}`)).toHaveLength(5);
    expect(lines).toContain('DTSTART:20260921T070000');
    expect(lines).toContain('DTSTART:20260921T133000');
    expect(lines).toContain('DTSTART:20260921T223000');
    expect(lines).toContain('SUMMARY:בדיקת מימד — לפני שינה');
  });

  it('השעות צפות (בלי Z ובלי TZID), כדי שהיומן יפרש אותן כשעון המקומי', () => {
    const ics = buildAnchorsIcs({ anchors: ANCHORS, checkinUrl: URL, now: NOW });
    for (const line of unfold(ics).split(CRLF).filter((l) => l.startsWith('DTSTART'))) {
      expect(line).toMatch(/^DTSTART:\d{8}T\d{6}$/);
    }
  });

  it('UID קבוע לכל עוגן ו-SEQUENCE עולה — ייבוא חוזר מעדכן ולא משכפל', () => {
    const first = unfold(buildAnchorsIcs({ anchors: ANCHORS, checkinUrl: URL, now: NOW })).split(CRLF);
    const later = unfold(buildAnchorsIcs({ anchors: ANCHORS.map((a) => ({ ...a, time: '06:15' })), checkinUrl: URL, now: new Date(NOW.getTime() + 3_600_000) })).split(CRLF);
    const uids = (lines: string[]) => lines.filter((l) => l.startsWith('UID:'));
    const sequence = (lines: string[]) => Number(lines.find((l) => l.startsWith('SEQUENCE:'))!.slice(9));

    expect(uids(later)).toEqual(uids(first));
    expect(new Set(uids(first)).size).toBe(5);
    expect(sequence(later)).toBeGreaterThan(sequence(first));
    expect(later).toContain('DTSTART:20260921T061500');
  });

  it('כל שורה מסתיימת ב-CRLF ואינה עוברת 75 אוקטטים — גם בעברית', () => {
    const ics = buildAnchorsIcs({ anchors: ANCHORS, checkinUrl: URL, now: NOW });
    expect(ics.endsWith(CRLF)).toBe(true);
    expect(ics.split(CRLF).join('')).not.toContain(String.fromCharCode(10));
    const encoder = new TextEncoder();
    for (const line of ics.split(CRLF)) {
      expect(encoder.encode(line).length, line).toBeLessThanOrEqual(75);
    }
  });

  it('קיפול שורה אינו חותך תו עברי באמצע, ושחזור מחזיר את המקור', () => {
    const long = `SUMMARY:${'בדיקת מימד — לפני ישיבה ראשונה '.repeat(6)}`;
    const folded = foldIcsLine(long);
    expect(folded).toContain(`${CRLF} `);
    expect(unfold(folded)).toBe(long);
  });

  it('תווים מיוחדים בטקסט עוברים escape', () => {
    expect(escapeIcsText('א, ב; ג')).toBe(`א${BACKSLASH}, ב${BACKSLASH}; ג`);
    expect(escapeIcsText(`שורה${String.fromCharCode(10)}שנייה`)).toBe(`שורה${BACKSLASH}nשנייה`);
    expect(escapeIcsText(`a${BACKSLASH}b`)).toBe(`a${BACKSLASH}${BACKSLASH}b`);
  });
});
