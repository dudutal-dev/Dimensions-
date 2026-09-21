/** ספירה בעברית: "אירוע אחד" ולא "1 אירועים". */
export function countOf(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}
