/** תוצאה מטיפוס — במקום throw לשגיאות צפויות (קובץ גיבוי לא תקין וכדומה). */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });
