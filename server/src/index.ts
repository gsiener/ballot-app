import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiResponse, Dashboard, Vote, Ballot, AdminBallot, Attendance, AttendanceResponse } from 'shared/dist'
import { initTelemetry, createSpan, addSpanAttributes, recordSpanEvent, setSpanStatus } from './telemetry'
import {
  withSpan,
  createListHandler,
  createGetByIdHandler,
  createDeleteHandler,
  createCreateHandler,
  createUpdateHandler,
  type ResourceConfig
} from './handlers'

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

// KV Storage helpers
async function getAllBallots(kv: KVNamespace): Promise<Ballot[]> {
  try {
    const ballotsJson = await kv.get('ballots')
    if (ballotsJson) {
      return JSON.parse(ballotsJson)
    } else {
      await kv.put('ballots', JSON.stringify(demoData))
      return demoData
    }
  } catch (error) {
    console.error('Error getting ballots from KV:', error)
    return demoData
  }
}

async function saveBallots(kv: KVNamespace, ballots: Ballot[]): Promise<void> {
  try {
    await kv.put('ballots', JSON.stringify(ballots))
  } catch (error) {
    console.error('Error saving ballots to KV:', error)
    throw error
  }
}

async function getAllDashboards(kv: KVNamespace): Promise<Dashboard[]> {
  try {
    const dashboardsJson = await kv.get('dashboards')
    if (dashboardsJson) {
      return JSON.parse(dashboardsJson)
    }
    return []
  } catch (error) {
    console.error('Error getting dashboards from KV:', error)
    return []
  }
}

async function saveDashboards(kv: KVNamespace, dashboards: Dashboard[]): Promise<void> {
  try {
    await kv.put('dashboards', JSON.stringify(dashboards))
  } catch (error) {
    console.error('Error saving dashboards to KV:', error)
    throw error
  }
}

async function getAllAttendances(kv: KVNamespace): Promise<Attendance[]> {
  try {
    const attendancesJson = await kv.get('attendances')
    if (attendancesJson) {
      return JSON.parse(attendancesJson)
    }
    return []
  } catch (error) {
    console.error('Error getting attendances from KV:', error)
    return []
  }
}

async function saveAttendances(kv: KVNamespace, attendances: Attendance[]): Promise<void> {
  try {
    await kv.put('attendances', JSON.stringify(attendances))
  } catch (error) {
    console.error('Error saving attendances to KV:', error)
    throw error
  }
}

// Resource configurations
const ballotConfig: ResourceConfig<Ballot> = {
  name: 'ballot',
  getAll: getAllBallots,
  saveAll: saveBallots
}

const dashboardConfig: ResourceConfig<Dashboard> = {
  name: 'dashboard',
  getAll: getAllDashboards,
  saveAll: saveDashboards
}

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
app.get('/api/ballots/batch', async (c) => {
  const span = createSpan('get_ballots_batch')

  try {
    const idsParam = c.req.query('ids')

    if (!idsParam) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'No IDs provided'
      })
      setSpanStatus(span, false, 'IDs query parameter is required')
      return c.json({ error: 'IDs query parameter is required (e.g., ?ids=id1,id2,id3)' }, 400)
    }

    const ids = idsParam.split(',').map(id => id.trim()).filter(id => id)

    if (ids.length === 0) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'No valid IDs provided'
      })
      setSpanStatus(span, false, 'No valid IDs provided')
      return c.json({ error: 'No valid IDs provided' }, 400)
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 100
    if (ids.length > MAX_BATCH_SIZE) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Too many IDs requested'
      })
      setSpanStatus(span, false, `Maximum ${MAX_BATCH_SIZE} IDs allowed per request`)
      return c.json({ error: `Maximum ${MAX_BATCH_SIZE} IDs allowed per request` }, 400)
    }

    addSpanAttributes({
      'operation': 'get_ballots_batch',
      'ballot.requested_count': ids.length
    })

    const allBallots = await getAllBallots(c.env.BALLOTS_KV)
    const requestedBallots = ids
      .map(id => allBallots.find(b => b.id === id))
      .filter((b): b is Ballot => b !== undefined)

    addSpanAttributes({
      'ballot.found_count': requestedBallots.length,
      'ballot.missing_count': ids.length - requestedBallots.length
    })

    recordSpanEvent('ballots_batch_retrieved', {
      'ballot.requested_count': ids.length,
      'ballot.found_count': requestedBallots.length
    })

    setSpanStatus(span, true)
    return c.json(requestedBallots)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

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

// Ballot update (add vote) - custom handler due to vote tracking logic
app.put('/api/ballots/:id', async (c) => {
  const id = c.req.param('id')

  return withSpan('update_ballot', async (span) => {
    const updatedBallot = await c.req.json()

    addSpanAttributes({
      'ballot.id': id,
      'operation': 'update_ballot'
    })

    // Validate comment lengths in votes
    if (updatedBallot.votes && Array.isArray(updatedBallot.votes)) {
      for (const vote of updatedBallot.votes) {
        if (vote.comment && vote.comment.length > MAX_COMMENT_LENGTH) {
          addSpanAttributes({
            'validation.failed': true,
            'error': 'Comment too long'
          })
          recordSpanEvent('validation_failed', { 'reason': 'comment_too_long' })
          setSpanStatus(span, false, `Comment must be ${MAX_COMMENT_LENGTH} characters or less`)
          return c.json({ error: `Comment must be ${MAX_COMMENT_LENGTH} characters or less` }, 400)
        }
      }
    }

    const ballots = await getAllBallots(c.env.BALLOTS_KV)
    const ballotIndex = ballots.findIndex(b => b.id === id)

    if (ballotIndex === -1) {
      addSpanAttributes({ 'ballot.found': false })
      recordSpanEvent('ballot_not_found', { 'ballot.id': id })
      setSpanStatus(span, false, 'Ballot not found')
      return c.json({ error: 'Ballot not found' }, 404)
    }

    const originalVoteCount = ballots[ballotIndex]?.votes.length || 0
    const newVoteCount = updatedBallot.votes.length
    const votesAdded = newVoteCount - originalVoteCount

    ballots[ballotIndex] = updatedBallot
    await saveBallots(c.env.BALLOTS_KV, ballots)

    addSpanAttributes({
      'ballot.found': true,
      'vote.original_count': originalVoteCount,
      'vote.new_count': newVoteCount,
      'vote.votes_added': votesAdded
    })

    recordSpanEvent('ballot_updated', {
      'ballot.id': id,
      'votes.added': votesAdded,
      'votes.total': newVoteCount
    })

    return c.json(ballots[ballotIndex])
  })
})

// Admin routes
app.get('/api/admin/ballots', adminAuth, async (c) => {
  return withSpan('admin_get_all_ballots', async (span) => {
    const ballots = await getAllBallots(c.env.BALLOTS_KV)

    const sortedBallots = ballots.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    const adminBallots: AdminBallot[] = sortedBallots.map(ballot => ({
      ...ballot,
      voteCount: ballot.votes.length,
      commentCount: ballot.votes.filter(v => v.comment && v.comment.trim() !== '').length,
      lastVote: ballot.votes.length > 0 ? ballot.votes[ballot.votes.length - 1]!.createdAt : null
    }))

    addSpanAttributes({
      'ballot.count': ballots.length,
      'operation': 'admin_get_all_ballots',
      'admin.action': 'list_ballots'
    })

    recordSpanEvent('admin_ballots_accessed', {
      'ballots.count': ballots.length,
      'admin.user': 'authenticated'
    })

    return c.json(adminBallots)
  })
})

app.delete('/api/admin/ballots/:id', adminAuth, async (c) => {
  const id = c.req.param('id')

  return withSpan('admin_delete_ballot', async (span) => {
    addSpanAttributes({
      'ballot.id': id,
      'operation': 'admin_delete_ballot',
      'admin.action': 'delete_ballot'
    })

    const ballots = await getAllBallots(c.env.BALLOTS_KV)
    const ballotIndex = ballots.findIndex(b => b.id === id)

    if (ballotIndex === -1) {
      addSpanAttributes({ 'ballot.found': false })
      recordSpanEvent('admin_delete_failed', { 'ballot.id': id, 'error': 'ballot_not_found' })
      setSpanStatus(span, false, 'Ballot not found')
      return c.json({ error: 'Ballot not found' }, 404)
    }

    const deletedBallot = ballots[ballotIndex]!
    ballots.splice(ballotIndex, 1)
    await saveBallots(c.env.BALLOTS_KV, ballots)

    addSpanAttributes({
      'ballot.found': true,
      'ballot.question': deletedBallot.question,
      'ballot.vote_count': deletedBallot.votes.length
    })

    recordSpanEvent('admin_ballot_deleted', {
      'ballot.id': id,
      'ballot.question': deletedBallot.question,
      'ballot.votes': deletedBallot.votes.length,
      'admin.user': 'authenticated'
    })

    return c.json({
      message: 'Ballot deleted successfully',
      deletedBallot: {
        id: deletedBallot.id,
        question: deletedBallot.question,
        voteCount: deletedBallot.votes.length
      }
    })
  })
})

app.patch('/api/admin/ballots/:id', adminAuth, async (c) => {
  const id = c.req.param('id')

  return withSpan('admin_update_ballot', async (span) => {
    const { isPrivate } = await c.req.json()

    addSpanAttributes({
      'ballot.id': id,
      'operation': 'admin_update_ballot',
      'admin.action': 'toggle_privacy',
      'ballot.is_private': isPrivate
    })

    const ballots = await getAllBallots(c.env.BALLOTS_KV)
    const ballotIndex = ballots.findIndex(b => b.id === id)

    if (ballotIndex === -1) {
      addSpanAttributes({ 'ballot.found': false })
      recordSpanEvent('admin_update_failed', { 'ballot.id': id, 'error': 'ballot_not_found' })
      setSpanStatus(span, false, 'Ballot not found')
      return c.json({ error: 'Ballot not found' }, 404)
    }

    ballots[ballotIndex]!.isPrivate = isPrivate
    await saveBallots(c.env.BALLOTS_KV, ballots)

    addSpanAttributes({ 'ballot.found': true, 'ballot.updated': true })
    recordSpanEvent('admin_ballot_updated', {
      'ballot.id': id,
      'ballot.is_private': isPrivate,
      'admin.user': 'authenticated'
    })

    return c.json(ballots[ballotIndex])
  })
})

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

    const existingBallots = await getAllBallots(c.env.BALLOTS_KV)
    const existingIds = new Set(existingBallots.map(b => b.id))
    const newBallots = incomingBallots.filter((b: Ballot) => !existingIds.has(b.id))
    const mergedBallots = [...existingBallots, ...newBallots]

    await saveBallots(c.env.BALLOTS_KV, mergedBallots)

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
    validate: (body) => {
      if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
        return { valid: false, error: 'Dashboard name is required' }
      }
      if (body.name.trim().length > MAX_DASHBOARD_NAME_LENGTH) {
        return { valid: false, error: `Dashboard name must be ${MAX_DASHBOARD_NAME_LENGTH} characters or less` }
      }
      return { valid: true }
    },
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
app.get('/api/attendance/batch', async (c) => {
  const span = createSpan('get_attendances_batch')

  try {
    const idsParam = c.req.query('ids')

    if (!idsParam) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'No IDs provided'
      })
      setSpanStatus(span, false, 'IDs query parameter is required')
      return c.json({ error: 'IDs query parameter is required (e.g., ?ids=id1,id2,id3)' }, 400)
    }

    const ids = idsParam.split(',').map(id => id.trim()).filter(id => id)

    if (ids.length === 0) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'No valid IDs provided'
      })
      setSpanStatus(span, false, 'No valid IDs provided')
      return c.json({ error: 'No valid IDs provided' }, 400)
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 100
    if (ids.length > MAX_BATCH_SIZE) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Too many IDs requested'
      })
      setSpanStatus(span, false, `Maximum ${MAX_BATCH_SIZE} IDs allowed per request`)
      return c.json({ error: `Maximum ${MAX_BATCH_SIZE} IDs allowed per request` }, 400)
    }

    addSpanAttributes({
      'operation': 'get_attendances_batch',
      'attendance.requested_count': ids.length
    })

    const allAttendances = await getAllAttendances(c.env.BALLOTS_KV)
    const requestedAttendances = ids
      .map(id => allAttendances.find(a => a.id === id))
      .filter((a): a is Attendance => a !== undefined)

    addSpanAttributes({
      'attendance.found_count': requestedAttendances.length,
      'attendance.missing_count': ids.length - requestedAttendances.length
    })

    recordSpanEvent('attendances_batch_retrieved', {
      'attendance.requested_count': ids.length,
      'attendance.found_count': requestedAttendances.length
    })

    setSpanStatus(span, true)
    return c.json(requestedAttendances)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.get('/api/attendance', async (c) => {
  const span = createSpan('get_all_attendances')

  try {
    const attendances = await getAllAttendances(c.env.BALLOTS_KV)

    // Sort by date descending (most recent first)
    const sortedAttendances = attendances.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    addSpanAttributes({
      'attendance.count': sortedAttendances.length,
      'operation': 'get_all_attendances'
    })

    recordSpanEvent('attendances_retrieved', {
      'attendance.count': sortedAttendances.length
    })

    setSpanStatus(span, true)
    return c.json(sortedAttendances)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.get('/api/attendance/:id', async (c) => {
  const span = createSpan('get_single_attendance')
  const id = c.req.param('id')

  try {
    addSpanAttributes({
      'attendance.id': id,
      'operation': 'get_single_attendance'
    })

    const attendances = await getAllAttendances(c.env.BALLOTS_KV)
    const attendance = attendances.find(a => a.id === id)

    if (!attendance) {
      addSpanAttributes({
        'attendance.found': false
      })
      recordSpanEvent('attendance_not_found', { 'attendance.id': id })
      setSpanStatus(span, false, 'Attendance not found')
      return c.json({ error: 'Attendance not found' }, 404)
    }

    addSpanAttributes({
      'attendance.found': true,
      'attendance.response_count': attendance.responses.length
    })

    recordSpanEvent('attendance_retrieved', {
      'attendance.id': id,
      'attendance.response_count': attendance.responses.length
    })

    setSpanStatus(span, true)
    return c.json(attendance)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.post('/api/attendance', async (c) => {
  const span = createSpan('create_attendance')

  try {
    const { title, date } = await c.req.json()

    addSpanAttributes({
      'operation': 'create_attendance',
      'title.provided': !!title,
      'date.provided': !!date
    })

    if (!title || typeof title !== 'string' || title.trim() === '') {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Title is required'
      })
      recordSpanEvent('validation_failed', { 'reason': 'missing_title' })
      setSpanStatus(span, false, 'Title is required')
      return c.json({ error: 'Title is required' }, 400)
    }

    if (title.trim().length > MAX_ATTENDANCE_TITLE_LENGTH) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Title too long'
      })
      recordSpanEvent('validation_failed', { 'reason': 'title_too_long' })
      setSpanStatus(span, false, `Title must be ${MAX_ATTENDANCE_TITLE_LENGTH} characters or less`)
      return c.json({ error: `Title must be ${MAX_ATTENDANCE_TITLE_LENGTH} characters or less` }, 400)
    }

    if (!date || typeof date !== 'string') {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Date is required'
      })
      recordSpanEvent('validation_failed', { 'reason': 'missing_date' })
      setSpanStatus(span, false, 'Date is required')
      return c.json({ error: 'Date is required' }, 400)
    }

    const attendances = await getAllAttendances(c.env.BALLOTS_KV)

    const newAttendance: Attendance = {
      id: `attendance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      date: date,
      responses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    attendances.push(newAttendance)
    await saveAttendances(c.env.BALLOTS_KV, attendances)

    addSpanAttributes({
      'attendance.id': newAttendance.id,
      'attendance.title_length': title.trim().length,
      'attendances.total_count': attendances.length
    })

    recordSpanEvent('attendance_created', {
      'attendance.id': newAttendance.id,
      'attendances.total_count': attendances.length
    })

    setSpanStatus(span, true)
    return c.json(newAttendance, 201)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.put('/api/attendance/:id', async (c) => {
  const span = createSpan('update_attendance')
  const id = c.req.param('id')

  try {
    const { name, attending } = await c.req.json()

    addSpanAttributes({
      'attendance.id': id,
      'operation': 'update_attendance'
    })

    if (!name || typeof name !== 'string' || name.trim() === '') {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Name is required'
      })
      recordSpanEvent('validation_failed', { 'reason': 'missing_name' })
      setSpanStatus(span, false, 'Name is required')
      return c.json({ error: 'Name is required' }, 400)
    }

    if (name.trim().length > MAX_NAME_LENGTH) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Name too long'
      })
      recordSpanEvent('validation_failed', { 'reason': 'name_too_long' })
      setSpanStatus(span, false, `Name must be ${MAX_NAME_LENGTH} characters or less`)
      return c.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less` }, 400)
    }

    if (typeof attending !== 'boolean') {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Attending must be true or false'
      })
      recordSpanEvent('validation_failed', { 'reason': 'invalid_attending' })
      setSpanStatus(span, false, 'Attending must be true or false')
      return c.json({ error: 'Attending must be true or false' }, 400)
    }

    const attendances = await getAllAttendances(c.env.BALLOTS_KV)
    const attendanceIndex = attendances.findIndex(a => a.id === id)

    if (attendanceIndex === -1) {
      addSpanAttributes({
        'attendance.found': false
      })
      recordSpanEvent('attendance_not_found', { 'attendance.id': id })
      setSpanStatus(span, false, 'Attendance not found')
      return c.json({ error: 'Attendance not found' }, 404)
    }

    const currentAttendance = attendances[attendanceIndex]!
    const trimmedName = name.trim()

    // Check if this person already responded (case-insensitive)
    const existingResponseIndex = currentAttendance.responses.findIndex(
      r => r.name.toLowerCase() === trimmedName.toLowerCase()
    )

    const newResponse: AttendanceResponse = {
      name: trimmedName,
      attending: attending,
      timestamp: new Date().toISOString()
    }

    if (existingResponseIndex !== -1) {
      // Update existing response
      currentAttendance.responses[existingResponseIndex] = newResponse
      addSpanAttributes({
        'response.updated': true
      })
    } else {
      // Add new response
      currentAttendance.responses.push(newResponse)
      addSpanAttributes({
        'response.updated': false
      })
    }

    currentAttendance.updatedAt = new Date().toISOString()
    attendances[attendanceIndex] = currentAttendance
    await saveAttendances(c.env.BALLOTS_KV, attendances)

    addSpanAttributes({
      'attendance.found': true,
      'attendance.response_count': currentAttendance.responses.length,
      'response.name': trimmedName,
      'response.attending': attending
    })

    recordSpanEvent('attendance_response_added', {
      'attendance.id': id,
      'response.attending': attending,
      'attendance.response_count': currentAttendance.responses.length
    })

    setSpanStatus(span, true)
    return c.json(currentAttendance)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.delete('/api/attendance/:id', adminAuth, async (c) => {
  const span = createSpan('admin_delete_attendance')
  const id = c.req.param('id')

  try {
    addSpanAttributes({
      'attendance.id': id,
      'operation': 'admin_delete_attendance',
      'admin.action': 'delete_attendance'
    })

    const attendances = await getAllAttendances(c.env.BALLOTS_KV)
    const attendanceIndex = attendances.findIndex(a => a.id === id)

    if (attendanceIndex === -1) {
      addSpanAttributes({
        'attendance.found': false
      })
      recordSpanEvent('admin_delete_failed', {
        'attendance.id': id,
        'error': 'attendance_not_found'
      })
      setSpanStatus(span, false, 'Attendance not found')
      return c.json({ error: 'Attendance not found' }, 404)
    }

    const deletedAttendance = attendances[attendanceIndex]!
    attendances.splice(attendanceIndex, 1)
    await saveAttendances(c.env.BALLOTS_KV, attendances)

    addSpanAttributes({
      'attendance.found': true,
      'attendance.title': deletedAttendance.title,
      'attendance.response_count': deletedAttendance.responses.length
    })

    recordSpanEvent('admin_attendance_deleted', {
      'attendance.id': id,
      'attendance.title': deletedAttendance.title,
      'attendance.responses': deletedAttendance.responses.length,
      'admin.user': 'authenticated'
    })

    setSpanStatus(span, true)
    return c.json({
      message: 'Attendance deleted successfully',
      deletedAttendance: {
        id: deletedAttendance.id,
        title: deletedAttendance.title,
        responseCount: deletedAttendance.responses.length
      }
    })
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

export default {
  fetch: app.fetch,
}
