// Pure helpers for the admin quote inbox (/admin/quotes/) and the nav badge.
// No Supabase or astro:* imports, so tests/quote-admin.test.ts can load it.

export type QuoteStatus = 'new' | 'contacted' | 'done';
export type QuoteTab = QuoteStatus | 'all';

export const QUOTE_BUCKET = 'quote-refs';
/** Signed photo URLs live for 60 minutes. */
export const SIGNED_URL_TTL = 3600;

/**
 * Window event the inbox fires whenever its rows change. `detail.newCount`
 * (when present) is the up-to-date number of `new` requests; without it the
 * admin shell re-queries the count itself.
 */
export const QUOTES_CHANGED_EVENT = 'admin:quotes-changed';
export type QuotesChangedDetail = { newCount?: number };

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  done: 'Done',
};
export const TABS: QuoteTab[] = ['new', 'contacted', 'done', 'all'];
const STATUS_ORDER: QuoteStatus[] = ['new', 'contacted', 'done'];

export const CONTACT_TIME_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  any: 'Any time',
};

export function nextStatus(s: QuoteStatus): QuoteStatus | null {
  return STATUS_ORDER[STATUS_ORDER.indexOf(s) + 1] ?? null;
}

export function prevStatus(s: QuoteStatus): QuoteStatus | null {
  const i = STATUS_ORDER.indexOf(s);
  return i > 0 ? STATUS_ORDER[i - 1] : null;
}

export function countByTab(rows: { status: QuoteStatus }[]): Record<QuoteTab, number> {
  const counts: Record<QuoteTab, number> = { new: 0, contacted: 0, done: 0, all: rows.length };
  for (const r of rows) if (r.status in counts) counts[r.status] += 1;
  return counts;
}

/** Digits only; a bare 10-digit Indian number (or 0-prefixed 11 digits) gets the 91 country code. */
export function waPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(phone: string, name: string, dressName: string): string {
  const text = `Hi ${name}, this is Sri Krishna Designers about your quote for ${dressName}`;
  return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return `tel:${plus}${trimmed.replace(/\D/g, '')}`;
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.345],
  ['month', 12],
  ['year', Infinity],
];

/** "2 hours ago", "yesterday", "just now". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  let value = (then - now) / 1000;
  if (Math.abs(value) < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return '';
}

const IST = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** Absolute time in Asia/Kolkata, e.g. "5 Nov 2026, 3:04 pm IST". */
export function istDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${IST.format(d)} IST`;
}

const DAY = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** A `date` column (YYYY-MM-DD) as "Sat, 12 Dec 2026", without any timezone shift. */
export function occasionDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : DAY.format(d);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
