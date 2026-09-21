/** מזהה ייחודי לרשומה. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // דפדפנים ישנים / הקשר לא מאובטח
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** תאריך מקומי בצורת YYYY-MM-DD (לא UTC — "היום" הוא היום של המשתמש). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
