/**
 * Meeting dates.
 *
 * An attendance `date` is a bare `YYYY-MM-DD` string — a calendar day with no
 * timezone. Parsing it with `new Date("2024-01-15")` treats it as UTC midnight,
 * which renders as the *previous* day in negative-offset zones (the off-by-one
 * that has been fixed twice in this repo). This module owns the rule so callers
 * never touch it: anchor at UTC midnight, and always format in UTC.
 */

export type MeetingDateStyle = 'full' | 'long' | 'compact'

const STYLE_OPTIONS: Record<MeetingDateStyle, Intl.DateTimeFormatOptions> = {
  full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' },
  long: { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' },
  compact: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Parse a `YYYY-MM-DD` string into a Date anchored at UTC midnight of that
 * calendar day, independent of the host timezone.
 */
export function parseMeetingDate(dateStr: string): Date {
  const match = DATE_ONLY.exec(dateStr)
  if (!match) {
    // Unexpected format (e.g. a full timestamp) — fall back to native parsing.
    return new Date(dateStr)
  }
  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

/**
 * Format a `YYYY-MM-DD` string as a human-readable label. Formats in UTC so the
 * rendered day matches the stored day everywhere (browser and edge runtime).
 */
export function formatMeetingDate(dateStr: string, style: MeetingDateStyle = 'full'): string {
  return parseMeetingDate(dateStr).toLocaleDateString('en-US', STYLE_OPTIONS[style])
}

/**
 * Inverse of {@link parseMeetingDate}: format a Date's *local* calendar day as
 * a `YYYY-MM-DD` string. Used when a calendar UI produces a locally-picked day.
 */
export function toMeetingDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
