import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AdminPanel } from './AdminPanel'

// Mock react-router-dom
const mockSearchParams = new URLSearchParams()
mock.module('react-router-dom', () => ({
  ...require('react-router-dom'),
  useSearchParams: () => [mockSearchParams]
}))

// Mock fetch
const mockFetch = mock()
global.fetch = mockFetch

// Mock window methods
const mockAlert = mock()
const mockConfirm = mock()
const mockOpen = mock()
global.alert = mockAlert
global.confirm = mockConfirm
global.open = mockOpen

const mockAdminBallots = [
  {
    id: 'test-1',
    question: 'Should we implement dark mode?',
    votes: [
      { color: 'green', comment: 'Yes please!', createdAt: '2024-01-01T10:00:00Z' },
      { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
      { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' }
    ],
    createdAt: '2024-01-01T09:00:00Z',
    voteCount: 3,
    commentCount: 2,
    lastVote: '2024-01-01T12:00:00Z'
  },
  {
    id: 'test-2',
    question: 'What do you think of the new UI?',
    votes: [
      { color: 'green', comment: 'Love it!', createdAt: '2024-01-02T10:00:00Z' }
    ],
    createdAt: '2024-01-02T09:00:00Z',
    voteCount: 1,
    commentCount: 1,
    lastVote: '2024-01-02T10:00:00Z'
  }
]

const AdminPanelWithRouter = () => (
  <BrowserRouter>
    <AdminPanel />
  </BrowserRouter>
)

describe('AdminPanel Component', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockAlert.mockClear()
    mockConfirm.mockClear()
    mockOpen.mockClear()
    mockSearchParams.clear()
    
    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockAdminBallots
    })
  })

  describe('Authentication', () => {
    test('should show access denied when no key provided', () => {
      render(<AdminPanelWithRouter />)
      
      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(screen.getByText('Admin access requires a valid authentication key in the URL.')).toBeInTheDocument()
    })

    test('should show loading when key is provided', () => {
      mockSearchParams.set('key', 'test-admin-key')
      
      render(<AdminPanelWithRouter />)
      
      expect(screen.getByText('Loading admin panel...')).toBeInTheDocument()
    })

    test('should show authentication failed for invalid key', async () => {
      mockSearchParams.set('key', 'invalid-key')
      mockFetch.mockResolvedValue({
        status: 401,
        ok: false
      })
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument()
        expect(screen.getByText('Invalid admin key')).toBeInTheDocument()
      })
    })

    test('should show admin panel for valid key', async () => {
      mockSearchParams.set('key', 'valid-admin-key')
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('Admin Panel')).toBeInTheDocument()
        expect(screen.getByText('✓ Authenticated')).toBeInTheDocument()
        expect(screen.getByText('2 ballots total')).toBeInTheDocument()
      })
    })
  })

  describe('Ballot Display', () => {
    beforeEach(() => {
      mockSearchParams.set('key', 'valid-admin-key')
    })

    test('should display all ballots with metadata', async () => {
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('Should we implement dark mode?')).toBeInTheDocument()
        expect(screen.getByText('What do you think of the new UI?')).toBeInTheDocument()
        
        // Check vote counts
        expect(screen.getByText('3 votes')).toBeInTheDocument()
        expect(screen.getByText('1 votes')).toBeInTheDocument()
        
        // Check comment counts
        expect(screen.getByText('2 comments')).toBeInTheDocument()
        expect(screen.getByText('1 comments')).toBeInTheDocument()
      })
    })

    test('should display vote breakdown by color', async () => {
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        // Should show colored circles with vote counts
        const voteBreakdowns = screen.getAllByText('2') // Green votes for first ballot
        expect(voteBreakdowns.length).toBeGreaterThan(0)
      })
    })

    test('should display creation and last vote dates', async () => {
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText(/Created 1\/1\/2024/)).toBeInTheDocument()
        expect(screen.getByText(/Last vote 1\/1\/2024/)).toBeInTheDocument()
      })
    })

    test('should display ballot IDs', async () => {
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('ID: test-1')).toBeInTheDocument()
        expect(screen.getByText('ID: test-2')).toBeInTheDocument()
      })
    })

    test('should handle empty ballot list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => []
      })
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('No ballots found')).toBeInTheDocument()
      })
    })
  })

  describe('Ballot Actions', () => {
    beforeEach(() => {
      mockSearchParams.set('key', 'valid-admin-key')
    })

    test('should have view and delete buttons for each ballot', async () => {
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        const viewButtons = screen.getAllByText('View')
        const deleteButtons = screen.getAllByText('Delete')
        
        expect(viewButtons).toHaveLength(2)
        expect(deleteButtons).toHaveLength(2)
      })
    })

    test('should open ballot in new tab when view clicked', async () => {
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        const viewButton = screen.getAllByText('View')[0]
        fireEvent.click(viewButton)
      })
      
      expect(mockOpen).toHaveBeenCalledWith('/ballot/test-1', '_blank')
    })

    test('should show confirmation dialog when delete clicked', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockAdminBallots })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Deleted' }) })
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        const deleteButton = screen.getAllByText('Delete')[0]
        fireEvent.click(deleteButton)
      })
      
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.stringContaining('Should we implement dark mode?')
      )
    })

    test('should not delete if user cancels confirmation', async () => {
      mockConfirm.mockReturnValue(false)
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        const deleteButton = screen.getAllByText('Delete')[0]
        fireEvent.click(deleteButton)
      })
      
      expect(mockConfirm).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only initial fetch, no delete request
    })

    test('should make delete request when confirmed', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockAdminBallots })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Deleted' }) })
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        const deleteButton = screen.getAllByText('Delete')[0]
        fireEvent.click(deleteButton)
      })
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'https://ballot-app-server.siener.workers.dev/api/admin/ballots/test-1',
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid-admin-key'
            })
          })
        )
      })
    })

    test('should show deleting state during delete operation', async () => {
      mockConfirm.mockReturnValue(true)
      
      // Make delete request hang to test loading state
      let resolveDelete: (value: any) => void
      const deletePromise = new Promise(resolve => { resolveDelete = resolve })
      
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockAdminBallots })
        .mockReturnValueOnce(deletePromise)
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        const deleteButton = screen.getAllByText('Delete')[0]
        fireEvent.click(deleteButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })
      
      // Resolve the delete request
      resolveDelete!({ ok: true, json: async () => ({ message: 'Deleted' }) })
    })

    test('should handle delete error gracefully', async () => {
      mockConfirm.mockReturnValue(true)
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockAdminBallots })
        .mockResolvedValueOnce({ ok: false })
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        const deleteButton = screen.getAllByText('Delete')[0]
        fireEvent.click(deleteButton)
      })
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to delete ballot. Please try again.')
      })
    })
  })

  describe('Vote Count Calculations', () => {
    test('should calculate vote counts by color correctly', () => {
      const ballot = {
        votes: [
          { color: 'green', comment: 'Yes', createdAt: '2024-01-01T10:00:00Z' },
          { color: 'green', comment: '', createdAt: '2024-01-01T11:00:00Z' },
          { color: 'yellow', comment: 'Maybe', createdAt: '2024-01-01T12:00:00Z' },
          { color: 'red', comment: 'No', createdAt: '2024-01-01T13:00:00Z' }
        ]
      }

      const countVotesByColor = (ballot: any, color: string) => {
        return ballot.votes.filter((vote: any) => vote.color === color).length
      }

      expect(countVotesByColor(ballot, 'green')).toBe(2)
      expect(countVotesByColor(ballot, 'yellow')).toBe(1)
      expect(countVotesByColor(ballot, 'red')).toBe(1)
    })
  })

  describe('Security Features', () => {
    test('should include authorization header in API requests', async () => {
      mockSearchParams.set('key', 'test-admin-key-123')
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'https://ballot-app-server.siener.workers.dev/api/admin/ballots',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-admin-key-123'
            })
          })
        )
      })
    })

    test('should show security warning in footer', async () => {
      mockSearchParams.set('key', 'valid-admin-key')
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('⚠️ This is a secure admin interface. All actions are logged.')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockSearchParams.set('key', 'valid-admin-key')
    })

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument()
        expect(screen.getByText('Failed to load admin data')).toBeInTheDocument()
      })
    })

    test('should handle 500 server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })
      
      render(<AdminPanelWithRouter />)
      
      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument()
        expect(screen.getByText('Failed to load admin data')).toBeInTheDocument()
      })
    })
  })
})