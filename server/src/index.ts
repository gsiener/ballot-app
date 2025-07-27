import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiResponse } from 'shared/dist'
import { initTelemetry, createSpan, addSpanAttributes, recordSpanEvent, setSpanStatus } from './telemetry'

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

const app = new Hono()

app.use(cors())

// Middleware to initialize telemetry for each request
app.use('*', async (c, next) => {
  // Initialize telemetry with environment variables from the context
  if ((c.env as any)?.HONEYCOMB_API_KEY) {
    initTelemetry(c.env)
  }
  await next()
})

// In-memory storage (for demo - in production use D1 database)
let ballots: Ballot[] = [
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
app.get('/api/ballots', (c) => {
  const span = createSpan('get_all_ballots')
  
  try {
    addSpanAttributes({
      'ballot.count': ballots.length,
      'operation': 'get_all_ballots'
    })
    
    recordSpanEvent('ballots_retrieved', {
      'ballot.count': ballots.length
    })
    
    setSpanStatus(span, true)
    return c.json(ballots)
  } catch (error) {
    setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
    throw error
  } finally {
    span.end()
  }
})

// Get single ballot
app.get('/api/ballots/:id', (c) => {
  const span = createSpan('get_single_ballot')
  const id = c.req.param('id')
  
  try {
    addSpanAttributes({
      'ballot.id': id,
      'operation': 'get_single_ballot'
    })
    
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
    
    const newBallot: Ballot = {
      id: `ballot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      question: question.trim(),
      votes: [],
      createdAt: new Date().toISOString()
    }
    
    ballots.push(newBallot)
    
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

export default {
  fetch: app.fetch,
}
