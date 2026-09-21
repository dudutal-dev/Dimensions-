/** מחבר שמות מחלקות, מדלג על ערכים ריקים. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
