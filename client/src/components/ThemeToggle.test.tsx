import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle Component', () => {
  let originalLocalStorage: Storage
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    // Save original localStorage and matchMedia
    originalLocalStorage = window.localStorage
    originalMatchMedia = window.matchMedia

    // Clear dark class from document first
    document.documentElement.classList.remove('dark')

    // Clear localStorage
    localStorage.clear()

    // Mock matchMedia to return light mode by default
    Object.defineProperty(window, 'matchMedia', {
      value: mock((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: mock(),
        removeEventListener: mock(),
        dispatchEvent: mock()
      })),
      writable: true
    })
  })

  afterEach(() => {
    // Restore original implementations
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    })
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true
    })
    document.documentElement.classList.remove('dark')
  })

  test('should render with moon icon in light mode', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  test('should render with sun icon in dark mode', () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeToggle />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode')
  })

  test('should toggle theme on click', async () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')

    // Initially light mode
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBeNull()

    // Click to toggle to dark mode
    fireEvent.click(button)

    // DOM and localStorage update immediately
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')

    // Wait for React re-render to update aria-label
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode')
    })

    // Click again to toggle back to light mode
    fireEvent.click(button)

    // DOM and localStorage update immediately
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode')
    })
  })

  test('should persist theme preference to localStorage', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')

    // Toggle to dark mode
    fireEvent.click(button)
    expect(localStorage.getItem('theme')).toBe('dark')

    // Toggle back to light mode
    fireEvent.click(button)
    expect(localStorage.getItem('theme')).toBe('light')
  })

  test('should load saved theme from localStorage on mount', () => {
    localStorage.setItem('theme', 'dark')

    render(<ThemeToggle />)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to light mode')
  })

  test('should respect system preference when no saved theme', () => {
    // Mock system preference for dark mode
    Object.defineProperty(window, 'matchMedia', {
      value: mock((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: mock(),
        removeEventListener: mock(),
        dispatchEvent: mock()
      })),
      writable: true
    })

    render(<ThemeToggle />)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  test('should prefer saved theme over system preference', () => {
    // Set saved theme to light
    localStorage.setItem('theme', 'light')

    // Mock system preference for dark mode
    Object.defineProperty(window, 'matchMedia', {
      value: mock((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: mock(),
        removeEventListener: mock(),
        dispatchEvent: mock()
      })),
      writable: true
    })

    render(<ThemeToggle />)

    // Should use saved light theme, not system dark preference
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  test('should apply dark class to document root element', async () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')
    const rootElement = document.documentElement

    // Initially light mode
    expect(rootElement.classList.contains('dark')).toBe(false)

    // Toggle to dark mode
    fireEvent.click(button)

    await waitFor(() => {
      expect(rootElement.classList.contains('dark')).toBe(true)
    })

    // Toggle back to light mode
    fireEvent.click(button)

    await waitFor(() => {
      expect(rootElement.classList.contains('dark')).toBe(false)
    })
  })

  test('should have correct button styling', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')

    // Check for expected classes (from Button component)
    expect(button).toHaveClass('h-9', 'w-9', 'p-0')
  })
})


describe('ThemeToggle Accessibility', () => {
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
      value: mock((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: mock(),
        removeEventListener: mock(),
        dispatchEvent: mock()
      })),
      writable: true
    })

    document.documentElement.classList.remove('dark')
  })

  test('should have accessible button label', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label')
  })

  test('should update aria-label when theme changes', async () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')

    // Initially light mode
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode')

    // Toggle to dark mode
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode')
    })
  })

  test('should be keyboard accessible', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')

    // Should be focusable
    button.focus()
    expect(document.activeElement).toBe(button)
  })
})
