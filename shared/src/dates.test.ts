import { describe, test, expect } from 'bun:test'
import { parseMeetingDate, formatMeetingDate, toMeetingDateString } from './dates'

// Source of truth: 2024-01-15 is a Monday (independently known).
// A date-only string denotes a calendar day with no timezone; parsing and
// formatting must render that literal day regardless of the host timezone.

describe('parseMeetingDate', () => {
  test('anchors a YYYY-MM-DD string at UTC midnight (no off-by-one)', () => {
    const d = parseMeetingDate('2024-01-15')
    expect(d.getUTCFullYear()).toBe(2024)
    expect(d.getUTCMonth()).toBe(0) // January
    expect(d.getUTCDate()).toBe(15) // NOT the 14th
  })

  test('ignores any time/zone suffix and keeps the calendar day', () => {
    const d = parseMeetingDate('2024-12-31')
    expect(d.getUTCFullYear()).toBe(2024)
    expect(d.getUTCMonth()).toBe(11)
    expect(d.getUTCDate()).toBe(31)
  })
})

describe('formatMeetingDate', () => {
  test('full style includes the weekday, long month, and year', () => {
    expect(formatMeetingDate('2024-01-15', 'full')).toBe('Monday, January 15, 2024')
  })

  test('long style drops the weekday', () => {
    expect(formatMeetingDate('2024-01-15', 'long')).toBe('January 15, 2024')
  })

  test('compact style abbreviates weekday and month', () => {
    expect(formatMeetingDate('2024-01-15', 'compact')).toBe('Mon, Jan 15, 2024')
  })

  test('defaults to full style', () => {
    expect(formatMeetingDate('2024-01-15')).toBe('Monday, January 15, 2024')
  })

  test('renders the stored calendar day, not the day before', () => {
    // The bug these sites hit: new Date("2024-03-01").toLocaleDateString()
    // renders Feb 29 in negative-offset zones. The module must not.
    expect(formatMeetingDate('2024-03-01', 'long')).toBe('March 1, 2024')
  })
})

describe('toMeetingDateString', () => {
  test('formats a Date to its local YYYY-MM-DD calendar day', () => {
    // A calendar UI picks a local day; storing it must preserve that day.
    const picked = new Date(2024, 0, 15) // local midnight, Jan 15
    expect(toMeetingDateString(picked)).toBe('2024-01-15')
  })

  test('zero-pads month and day', () => {
    const picked = new Date(2024, 2, 5) // March 5
    expect(toMeetingDateString(picked)).toBe('2024-03-05')
  })
})
