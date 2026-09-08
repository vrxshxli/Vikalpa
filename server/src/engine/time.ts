/**
 * Instant helpers.
 *
 * Every timestamp in VIKALPA is an ISO string carrying an explicit UTC offset,
 * so `Date.parse` gives an unambiguous epoch. Wall-clock questions ("what hour
 * is it *there*?") are answered by re-projecting the epoch through the node's
 * own tz offset rather than the server's locale.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function ms(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`Unparseable instant: ${iso}`);
  return t;
}

/** Offset in minutes baked into an ISO string ("+05:30" → 330, "Z" → 0). */
export function offsetOf(iso: string): number {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(iso);
  if (!m) return /Z$/.test(iso) ? 0 : 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

function pad(n: number): string {
  return String(Math.abs(n)).padStart(2, '0');
}

function offsetSuffix(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  return `${sign}${pad(Math.trunc(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`;
}

/** Render an epoch as an ISO string in the given UTC offset. */
export function toIso(epoch: number, offsetMinutes: number): string {
  const shifted = new Date(epoch + offsetMinutes * MINUTE);
  const y = shifted.getUTCFullYear();
  const mo = pad(shifted.getUTCMonth() + 1);
  const d = pad(shifted.getUTCDate());
  const h = pad(shifted.getUTCHours());
  const mi = pad(shifted.getUTCMinutes());
  return `${y}-${mo}-${d}T${h}:${mi}:00${offsetSuffix(offsetMinutes)}`;
}

/** Shift an instant, keeping its original offset. */
export function shiftIso(iso: string, minutes: number): string {
  return toIso(ms(iso) + minutes * MINUTE, offsetOf(iso));
}

/** Local wall-clock parts as seen at the instant's own offset. */
export function local(iso: string): {
  year: number;
  month: number;
  date: number;
  hour: number;
  minute: number;
  weekday: number;
  dateKey: string;
  minutesOfDay: number;
} {
  const off = offsetOf(iso);
  const d = new Date(ms(iso) + off * MINUTE);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    date: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    dateKey: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** Replace the wall-clock time of `iso` with "HH:mm", keeping its date + offset. */
export function withClock(iso: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const l = local(iso);
  const off = offsetOf(iso);
  const base = Date.UTC(l.year, l.month - 1, l.date, h, m, 0);
  return toIso(base - off * MINUTE, off);
}

/** Same wall-clock time, `days` later, at the same offset. */
export function addDays(iso: string, days: number): string {
  return shiftIso(iso, days * 24 * 60);
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((ms(endIso) - ms(startIso)) / MINUTE);
}

export function gapMinutes(earlierEndIso: string, laterStartIso: string): number {
  return Math.round((ms(laterStartIso) - ms(earlierEndIso)) / MINUTE);
}

/** "HH:mm" in the instant's own zone. */
export function clock(iso: string): string {
  const l = local(iso);
  return `${pad(l.hour)}:${pad(l.minute)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon 1 Jun · 08:15" */
export function pretty(iso: string): string {
  const l = local(iso);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][l.weekday];
  return `${wd} ${l.date} ${MONTHS[l.month - 1]} · ${clock(iso)}`;
}

/** "1 Jun" */
export function prettyDate(iso: string): string {
  const l = local(iso);
  return `${l.date} ${MONTHS[l.month - 1]}`;
}

/** 1-indexed trip day for an instant, relative to a YYYY-MM-DD trip start. */
export function dayIndex(iso: string, tripStartDate: string): number {
  const [y, m, d] = tripStartDate.split('-').map(Number);
  const startUtc = Date.UTC(y, m - 1, d);
  const l = local(iso);
  const nodeUtc = Date.UTC(l.year, l.month - 1, l.date);
  return Math.round((nodeUtc - startUtc) / DAY) + 1;
}

/** Minutes past midnight considered "late night" for safety constraints. */
export function isLateNight(iso: string): boolean {
  const h = local(iso).hour;
  return h >= 23 || h < 5;
}
