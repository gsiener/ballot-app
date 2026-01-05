import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiResponse, Dashboard, Vote, Ballot, AdminBallot } from 'shared/dist'
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

    addSpanAttributes({ 'ballot.id': id, 'operation': 'update_ballot' })

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
      return { valid: true }
    },
    buildItem: (body) => ({
      id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: body.name.trim(),
      ballotIds: [],
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
    updatedAt: new Date().toISOString()
  }),
  includeAttributes: (updated) => ({ 'dashboard.ballot_count': updated.ballotIds.length })
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

export default {
  fetch: app.fetch,
}
