import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiResponse, Dashboard, Vote, Ballot, AdminBallot, Attendance, AttendanceResponse } from 'shared/dist'
import { countComments } from 'shared/dist'
import { initTelemetry, createSpan, addSpanAttributes, recordSpanEvent, setSpanStatus } from './telemetry'
import {
  withSpan,
  createListHandler,
  createGetByIdHandler,
  createDeleteHandler,
  createCreateHandler,
  createUpdateHandler,
  createBatchHandler,
  type ResourceConfig
} from './handlers'
import { kvCollection } from './kv'

type Bindings = {
  BALLOTS_KV: KVNamespace
  ADMIN_API_KEY?: string
}

type Variables = {}

type HonoEnv = {
  Bindings: Bindings
  Variables: Variables
}

const app = new Hono<HonoEnv>()

// Input validation constants
const MAX_QUESTION_LENGTH = 500
const MAX_DASHBOARD_NAME_LENGTH = 100
const MAX_ATTENDANCE_TITLE_LENGTH = 200
const MAX_COMMENT_LENGTH = 1000
const MAX_NAME_LENGTH = 100

// Shared validator for the recurring "required non-empty string, capped length"
// shape used across resource routes.
function requireString(value: unknown, label: string, maxLength: number): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return { valid: false, error: `${label} is required` }
  }
  if (value.trim().length > maxLength) {
    return { valid: false, error: `${label} must be ${maxLength} characters or less` }
  }
  return { valid: true }
}

app.use(cors())

// Middleware to initialize telemetry for each request
app.use('*', async (c, next) => {
  if ((c.env as any)?.HONEYCOMB_API_KEY) {
    initTelemetry(c.env)
  }
  await next()
})

// Demo data for initial setup (only used if no data exists in KV)
const demoData: Ballot[] = [
  {
    id: 'demo-1',
    question: 'Should we implement dark mode for the application?',
    votes: [
      { color: 'green', comment: 'Yes, dark mode is essential for user experience!', createdAt: '2024-01-01T10:00:00Z' },
      { color: 'green', createdAt: '2024-01-01T11:00:00Z' },
      { color: 'yellow', comment: 'Maybe, but not a priority right now', createdAt: '2024-01-01T12:00:00Z' },
      { color: 'red', comment: 'No, focus on core features first', createdAt: '2024-01-01T13:00:00Z' }
    ],
    createdAt: '2024-01-01T09:00:00Z'
  },
  {
    id: 'demo-2',
    question: 'What do you think about the new UI design?',
    votes: [
      { color: 'green', comment: 'Love the clean, modern look!', createdAt: '2024-01-02T10:00:00Z' },
      { color: 'green', createdAt: '2024-01-02T11:00:00Z' },
      { color: 'yellow', createdAt: '2024-01-02T12:00:00Z' }
    ],
    createdAt: '2024-01-02T09:00:00Z'
  }
]

// KV-backed stores. One deep module (kvCollection) owns the read/parse/
// fallback and serialize/save logic; each resource is just a key plus a
// fallback. Ballots seed demo data on first access; the others start empty.
const ballotStore = kvCollection<Ballot>('ballots', { fallback: () => demoData, seedOnEmpty: true })
const dashboardStore = kvCollection<Dashboard>('dashboards')
const attendanceStore = kvCollection<Attendance>('attendances')

// Resource configurations — a config is just a name plus its store's methods.
const ballotConfig: ResourceConfig<Ballot> = { name: 'ballot', ...ballotStore }
const dashboardConfig: ResourceConfig<Dashboard> = { name: 'dashboard', ...dashboardStore }
const attendanceConfig: ResourceConfig<Attendance> = { name: 'attendance', ...attendanceStore }

// Admin authentication middleware
const adminAuth = async (c: any, next: any) => {
  const span = createSpan('admin_auth')

  try {
    const authHeader = c.req.header('Authorization')
    const adminKey = c.env.ADMIN_API_KEY

    if (!adminKey) {
      addSpanAttributes({ 'auth.error': 'no_admin_key_configured', 'auth.success': false })
      setSpanStatus(span, false, 'Admin key not configured')
      return c.json({ error: 'Admin functionality not available' }, 500)
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      addSpanAttributes({ 'auth.error': 'missing_bearer_token', 'auth.success': false })
      setSpanStatus(span, false, 'Missing authorization header')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.substring(7)

    if (token !== adminKey) {
      addSpanAttributes({ 'auth.error': 'invalid_token', 'auth.success': false })
      setSpanStatus(span, false, 'Invalid admin token')
      recordSpanEvent('admin_auth_failed', { 'auth.attempt': 'invalid_token' })
      return c.json({ error: 'Unauthorized' }, 401)
    }

    addSpanAttributes({ 'auth.success': true, 'auth.type': 'admin' })
    recordSpanEvent('admin_auth_success', { 'auth.method': 'bearer_token' })
    setSpanStatus(span, true)

    await next()
  } catch (error) {
    setSpanStatus(span, false, `Admin auth error: ${error}`)
    return c.json({ error: 'Authentication error' }, 500)
  } finally {
    span.end()
  }
}

// Basic routes
app.get('/', (c) => c.text('Ballot App API - Visit /api/ballots to see all ballots'))

app.get('/hello', async (c) => {
  const data: ApiResponse = { message: "Hello BHVR!", success: true }
  return c.json(data, { status: 200 })
})

// Ballot routes
app.get('/api/ballots', createListHandler(ballotConfig, {
  filter: (ballot) => !ballot.isPrivate,
  sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}))

// Get multiple ballots by IDs (batch endpoint to avoid N+1 queries)
app.get('/api/ballots/batch', createBatchHandler(ballotConfig))

app.get('/api/ballots/:id', createGetByIdHandler(ballotConfig, {
  includeAttributes: (ballot) => ({ 'ballot.vote_count': ballot.votes.length })
}))

app.post('/api/ballots', createCreateHandler<Ballot, { question: string; isPrivate?: boolean }>(
  ballotConfig,
  {
    validate: (body) => {
      if (!body.question || typeof body.question !== 'string') {
        return { valid: false, error: 'Question is required' }
      }
      if (body.question.trim().length > MAX_QUESTION_LENGTH) {
        return { valid: false, error: `Question must be ${MAX_QUESTION_LENGTH} characters or less` }
      }
      return { valid: true }
    },
    buildItem: (body) => ({
      id: `ballot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      question: body.question.trim(),
      votes: [],
      createdAt: new Date().toISOString(),
      isPrivate: body.isPrivate === true
    }),
    includeAttributes: (ballot) => ({
      'ballot.question_length': ballot.question.length,
      'ballot.is_private': !!ballot.isPrivate
    })
  }
))

// Ballot update (add vote). The client sends the full ballot; the factory owns
// find / 404 / opt-in version-conflict / save. Only the comment-length check
// and vote-delta telemetry are ballot-specific.
app.put('/api/ballots/:id', createUpdateHandler(ballotConfig, {
  validate: (body) => {
    if (Array.isArray(body.votes)) {
      for (const vote of body.votes) {
        if (vote.comment && vote.comment.length > MAX_COMMENT_LENGTH) {
          return { valid: false, error: `Comment must be ${MAX_COMMENT_LENGTH} characters or less` }
        }
      }
    }
    return { valid: true }
  },
  applyUpdates: (current, body) => ({ ...current, ...body }),
  includeAttributes: (updated, original) => ({
    'vote.original_count': original.votes.length,
    'vote.new_count': updated.votes.length,
    'vote.votes_added': updated.votes.length - original.votes.length
  })
}))

// Admin routes
app.get('/api/admin/ballots', adminAuth, createListHandler(ballotConfig, {
  sort: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  transform: (ballots) => ballots.map((ballot): AdminBallot => ({
    ...ballot,
    voteCount: ballot.votes.length,
    commentCount: countComments(ballot),
    lastVote: ballot.votes.length > 0 ? ballot.votes[ballot.votes.length - 1]!.createdAt : null
  }))
}))

app.delete('/api/admin/ballots/:id', adminAuth, createDeleteHandler(ballotConfig, {
  buildResponse: (deleted) => ({
    message: 'Ballot deleted successfully',
    deletedBallot: {
      id: deleted.id,
      question: deleted.question,
      voteCount: deleted.votes.length
    }
  })
}))

// Admin: toggle privacy (metadata-only; no version tracking).
app.patch('/api/admin/ballots/:id', adminAuth, createUpdateHandler(ballotConfig, {
  skipVersionCheck: true,
  applyUpdates: (current, body) => ({ ...current, isPrivate: body.isPrivate })
}))

app.post('/api/admin/ballots/migrate', adminAuth, async (c) => {
  return withSpan('admin_migrate_ballots', async (span) => {
    const { ballots: incomingBallots } = await c.req.json()

    addSpanAttributes({
      'operation': 'admin_migrate_ballots',
      'admin.action': 'migrate_ballots',
      'ballots.incoming_count': incomingBallots?.length || 0
    })

    if (!Array.isArray(incomingBallots)) {
      addSpanAttributes({ 'validation.failed': true, 'error': 'Invalid ballots format' })
      setSpanStatus(span, false, 'Invalid ballots format')
      return c.json({ error: 'Ballots must be an array' }, 400)
    }

    const existingBallots = await ballotStore.getAll(c.env.BALLOTS_KV)
    const existingIds = new Set(existingBallots.map(b => b.id))
    const newBallots = incomingBallots.filter((b: Ballot) => !existingIds.has(b.id))
    const mergedBallots = [...existingBallots, ...newBallots]

    await ballotStore.saveAll(c.env.BALLOTS_KV, mergedBallots)

    addSpanAttributes({
      'ballots.existing_count': existingBallots.length,
      'ballots.new_count': newBallots.length,
      'ballots.total_count': mergedBallots.length,
      'ballots.duplicates_skipped': incomingBallots.length - newBallots.length
    })

    recordSpanEvent('admin_ballots_migrated', {
      'ballots.migrated': newBallots.length,
      'ballots.total': mergedBallots.length,
      'admin.user': 'authenticated'
    })

    return c.json({
      message: 'Migration successful',
      existingCount: existingBallots.length,
      migratedCount: newBallots.length,
      duplicatesSkipped: incomingBallots.length - newBallots.length,
      totalCount: mergedBallots.length
    })
  })
})

// Dashboard routes
app.get('/api/dashboards', createListHandler(dashboardConfig, {
  sort: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}))

app.get('/api/dashboards/:id', createGetByIdHandler(dashboardConfig, {
  includeAttributes: (dashboard) => ({ 'dashboard.ballot_count': dashboard.ballotIds.length })
}))

app.post('/api/dashboards', createCreateHandler<Dashboard, { name: string }>(
  dashboardConfig,
  {
    validate: (body) => requireString(body.name, 'Dashboard name', MAX_DASHBOARD_NAME_LENGTH),
    buildItem: (body) => ({
      id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: body.name.trim(),
      ballotIds: [],
      attendanceIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    includeAttributes: (dashboard) => ({ 'dashboard.name_length': dashboard.name.length })
  }
))

app.put('/api/dashboards/:id', createUpdateHandler(dashboardConfig, {
  applyUpdates: (current, body) => ({
    ...current,
    name: body.name !== undefined && typeof body.name === 'string' ? body.name.trim() : current.name,
    ballotIds: Array.isArray(body.ballotIds) ? body.ballotIds : current.ballotIds,
    attendanceIds: Array.isArray(body.attendanceIds) ? body.attendanceIds : (current.attendanceIds || []),
    updatedAt: new Date().toISOString()
  }),
  includeAttributes: (updated) => ({
    'dashboard.ballot_count': updated.ballotIds.length,
    'dashboard.attendance_count': (updated.attendanceIds || []).length
  })
}))

app.delete('/api/dashboards/:id', createDeleteHandler(dashboardConfig, {
  buildResponse: (deleted) => ({
    message: 'Dashboard deleted successfully',
    deletedDashboard: {
      id: deleted.id,
      name: deleted.name,
      ballotCount: deleted.ballotIds.length
    }
  })
}))

// Attendance endpoints

// Get multiple attendances by IDs (batch endpoint to avoid N+1 queries)
app.get('/api/attendance/batch', createBatchHandler(attendanceConfig))

app.get('/api/attendance', createListHandler(attendanceConfig, {
  sort: (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
}))

app.get('/api/attendance/:id', createGetByIdHandler(attendanceConfig, {
  includeAttributes: (attendance) => ({ 'attendance.response_count': attendance.responses.length })
}))

app.post('/api/attendance', createCreateHandler<Attendance, { title: string; date: string }>(
  attendanceConfig,
  {
    validate: (body) => {
      const title = requireString(body.title, 'Title', MAX_ATTENDANCE_TITLE_LENGTH)
      if (!title.valid) return title
      if (!body.date || typeof body.date !== 'string') {
        return { valid: false, error: 'Date is required' }
      }
      return { valid: true }
    },
    buildItem: (body) => ({
      id: `attendance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: body.title.trim(),
      date: body.date,
      responses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    includeAttributes: (attendance) => ({ 'attendance.title_length': attendance.title.length })
  }
))

// Add or update a response. Optimistic locking is opt-in via `version`; the
// factory owns find / 404 / version-conflict / save, so only the responder
// merge (case-insensitive) lives here.
app.put('/api/attendance/:id', createUpdateHandler(attendanceConfig, {
  validate: (body) => {
    const name = requireString(body.name, 'Name', MAX_NAME_LENGTH)
    if (!name.valid) return name
    if (typeof body.attending !== 'boolean') {
      return { valid: false, error: 'Attending must be true or false' }
    }
    return { valid: true }
  },
  applyUpdates: (current, body) => {
    const trimmedName = body.name.trim()
    const responses = [...current.responses]
    const existingIndex = responses.findIndex(
      r => r.name.toLowerCase() === trimmedName.toLowerCase()
    )
    const newResponse: AttendanceResponse = {
      name: trimmedName,
      attending: body.attending,
      timestamp: new Date().toISOString()
    }
    if (existingIndex !== -1) {
      responses[existingIndex] = newResponse
    } else {
      responses.push(newResponse)
    }
    return { ...current, responses, updatedAt: new Date().toISOString() }
  },
  includeAttributes: (attendance) => ({ 'attendance.response_count': attendance.responses.length })
}))

// Admin: rename an attendance (title only; no version tracking needed).
app.patch('/api/attendance/:id', adminAuth, createUpdateHandler(attendanceConfig, {
  skipVersionCheck: true,
  validate: (body) => requireString(body.title, 'Title', MAX_ATTENDANCE_TITLE_LENGTH),
  applyUpdates: (current, body) => ({
    ...current,
    title: body.title.trim(),
    updatedAt: new Date().toISOString()
  }),
  includeAttributes: (attendance) => ({ 'attendance.new_title': attendance.title })
}))

// Admin: delete an attendance.
app.delete('/api/attendance/:id', adminAuth, createDeleteHandler(attendanceConfig, {
  buildResponse: (deleted) => ({
    message: 'Attendance deleted successfully',
    deletedAttendance: {
      id: deleted.id,
      title: deleted.title,
      responseCount: deleted.responses.length
    }
  })
}))

export { app }

export default {
  fetch: app.fetch,
}
