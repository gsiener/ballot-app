import { describe, test, expect, beforeEach } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { BallotList } from './BallotList'
import { BallotDetail } from './BallotDetail'

const mockBallots = [
  {
    id: 'test-1',
    question: 'Should we implement dark mode?',
    votes: [
      { color: 'green' as const, comment: 'Yes!', createdAt: '2024-01-01T10:00:00Z' },
      { color: 'yellow' as const, comment: 'Maybe', createdAt: '2024-01-01T11:00:00Z' }
    ],
    createdAt: '2024-01-01T09:00:00Z'
  }
]

describe('Dark Mode Integration Tests', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock: Record<string, string> = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageMock[key] || null,
        setItem: (key: string, value: string) => {
          localStorageMock[key] = value
        }
      },
      writable: true
    })

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      }),
      writable: true
    })

    // Mock fetch
    global.fetch = async () => ({
      ok: true,
      json: async () => mockBallots
    }) as Response

    document.documentElement.classList.remove('dark')
  })

  describe('BallotList Dark Mode Styling', () => {
    test('should use theme-aware color classes', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Check for cards using theme colors
        const cards = document.querySelectorAll('.bg-card')
        expect(cards.length).toBeGreaterThan(0)
      })
    })

    test('should use semantic color tokens for text', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Check for muted foreground color
        const mutedText = document.querySelector('.text-muted-foreground')
        expect(mutedText).toBeInTheDocument()
      })
    })

    test('should use theme-aware borders', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Check for border-border class
        const borders = document.querySelectorAll('.border-border')
        expect(borders.length).toBeGreaterThan(0)
      })
    })

    test('should have dark mode variants for action buttons', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        const createButton = screen.getByText('Create Ballot')
        expect(createButton).toHaveClass('dark:bg-red-600')
      })
    })

    test('should use primary color for links', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        const heading = screen.getByText('Should we implement dark mode?')
        expect(heading).toHaveClass('text-primary')
      })
    })
  })

  describe('BallotDetail Dark Mode Styling', () => {
    const mockOnBack = () => {}

    test('should use theme-aware card background', () => {
      render(
        <BrowserRouter>
          <BallotDetail ballotId="test-1" onBack={mockOnBack} />
        </BrowserRouter>
      )

      waitFor(() => {
        const card = document.querySelector('.bg-card')
        expect(card).toBeInTheDocument()
      })
    })

    test('should use theme colors for text', () => {
      render(
        <BrowserRouter>
          <BallotDetail ballotId="test-1" onBack={mockOnBack} />
        </BrowserRouter>
      )

      waitFor(() => {
        const mutedText = document.querySelector('.text-muted-foreground')
        expect(mutedText).toBeInTheDocument()
      })
    })

    test('should use muted background for comments', () => {
      render(
        <BrowserRouter>
          <BallotDetail ballotId="test-1" onBack={mockOnBack} />
        </BrowserRouter>
      )

      waitFor(() => {
        // Comments should use bg-muted
        const commentSections = document.querySelectorAll('.bg-muted')
        expect(commentSections.length).toBeGreaterThan(0)
      })
    })

    test('should have dark mode variants for vote button', () => {
      render(
        <BrowserRouter>
          <BallotDetail ballotId="test-1" onBack={mockOnBack} />
        </BrowserRouter>
      )

      waitFor(() => {
        const voteButton = screen.getByText('Vote Now')
        expect(voteButton).toHaveClass('dark:bg-red-600')
      })
    })
  })

  describe('Theme Color Consistency', () => {
    test('should use consistent background colors across components', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // All cards should use bg-card
        const cards = document.querySelectorAll('.bg-card')
        expect(cards.length).toBeGreaterThan(0)

        // Check that they also have text-card-foreground
        const cardForegrounds = document.querySelectorAll('.text-card-foreground')
        expect(cardForegrounds.length).toBeGreaterThan(0)
      })
    })

    test('should use consistent border colors', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // All borders should use border-border
        const borders = document.querySelectorAll('.border-border')
        expect(borders.length).toBeGreaterThan(0)
      })
    })

    test('should use semantic color tokens instead of hardcoded colors', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Should not use hardcoded gray colors in theme-aware areas
        const container = document.querySelector('.container')
        expect(container).toBeInTheDocument()

        // Should use semantic tokens like text-muted-foreground
        const semanticColors = document.querySelectorAll('[class*="text-muted-foreground"]')
        expect(semanticColors.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Dark Mode Class Application', () => {
    test('should support dark mode when dark class is present', async () => {
      // Apply dark mode
      document.documentElement.classList.add('dark')

      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Verify that dark mode class is present
        expect(document.documentElement.classList.contains('dark')).toBe(true)

        // Components should still render correctly
        expect(screen.getByText(/Create a ballot/i)).toBeInTheDocument()
      })
    })

    test('should maintain styling in light mode', async () => {
      // Ensure light mode
      document.documentElement.classList.remove('dark')

      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Verify that dark mode class is not present
        expect(document.documentElement.classList.contains('dark')).toBe(false)

        // Components should render correctly
        expect(screen.getByText(/Create a ballot/i)).toBeInTheDocument()
      })
    })
  })

  describe('Color Accessibility', () => {
    test('should maintain vote color visibility in both modes', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Vote colors (green, yellow, red) should remain consistent
        // These are semantic colors that work in both modes
        const voteIndicators = screen.getAllByText(/✅|⚠️|❌/)
        expect(voteIndicators.length).toBeGreaterThan(0)
      })
    })

    test('should use appropriate contrast colors for different themes', async () => {
      render(
        <BrowserRouter>
          <BallotList />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Check that semantic color classes are used
        // These provide appropriate contrast in both themes
        const primaryText = document.querySelector('.text-primary')
        const mutedText = document.querySelector('.text-muted-foreground')

        expect(primaryText || mutedText).toBeInTheDocument()
      })
    })
  })
})

describe('Dark Mode Edge Cases', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {}
      },
      writable: true
    })

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      }),
      writable: true
    })

    // Mock fetch
    global.fetch = async () => ({
      ok: true,
      json: async () => []
    }) as Response

    document.documentElement.classList.remove('dark')
  })

  test('should handle empty state with dark mode colors', async () => {
    render(
      <BrowserRouter>
        <BallotList />
      </BrowserRouter>
    )

    await waitFor(() => {
      const emptyMessage = screen.getByText(/No ballots created yet/i)
      expect(emptyMessage).toBeInTheDocument()

      // Empty state should use theme colors
      const emptyContainer = emptyMessage.closest('div')
      expect(emptyContainer).toHaveClass('bg-card')
    })
  })

  test('should handle loading state with dark mode colors', () => {
    // Mock a delayed fetch to test loading state
    global.fetch = () => new Promise(() => {}) as any

    render(
      <BrowserRouter>
        <BallotList />
      </BrowserRouter>
    )

    // Loading state should be visible
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
