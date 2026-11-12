/** Calendar dates as local YYYY-MM-DD strings, and times as HH:MM. */

export const iso = (d: Date) => d.toLocaleDateString("en-CA");
export const parse = (day: string) => new Date(`${day}T00:00`);
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week of `d`. */
export const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The days shown for a month: whole weeks, Monday first. */
export function monthDays(year: number, month: number): Date[] {
  const first = weekStart(new Date(year, month, 1));
  const count = Math.ceil(((new Date(year, month, 1).getDay() + 6) % 7 + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}
