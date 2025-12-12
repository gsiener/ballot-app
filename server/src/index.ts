import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiResponse, Dashboard, Attendance, AttendanceResponse } from 'shared/dist'
import { initTelemetry, createSpan, addSpanAttributes, recordSpanEvent, setSpanStatus } from './telemetry'

type Bindings = {
  BALLOTS_KV: KVNamespace
  ADMIN_API_KEY?: string
}

type Variables = {}

type HonoEnv = {
  Bindings: Bindings
  Variables: Variables
}

type Vote = {
  color: 'green' | 'yellow' | 'red'
  comment?: string
  createdAt: string
}

type Ballot = {
  id: string
  question: string
  votes: Vote[]
  createdAt: string
  isPrivate?: boolean
}

const app = new Hono<HonoEnv>()

app.use(cors())

// Middleware to initialize telemetry for each request
app.use('*', async (c, next) => {
  // Initialize telemetry with environment variables from the context
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

// Helper functions for KV storage
async function getAllBallots(kv: KVNamespace): Promise<Ballot[]> {
  try {
    const ballotsJson = await kv.get('ballots')
    if (ballotsJson) {
      return JSON.parse(ballotsJson)
    } else {
      // Initialize with demo data if no ballots exist
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

// Helper functions for Dashboard KV storage
async function getAllDashboards(kv: KVNamespace): Promise<Dashboard[]> {
  try {
    const dashboardsJson = await kv.get('dashboards')
    if (dashboardsJson) {
      return JSON.parse(dashboardsJson)
    }
    // Return empty array if no dashboards exist
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

// Helper functions for Attendance KV storage
async function getAllAttendances(kv: KVNamespace): Promise<Attendance[]> {
  try {
    const attendancesJson = await kv.get('attendances')
    if (attendancesJson) {
      return JSON.parse(attendancesJson)
    }
    // Return empty array if no attendances exist
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

// Admin authentication middleware
const adminAuth = async (c: any, next: any) => {
  const span = createSpan('admin_auth')
  
  try {
    const authHeader = c.req.header('Authorization')
    const adminKey = c.env.ADMIN_API_KEY
    
    if (!adminKey) {
      addSpanAttributes({
        'auth.error': 'no_admin_key_configured',
        'auth.success': false
      })
      setSpanStatus(span, false, 'Admin key not configured')
      span.end()
      return c.json({ error: 'Admin functionality not available' }, 500)
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      addSpanAttributes({
        'auth.error': 'missing_bearer_token',
        'auth.success': false
      })
      setSpanStatus(span, false, 'Missing authorization header')
      span.end()
      return c.json({ error: 'Unauthorized' }, 401)
    }
    
    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    if (token !== adminKey) {
      addSpanAttributes({
        'auth.error': 'invalid_token',
        'auth.success': false
      })
      setSpanStatus(span, false, 'Invalid admin token')
      recordSpanEvent('admin_auth_failed', { 'auth.attempt': 'invalid_token' })
      span.end()
      return c.json({ error: 'Unauthorized' }, 401)
    }
    
    addSpanAttributes({
      'auth.success': true,
      'auth.type': 'admin'
    })
    recordSpanEvent('admin_auth_success', { 'auth.method': 'bearer_token' })
    
    await next()
  } catch (error) {
    setSpanStatus(span, false, `Admin auth error: ${error}`)
    span.end()
    return c.json({ error: 'Authentication error' }, 500)
  } finally {
    span.end()
  }
}

app.get('/', (c) => {
  return c.text('Ballot App API - Visit /api/ballots to see all ballots')
})

app.get('/hello', async (c) => {
  const data: ApiResponse = {
    message: "Hello BHVR!",
    success: true
  }
  return c.json(data, { status: 200 })
})

// Get all ballots
app.get('/api/ballots', async (c) => {
  const span = createSpan('get_all_ballots')
  
  try {
    const ballots = await getAllBallots(c.env.BALLOTS_KV)

    // Filter out private ballots from public listing
    const publicBallots = ballots.filter(ballot => !ballot.isPrivate)

    // Sort by createdAt descending (newest first)
    const sortedBallots = publicBallots.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    addSpanAttributes({
      'ballot.count': sortedBallots.length,
      'ballot.total_count': ballots.length,
      'operation': 'get_all_ballots'
    })

    recordSpanEvent('ballots_retrieved', {
      'ballot.count': sortedBallots.length,
      'ballot.private_count': ballots.length - sortedBallots.length
    })

    setSpanStatus(span, true)
    return c.json(sortedBallots)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

// Get single ballot
app.get('/api/ballots/:id', async (c) => {
  const span = createSpan('get_single_ballot')
  const id = c.req.param('id')
  
  try {
    addSpanAttributes({
      'ballot.id': id,
      'operation': 'get_single_ballot'
    })
    
    const ballots = await getAllBallots(c.env.BALLOTS_KV)
    const ballot = ballots.find(b => b.id === id)
    
    if (!ballot) {
      addSpanAttributes({
        'ballot.found': false
      })
      recordSpanEvent('ballot_not_found', { 'ballot.id': id })
      setSpanStatus(span, false, 'Ballot not found')
      return c.json({ error: 'Ballot not found' }, 404)
    }
    
    addSpanAttributes({
      'ballot.found': true,
      'ballot.vote_count': ballot.votes.length
    })
    
    recordSpanEvent('ballot_retrieved', {
      'ballot.id': id,
      'ballot.vote_count': ballot.votes.length
    })
    
    setSpanStatus(span, true)
    return c.json(ballot)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

// Create new ballot
app.post('/api/ballots', async (c) => {
  const span = createSpan('create_ballot')
  
  try {
    const { question, isPrivate } = await c.req.json()

    addSpanAttributes({
      'operation': 'create_ballot',
      'question.provided': !!question,
      'ballot.is_private': !!isPrivate
    })

    if (!question || typeof question !== 'string') {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Question is required'
      })
      recordSpanEvent('validation_failed', { 'reason': 'missing_question' })
      setSpanStatus(span, false, 'Question is required')
      return c.json({ error: 'Question is required' }, 400)
    }

    const ballots = await getAllBallots(c.env.BALLOTS_KV)

    const newBallot: Ballot = {
      id: `ballot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      question: question.trim(),
      votes: [],
      createdAt: new Date().toISOString(),
      isPrivate: isPrivate === true
    }
    
    ballots.push(newBallot)
    await saveBallots(c.env.BALLOTS_KV, ballots)
    
    addSpanAttributes({
      'ballot.id': newBallot.id,
      'ballot.question_length': question.trim().length,
      'ballots.total_count': ballots.length
    })
    
    recordSpanEvent('ballot_created', {
      'ballot.id': newBallot.id,
      'ballots.total_count': ballots.length
    })
    
    setSpanStatus(span, true)
    return c.json(newBallot, 201)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

// Update ballot (add vote)
app.put('/api/ballots/:id', async (c) => {
  const span = createSpan('update_ballot')
  const id = c.req.param('id')
  
  try {
    const updatedBallot = await c.req.json()
    
    addSpanAttributes({
      'ballot.id': id,
      'operation': 'update_ballot'
    })
    
    const ballots = await getAllBallots(c.env.BALLOTS_KV)
    const ballotIndex = ballots.findIndex(b => b.id === id)
    
    if (ballotIndex === -1) {
      addSpanAttributes({
        'ballot.found': false
      })
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
    
    setSpanStatus(span, true)
    return c.json(ballots[ballotIndex])
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

// Admin endpoints - protected by authentication
app.get('/api/admin/ballots', adminAuth, async (c) => {
  const span = createSpan('admin_get_all_ballots')
  
  try {
    const ballots = await getAllBallots(c.env.BALLOTS_KV)

    // Sort by createdAt descending (newest first)
    const sortedBallots = ballots.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Add admin metadata
    const adminBallots = sortedBallots.map(ballot => ({
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
    
    setSpanStatus(span, true)
    return c.json(adminBallots)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.delete('/api/admin/ballots/:id', adminAuth, async (c) => {
  const span = createSpan('admin_delete_ballot')
  const id = c.req.param('id')
  
  try {
    addSpanAttributes({
      'ballot.id': id,
      'operation': 'admin_delete_ballot',
      'admin.action': 'delete_ballot'
    })
    
    const ballots = await getAllBallots(c.env.BALLOTS_KV)
    const ballotIndex = ballots.findIndex(b => b.id === id)
    
    if (ballotIndex === -1) {
      addSpanAttributes({
        'ballot.found': false
      })
      recordSpanEvent('admin_delete_failed', { 
        'ballot.id': id,
        'error': 'ballot_not_found'
      })
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
    
    setSpanStatus(span, true)
    return c.json({ 
      message: 'Ballot deleted successfully',
      deletedBallot: {
        id: deletedBallot.id,
        question: deletedBallot.question,
        voteCount: deletedBallot.votes.length
      }
    })
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.patch('/api/admin/ballots/:id', adminAuth, async (c) => {
  const span = createSpan('admin_update_ballot')
  const id = c.req.param('id')

  try {
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
      addSpanAttributes({
        'ballot.found': false
      })
      recordSpanEvent('admin_update_failed', {
        'ballot.id': id,
        'error': 'ballot_not_found'
      })
      setSpanStatus(span, false, 'Ballot not found')
      return c.json({ error: 'Ballot not found' }, 404)
    }

    // Update the privacy status
    ballots[ballotIndex]!.isPrivate = isPrivate
    await saveBallots(c.env.BALLOTS_KV, ballots)

    addSpanAttributes({
      'ballot.found': true,
      'ballot.updated': true
    })

    recordSpanEvent('admin_ballot_updated', {
      'ballot.id': id,
      'ballot.is_private': isPrivate,
      'admin.user': 'authenticated'
    })

    setSpanStatus(span, true)
    return c.json(ballots[ballotIndex])
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.post('/api/admin/ballots/migrate', adminAuth, async (c) => {
  const span = createSpan('admin_migrate_ballots')

  try {
    const { ballots: incomingBallots } = await c.req.json()

    addSpanAttributes({
      'operation': 'admin_migrate_ballots',
      'admin.action': 'migrate_ballots',
      'ballots.incoming_count': incomingBallots?.length || 0
    })

    if (!Array.isArray(incomingBallots)) {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Invalid ballots format'
      })
      setSpanStatus(span, false, 'Invalid ballots format')
      return c.json({ error: 'Ballots must be an array' }, 400)
    }

    const existingBallots = await getAllBallots(c.env.BALLOTS_KV)
    const existingIds = new Set(existingBallots.map(b => b.id))

    // Filter out duplicates
    const newBallots = incomingBallots.filter((b: Ballot) => !existingIds.has(b.id))

    // Merge and save
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

    setSpanStatus(span, true)
    return c.json({
      message: 'Migration successful',
      existingCount: existingBallots.length,
      migratedCount: newBallots.length,
      duplicatesSkipped: incomingBallots.length - newBallots.length,
      totalCount: mergedBallots.length
    })
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

// Dashboard endpoints
app.get('/api/dashboards', async (c) => {
  const span = createSpan('get_all_dashboards')

  try {
    const dashboards = await getAllDashboards(c.env.BALLOTS_KV)

    // Sort by updatedAt descending (most recently updated first)
    const sortedDashboards = dashboards.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    addSpanAttributes({
      'dashboard.count': sortedDashboards.length,
      'operation': 'get_all_dashboards'
    })

    recordSpanEvent('dashboards_retrieved', {
      'dashboard.count': sortedDashboards.length
    })

    setSpanStatus(span, true)
    return c.json(sortedDashboards)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.get('/api/dashboards/:id', async (c) => {
  const span = createSpan('get_single_dashboard')
  const id = c.req.param('id')

  try {
    addSpanAttributes({
      'dashboard.id': id,
      'operation': 'get_single_dashboard'
    })

    const dashboards = await getAllDashboards(c.env.BALLOTS_KV)
    const dashboard = dashboards.find(d => d.id === id)

    if (!dashboard) {
      addSpanAttributes({
        'dashboard.found': false
      })
      recordSpanEvent('dashboard_not_found', { 'dashboard.id': id })
      setSpanStatus(span, false, 'Dashboard not found')
      return c.json({ error: 'Dashboard not found' }, 404)
    }

    addSpanAttributes({
      'dashboard.found': true,
      'dashboard.ballot_count': dashboard.ballotIds.length
    })

    recordSpanEvent('dashboard_retrieved', {
      'dashboard.id': id,
      'dashboard.ballot_count': dashboard.ballotIds.length
    })

    setSpanStatus(span, true)
    return c.json(dashboard)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.post('/api/dashboards', async (c) => {
  const span = createSpan('create_dashboard')

  try {
    const { name } = await c.req.json()

    addSpanAttributes({
      'operation': 'create_dashboard',
      'name.provided': !!name
    })

    if (!name || typeof name !== 'string' || name.trim() === '') {
      addSpanAttributes({
        'validation.failed': true,
        'error': 'Dashboard name is required'
      })
      recordSpanEvent('validation_failed', { 'reason': 'missing_name' })
      setSpanStatus(span, false, 'Dashboard name is required')
      return c.json({ error: 'Dashboard name is required' }, 400)
    }

    const dashboards = await getAllDashboards(c.env.BALLOTS_KV)

    const newDashboard: Dashboard = {
      id: `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      ballotIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    dashboards.push(newDashboard)
    await saveDashboards(c.env.BALLOTS_KV, dashboards)

    addSpanAttributes({
      'dashboard.id': newDashboard.id,
      'dashboard.name_length': name.trim().length,
      'dashboards.total_count': dashboards.length
    })

    recordSpanEvent('dashboard_created', {
      'dashboard.id': newDashboard.id,
      'dashboards.total_count': dashboards.length
    })

    setSpanStatus(span, true)
    return c.json(newDashboard, 201)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.put('/api/dashboards/:id', async (c) => {
  const span = createSpan('update_dashboard')
  const id = c.req.param('id')

  try {
    const { name, ballotIds } = await c.req.json()

    addSpanAttributes({
      'dashboard.id': id,
      'operation': 'update_dashboard'
    })

    const dashboards = await getAllDashboards(c.env.BALLOTS_KV)
    const dashboardIndex = dashboards.findIndex(d => d.id === id)

    if (dashboardIndex === -1) {
      addSpanAttributes({
        'dashboard.found': false
      })
      recordSpanEvent('dashboard_not_found', { 'dashboard.id': id })
      setSpanStatus(span, false, 'Dashboard not found')
      return c.json({ error: 'Dashboard not found' }, 404)
    }

    // Update fields if provided
    const currentDashboard = dashboards[dashboardIndex]!
    const updatedDashboard: Dashboard = {
      ...currentDashboard,
      name: name !== undefined && typeof name === 'string' ? name.trim() : currentDashboard.name,
      ballotIds: Array.isArray(ballotIds) ? ballotIds : currentDashboard.ballotIds,
      updatedAt: new Date().toISOString()
    }

    dashboards[dashboardIndex] = updatedDashboard
    await saveDashboards(c.env.BALLOTS_KV, dashboards)

    addSpanAttributes({
      'dashboard.found': true,
      'dashboard.ballot_count': updatedDashboard.ballotIds.length
    })

    recordSpanEvent('dashboard_updated', {
      'dashboard.id': id,
      'dashboard.ballot_count': updatedDashboard.ballotIds.length
    })

    setSpanStatus(span, true)
    return c.json(updatedDashboard)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

app.delete('/api/dashboards/:id', async (c) => {
  const span = createSpan('delete_dashboard')
  const id = c.req.param('id')

  try {
    addSpanAttributes({
      'dashboard.id': id,
      'operation': 'delete_dashboard'
    })

    const dashboards = await getAllDashboards(c.env.BALLOTS_KV)
    const dashboardIndex = dashboards.findIndex(d => d.id === id)

    if (dashboardIndex === -1) {
      addSpanAttributes({
        'dashboard.found': false
      })
      recordSpanEvent('delete_failed', {
        'dashboard.id': id,
        'error': 'dashboard_not_found'
      })
      setSpanStatus(span, false, 'Dashboard not found')
      return c.json({ error: 'Dashboard not found' }, 404)
    }

    const deletedDashboard = dashboards[dashboardIndex]!
    dashboards.splice(dashboardIndex, 1)
    await saveDashboards(c.env.BALLOTS_KV, dashboards)

    addSpanAttributes({
      'dashboard.found': true,
      'dashboard.name': deletedDashboard.name,
      'dashboard.ballot_count': deletedDashboard.ballotIds.length
    })

    recordSpanEvent('dashboard_deleted', {
      'dashboard.id': id,
      'dashboard.name': deletedDashboard.name,
      'dashboard.ballot_count': deletedDashboard.ballotIds.length
    })

    setSpanStatus(span, true)
    return c.json({
      message: 'Dashboard deleted successfully',
      deletedDashboard: {
        id: deletedDashboard.id,
        name: deletedDashboard.name,
        ballotCount: deletedDashboard.ballotIds.length
      }
    })
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

// Attendance endpoints
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
