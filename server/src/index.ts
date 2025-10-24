import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiResponse } from 'shared/dist'
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

    // Sort by createdAt descending (newest first)
    const sortedBallots = ballots.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    addSpanAttributes({
      'ballot.count': ballots.length,
      'operation': 'get_all_ballots'
    })

    recordSpanEvent('ballots_retrieved', {
      'ballot.count': ballots.length
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
    const { question } = await c.req.json()
    
    addSpanAttributes({
      'operation': 'create_ballot',
      'question.provided': !!question
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
      createdAt: new Date().toISOString()
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

export default {
  fetch: app.fetch,
}
