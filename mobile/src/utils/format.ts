/**
 * Display formatting.
 *
 * Timestamps arrive from the API as ISO strings with an explicit offset. We
 * render them in that offset — a Dubai departure should read 16:35 whatever the
 * phone's timezone is.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');

export function offsetOf(iso: string): number {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(iso);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

export function parts(iso: string) {
  const offset = offsetOf(iso);
  const d = new Date(Date.parse(iso) + offset * 60_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    date: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

/** "16:35" in the instant's own zone. */
export function clock(iso: string): string {
  const p = parts(iso);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "2 Jun" */
export function shortDate(iso: string): string {
  const p = parts(iso);
  return `${p.date} ${MONTHS[p.month - 1]}`;
}

/** "Tue 2 Jun" */
export function dayDate(iso: string): string {
  const p = parts(iso);
  return `${WEEKDAYS[p.weekday]} ${p.date} ${MONTHS[p.month - 1]}`;
}

/** "Tue 2 Jun · 16:35" */
export function when(iso: string): string {
  return `${dayDate(iso)} · ${clock(iso)}`;
}

export function durationLabel(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000);
}

/** ₹1,49,800 — Indian digit grouping. */
export function inr(amount: number, options?: { sign?: boolean }): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const grouped = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const prefix = rounded < 0 ? '−' : options?.sign && rounded > 0 ? '+' : '';
  return `${prefix}₹${grouped}`;
}

/** "12,360" without the symbol, for tight metric rows. */
export function inrCompact(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `₹${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `₹${abs}`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function statusLabel(status: string): string {
  return titleCase(status.replace(/_/g, ' '));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
