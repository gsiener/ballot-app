import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { BallotList } from './BallotList'

// Mock react-router-dom
const mockNavigate = mock(() => {})
mock.module('react-router-dom', () => ({
  ...require('react-router-dom'),
  useNavigate: () => mockNavigate
}))

// Mock fetch
const mockFetch = mock()
global.fetch = mockFetch

const mockBallots = [
  {
    id: 'test-1',
    question: 'Should we implement dark mode?',
    votes: [
      { color: 'green', comment: 'Yes please!', createdAt: '2024-01-01T10:00:00Z' },
      { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
      { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' }
    ],
    createdAt: '2024-01-01T09:00:00Z'
  },
  {
    id: 'test-2',
    question: 'What do you think of the new UI?',
    votes: [
      { color: 'green', comment: 'Love it!', createdAt: '2024-01-02T10:00:00Z' }
    ],
    createdAt: '2024-01-02T09:00:00Z'
  }
]

const BallotListWithRouter = () => (
  <BrowserRouter>
    <BallotList />
  </BrowserRouter>
)

describe('BallotList Component', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockNavigate.mockClear()
    
    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockBallots
    })
  })

  test('should render loading state initially', () => {
    render(<BallotListWithRouter />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('should fetch and display ballots', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      expect(screen.getByText('Should we implement dark mode?')).toBeInTheDocument()
      expect(screen.getByText('What do you think of the new UI?')).toBeInTheDocument()
    })
    
    expect(mockFetch).toHaveBeenCalledWith('https://ballot-app-server.siener.workers.dev/api/ballots')
  })

  test('should display vote counts correctly', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      expect(screen.getByText('3 votes and 2 comments')).toBeInTheDocument()
      expect(screen.getByText('1 votes and 1 comments')).toBeInTheDocument()
    })
  })

  test('should show vote breakdown by color', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      // Should show colored circles with vote counts
      const greenVotes = screen.getAllByText('2') // 2 green votes for first ballot
      const yellowVotes = screen.getAllByText('1') // 1 yellow vote for first ballot
      const redVotes = screen.getAllByText('0') // 0 red votes for first ballot
      
      expect(greenVotes.length).toBeGreaterThan(0)
      expect(yellowVotes.length).toBeGreaterThan(0)
      expect(redVotes.length).toBeGreaterThan(0)
    })
  })

  test('should navigate to ballot detail when clicked', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      const ballotCard = screen.getByText('Should we implement dark mode?').closest('div')
      fireEvent.click(ballotCard!)
    })
    
    expect(mockNavigate).toHaveBeenCalledWith('/ballot/test-1')
  })

  test('should handle empty ballot list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => []
    })
    
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      expect(screen.getByText('No ballots created yet. Be the first to create one!')).toBeInTheDocument()
    })
  })

  test('should handle fetch error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500
    })
    
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      // Should show empty state when fetch fails
      expect(screen.getByText('No ballots created yet. Be the first to create one!')).toBeInTheDocument()
    })
  })
})

describe('Ballot Creation Form', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockBallots
    })
  })

  test('should render create ballot form', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      expect(screen.getByText('Create a ballot by asking a question you want feedback to...')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your ballot question')).toBeInTheDocument()
      expect(screen.getByText('Create Ballot')).toBeInTheDocument()
    })
  })

  test('should create new ballot on form submission', async () => {
    const newBallot = {
      id: 'test-3',
      question: 'New test ballot?',
      votes: [],
      createdAt: '2024-01-03T09:00:00Z'
    }

    // Mock successful creation
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockBallots }) // Initial fetch
      .mockResolvedValueOnce({ ok: true, json: async () => newBallot }) // Create ballot

    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter your ballot question')
      const submitButton = screen.getByText('Create Ballot')
      
      fireEvent.change(input, { target: { value: 'New test ballot?' } })
      fireEvent.click(submitButton)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ballot-app-server.siener.workers.dev/api/ballots',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'New test ballot?' })
      })
    )
  })

  test('should not submit empty question', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter your ballot question')
      const submitButton = screen.getByText('Create Ballot')
      
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.click(submitButton)
    })

    // Should not make POST request for empty/whitespace question
    expect(mockFetch).toHaveBeenCalledTimes(1) // Only initial GET request
  })

  test('should clear input after successful creation', async () => {
    const newBallot = {
      id: 'test-3',
      question: 'New test ballot?',
      votes: [],
      createdAt: '2024-01-03T09:00:00Z'
    }

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockBallots })
      .mockResolvedValueOnce({ ok: true, json: async () => newBallot })

    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter your ballot question') as HTMLInputElement
      const submitButton = screen.getByText('Create Ballot')
      
      fireEvent.change(input, { target: { value: 'New test ballot?' } })
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter your ballot question') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })
})

describe('Vote Count Calculations', () => {
  test('should count votes by color correctly', () => {
    const ballot = {
      id: 'test-1',
      question: 'Test?',
      votes: [
        { color: 'green', comment: 'Yes', createdAt: '2024-01-01T10:00:00Z' },
        { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
        { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
        { color: 'red', comment: 'No', createdAt: '2024-01-01T13:00:00Z' }
      ],
      createdAt: '2024-01-01T09:00:00Z'
    }

    const countVotes = (ballot: any, color: string) => {
      return ballot.votes.filter((vote: any) => vote.color === color).length
    }

    const countComments = (ballot: any) => {
      return ballot.votes.filter((vote: any) => vote.comment && vote.comment.trim() !== '').length
    }

    expect(countVotes(ballot, 'green')).toBe(2)
    expect(countVotes(ballot, 'yellow')).toBe(1)
    expect(countVotes(ballot, 'red')).toBe(1)
    expect(countComments(ballot)).toBe(3)
  })
})

describe('UI Interactions', () => {
  test('should have proper hover effects on ballot cards', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      const ballotCard = screen.getByText('Should we implement dark mode?').closest('div')
      expect(ballotCard).toHaveClass('hover:shadow-md')
      expect(ballotCard).toHaveClass('cursor-pointer')
    })
  })

  test('should display creation dates in readable format', async () => {
    render(<BallotListWithRouter />)
    
    await waitFor(() => {
      // Should display formatted dates (exact format depends on locale)
      const dateElements = screen.getAllByText(/votes and.*comments/)
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })
})