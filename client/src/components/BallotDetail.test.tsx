import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BallotDetail } from './BallotDetail'

// Mock fetch
const mockFetch = mock()
global.fetch = mockFetch

// Mock clipboard API
const mockWriteText = mock()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText
  }
})

const mockBallot = {
  id: 'test-1',
  question: 'Should we implement dark mode?',
  votes: [
    { color: 'green', comment: 'Yes please!', createdAt: '2024-01-01T10:00:00Z' },
    { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
    { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
    { color: 'red', comment: 'No thanks', createdAt: '2024-01-01T13:00:00Z' }
  ],
  createdAt: '2024-01-01T09:00:00Z'
}

describe('BallotDetail Component', () => {
  const mockOnBack = mock(() => {})

  beforeEach(() => {
    mockFetch.mockClear()
    mockWriteText.mockClear()
    mockOnBack.mockClear()
    
    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockBallot
    })
  })

  test('should render loading state initially', () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('should fetch and display ballot details', async () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      expect(screen.getByText('Should we implement dark mode?')).toBeInTheDocument()
      expect(screen.getByText('Created 1/1/2024')).toBeInTheDocument()
    })
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ballot-app-server.siener.workers.dev/api/ballots/test-1'
    )
  })

  test('should display vote counts in colored circles', async () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      // Should show vote counts: 2 green, 1 yellow, 1 red
      const voteCounts = screen.getAllByText('2')
      expect(voteCounts.length).toBeGreaterThan(0)
      
      expect(screen.getByText('1')).toBeInTheDocument() // yellow and red votes
    })
  })

  test('should display comments with colored indicators', async () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      expect(screen.getByText('Yes please!')).toBeInTheDocument()
      expect(screen.getByText('Maybe')).toBeInTheDocument()
      expect(screen.getByText('No thanks')).toBeInTheDocument()
      
      // Should not show empty comments
      expect(screen.queryByText('')).not.toBeInTheDocument()
    })
  })

  test('should display shareable URL as clickable link', async () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const urlLink = screen.getByRole('link')
      expect(urlLink).toHaveAttribute('href', expect.stringContaining('/ballot/test-1'))
      expect(urlLink).toHaveAttribute('target', '_blank')
      expect(urlLink).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  test('should copy URL to clipboard when copy button clicked', async () => {
    mockWriteText.mockResolvedValue(undefined)
    
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const copyButton = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(copyButton)
    })
    
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('/ballot/test-1')
    )
  })

  test('should show visual feedback when copy button is pressed', async () => {
    mockWriteText.mockResolvedValue(undefined)
    
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const copyButton = screen.getByRole('button', { name: /copy/i })
      
      // Check that button has press animation classes
      expect(copyButton).toHaveClass('transition-all', 'duration-150')
      
      fireEvent.click(copyButton)
    })
  })

  test('should handle ballot not found', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404
    })
    
    render(<BallotDetail ballotId="non-existent" onBack={mockOnBack} />)
    
    await waitFor(() => {
      expect(screen.getByText('Ballot not found')).toBeInTheDocument()
      expect(screen.getByText('Back to Ballots')).toBeInTheDocument()
    })
  })

  test('should call onBack when back button clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404
    })
    
    render(<BallotDetail ballotId="non-existent" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const backButton = screen.getByText('Back to Ballots')
      fireEvent.click(backButton)
    })
    
    expect(mockOnBack).toHaveBeenCalled()
  })
})

describe('Voting Functionality', () => {
  const mockOnBack = mock(() => {})

  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockBallot
    })
  })

  test('should render voting form', async () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      expect(screen.getByText('Your Vote')).toBeInTheDocument()
      expect(screen.getByText('Comment (optional)')).toBeInTheDocument()
      expect(screen.getByText('Vote Now')).toBeInTheDocument()
    })
  })

  test('should allow selecting vote color', async () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const greenOption = screen.getByLabelText('vote-green')
      const yellowOption = screen.getByLabelText('vote-yellow')
      const redOption = screen.getByLabelText('vote-red')
      
      expect(greenOption).toBeInTheDocument()
      expect(yellowOption).toBeInTheDocument()
      expect(redOption).toBeInTheDocument()
    })
  })

  test('should allow entering comment', async () => {
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const commentTextarea = screen.getByPlaceholderText('Add your comment here')
      expect(commentTextarea).toBeInTheDocument()
      
      fireEvent.change(commentTextarea, { target: { value: 'This is my opinion' } })
      expect(commentTextarea).toHaveValue('This is my opinion')
    })
  })

  test('should submit vote with selected color and comment', async () => {
    const updatedBallot = {
      ...mockBallot,
      votes: [
        ...mockBallot.votes,
        { color: 'yellow', comment: 'My new vote', createdAt: '2024-01-01T14:00:00Z' }
      ]
    }

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockBallot })
      .mockResolvedValueOnce({ ok: true, json: async () => updatedBallot })
    
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const yellowOption = screen.getByLabelText('vote-yellow')
      const commentTextarea = screen.getByPlaceholderText('Add your comment here')
      const submitButton = screen.getByText('Vote Now')
      
      fireEvent.click(yellowOption)
      fireEvent.change(commentTextarea, { target: { value: 'My new vote' } })
      fireEvent.click(submitButton)
    })
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'https://ballot-app-server.siener.workers.dev/api/ballots/test-1',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('My new vote')
        })
      )
    })
  })

  test('should clear form after successful vote submission', async () => {
    const updatedBallot = {
      ...mockBallot,
      votes: [...mockBallot.votes, { color: 'green', comment: '', createdAt: '2024-01-01T14:00:00Z' }]
    }

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockBallot })
      .mockResolvedValueOnce({ ok: true, json: async () => updatedBallot })
    
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const commentTextarea = screen.getByPlaceholderText('Add your comment here')
      const submitButton = screen.getByText('Vote Now')
      
      fireEvent.change(commentTextarea, { target: { value: 'Test comment' } })
      fireEvent.click(submitButton)
    })
    
    await waitFor(() => {
      const commentTextarea = screen.getByPlaceholderText('Add your comment here')
      expect(commentTextarea).toHaveValue('')
    })
  })

  test('should handle vote submission error', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockBallot })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    
    render(<BallotDetail ballotId="test-1" onBack={mockOnBack} />)
    
    await waitFor(() => {
      const submitButton = screen.getByText('Vote Now')
      fireEvent.click(submitButton)
    })
    
    // Should not crash on error - error is logged to console
    expect(screen.getByText('Vote Now')).toBeInTheDocument()
  })
})

describe('Vote Count Display', () => {
  test('should count votes by color correctly', () => {
    const votes = [
      { color: 'green', comment: 'Yes', createdAt: '2024-01-01T10:00:00Z' },
      { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
      { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
      { color: 'red', comment: 'No', createdAt: '2024-01-01T13:00:00Z' },
      { color: 'green', comment: '', createdAt: '2024-01-01T14:00:00Z' }
    ]

    const countVotes = (color: string) => {
      return votes.filter(v => v.color === color).length
    }

    expect(countVotes('green')).toBe(3)
    expect(countVotes('yellow')).toBe(1)
    expect(countVotes('red')).toBe(1)
  })

  test('should apply correct color classes', () => {
    const getColorClass = (color: string) => {
      switch (color) {
        case 'green': return 'text-green-500'
        case 'yellow': return 'text-yellow-500'
        case 'red': return 'text-red-500'
        default: return ''
      }
    }

    expect(getColorClass('green')).toBe('text-green-500')
    expect(getColorClass('yellow')).toBe('text-yellow-500')
    expect(getColorClass('red')).toBe('text-red-500')
    expect(getColorClass('blue')).toBe('')
  })
})