# Domain & Architecture Context

Shared vocabulary for the Ballot App. Domain terms name concepts in the
product; architecture terms (module, interface, seam, adapter, depth) follow the
deep-module design language. Keep test names and interfaces aligned with these.

## Domain language

- **Ballot** — a question with a list of color-coded **Votes** (green/yellow/red),
  each optionally carrying a comment.
- **Vote** — one response to a ballot: a `VoteColor` plus an optional comment and
  a timestamp.
- **Dashboard** — a named collection referencing ballots and attendances by id.
- **Attendance** — a meeting on a **meeting date** with a list of
  **Attendance Responses** (a name + attending yes/no + timestamp). One person
  (matched case-insensitively by name) has at most one response per attendance.
- **Meeting date** — an attendance's `date`: a bare `YYYY-MM-DD` calendar day
  with **no timezone**. It is not an instant. Rendering it as a local/UTC instant
  is the off-by-one bug that recurred twice; the `meetingDate` module owns the
  rule (see below).

## Deep modules (the seams worth knowing)

- **`shared/src/dates.ts` — the meeting-date module.** `parseMeetingDate`,
  `formatMeetingDate(dateStr, style)`, `toMeetingDateString(date)`. Owns the
  "a meeting date is a timezone-free calendar day" rule: parse anchored at UTC
  midnight, format in UTC. Three display styles: `full`, `long`, `compact`.
  The single home for meeting-date logic across client and edge.

- **`shared/src/counting.ts` — vote/attendance counting.** `countVotes`,
  `countAllVotes`, `countComments`, `countAttendanceResponses`. Lives in
  `shared/` so the client, server, and edge function count the same way — this
  is the seam that actually crosses the client/server divide.

- **`server/src/kv.ts` — `kvCollection`.** One deep module over the KV
  read/parse/fallback + serialize/save pattern. The `KVNamespace` is the port;
  an in-memory map is the test adapter. A resource is just a key plus a fallback.

- **`server/src/handlers.ts` — the resource handler factory.** CRUD + opt-in
  optimistic locking + telemetry behind a small `ResourceConfig`. Ballots,
  dashboards, and attendances all route through it. Optimistic locking is
  **opt-in**: the version check fires only when the client sends a `version`, so
  clients that don't track versions never hit false 409s.

- **`client/src/api/client.ts` — `createApiClient(fetch, baseUrl)`.** The one
  place network access lives. Accepts an injected `fetch` (real in prod, fake in
  tests); the default instances (`ballotApi`, `attendanceApi`, …) are built from
  it. Callers never reach for raw `fetch` or re-declare the base URL.

## Notes / caveats

- The edge Pages Function (`functions/attendance/[id].ts`) imports from
  `shared/dist`. This resolves locally via the workspace symlink; confirm it
  still bundles correctly on a Cloudflare Pages deploy (smoke-test the unfurl).
