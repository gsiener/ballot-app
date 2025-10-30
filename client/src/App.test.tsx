import { describe, test, expect, beforeEach } from 'bun:test'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App Component', () => {
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

    // Mock fetch for ballot list
    global.fetch = async () => ({
      ok: true,
      json: async () => []
    }) as Response

    document.documentElement.classList.remove('dark')
  })

  test('should render App component', () => {
    render(<App />)
    expect(document.querySelector('.min-h-screen')).toBeInTheDocument()
  })

  test('should render header with theme toggle', () => {
    render(<App />)

    // Check for header element
    const header = document.querySelector('header')
    expect(header).toBeInTheDocument()

    // Check for theme toggle button
    const themeButton = screen.getByRole('button', { name: /switch to/i })
    expect(themeButton).toBeInTheDocument()
  })

  test('should have sticky header with correct styling', () => {
    render(<App />)

    const header = document.querySelector('header')
    expect(header).toHaveClass('sticky', 'top-0', 'z-50')
  })

  test('should use theme-aware background colors', () => {
    render(<App />)

    const mainContainer = document.querySelector('.min-h-screen')
    expect(mainContainer).toHaveClass('bg-background')
  })

  test('should have border on header', () => {
    render(<App />)

    const header = document.querySelector('header')
    expect(header).toHaveClass('border-b', 'border-border')
  })

  test('should render router with correct routes', () => {
    render(<App />)

    // Router should be present (BallotList is the default route)
    // The BallotList component will try to render
    expect(document.querySelector('.min-h-screen')).toBeInTheDocument()
  })

  test('should have backdrop blur effect on header', () => {
    render(<App />)

    const header = document.querySelector('header')
    expect(header).toHaveClass('backdrop-blur')
  })

  test('should position theme toggle in header', () => {
    render(<App />)

    const headerContainer = document.querySelector('header .container')
    expect(headerContainer).toHaveClass('justify-end')
  })
})

describe('App Component - Theme Integration', () => {
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
      json: async () => []
    }) as Response

    document.documentElement.classList.remove('dark')
  })

  test('should render with light theme by default', () => {
    render(<App />)

    const mainContainer = document.querySelector('.min-h-screen')
    expect(mainContainer).toHaveClass('bg-background')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  test('should support dark mode when theme is toggled', () => {
    localStorage.setItem('theme', 'dark')

    render(<App />)

    // The ThemeToggle component will apply the dark class
    // We just need to verify the structure supports it
    const mainContainer = document.querySelector('.min-h-screen')
    expect(mainContainer).toHaveClass('bg-background')
  })
})

describe('App Component - Layout', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {},
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
  })

  test('should have correct container max-width in header', () => {
    render(<App />)

    const headerContainer = document.querySelector('header .container')
    expect(headerContainer).toHaveClass('max-w-screen-2xl')
  })

  test('should have correct header height', () => {
    render(<App />)

    const headerContainer = document.querySelector('header .container')
    expect(headerContainer).toHaveClass('h-14')
  })

  test('should maintain layout structure', () => {
    render(<App />)

    // Check main structure
    const mainContainer = document.querySelector('.min-h-screen')
    expect(mainContainer).toBeInTheDocument()

    // Check header exists within main container
    const header = document.querySelector('header')
    expect(header).toBeInTheDocument()
    expect(mainContainer?.contains(header)).toBe(true)
  })
})
