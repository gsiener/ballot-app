---
title: Date Off-By-One from UTC Parsing of Date-Only Strings
date: 2026-02-08
category: ui-bugs
tags:
  - timezone
  - date-parsing
  - javascript
  - utc-vs-local
module: client
symptoms:
  - Selecting a date on the calendar shows the previous day
  - "Feb 14" selection displays as "Feb 13"
root_cause: "new Date('YYYY-MM-DD') parses as UTC midnight, which is the previous evening in US timezones"
severity: high
time_to_fix: 5 minutes
---

## Problem

Selecting a date on the attendance calendar (e.g., Sat Feb 14) created a poll displaying the previous day (Feb 13).

## Root Cause

Per the ECMAScript spec, `new Date("2026-02-14")` (date-only string) is parsed as **UTC midnight**. In US timezones (UTC-5 to UTC-8), that's the previous evening local time. So `toLocaleDateString()` renders Feb 13.

Adding a time component without `Z` suffix forces **local** time parsing:
- `new Date("2026-02-14")` → UTC midnight (bug)
- `new Date("2026-02-14T00:00:00")` → local midnight (correct)

## Solution

Append `'T00:00:00'` to date-only strings before passing to `new Date()`:

```diff
- const date = new Date(dateString)
+ const date = new Date(dateString + 'T00:00:00')
```

## Files Fixed

- `client/src/components/AttendanceDetail.tsx` — `formatDate()` line 69
- `client/src/pages/AttendanceListPage.tsx` — `formatDate()` line 33
- `client/src/components/AdminPanel.tsx` — `formatDate()` line 237

`AttendanceCalendar.tsx` line 28 already had the correct pattern.

## Prevention

Never use `new Date("YYYY-MM-DD")` directly. Always append `T00:00:00` for local time, or use `new Date(year, month - 1, day)` with split components.
