import { describe, test, expect, beforeEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useDashboards } from './useDashboards'

describe('useDashboards Hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('should initialize with empty dashboards', () => {
    const { result } = renderHook(() => useDashboards())

    expect(result.current.dashboards).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  test('should create a new dashboard', () => {
    const { result } = renderHook(() => useDashboards())

    let createdDashboard
    act(() => {
      createdDashboard = result.current.createDashboard('Q1 Team Surveys')
    })

    expect(result.current.dashboards).toHaveLength(1)
    expect(result.current.dashboards[0].name).toBe('Q1 Team Surveys')
    expect(result.current.dashboards[0].ballotIds).toEqual([])
    expect(result.current.dashboards[0].id).toBeDefined()
    expect(result.current.dashboards[0].createdAt).toBeDefined()
  })

  test('should update dashboard name', () => {
    const { result } = renderHook(() => useDashboards())

    let dashboardId: string
    act(() => {
      const dashboard = result.current.createDashboard('Original Name')
      dashboardId = dashboard.id
    })

    act(() => {
      result.current.updateDashboard(dashboardId, { name: 'Updated Name' })
    })

    expect(result.current.dashboards[0].name).toBe('Updated Name')
  })

  test('should delete dashboard', () => {
    const { result } = renderHook(() => useDashboards())

    let dashboardId: string
    act(() => {
      const dashboard = result.current.createDashboard('To Delete')
      dashboardId = dashboard.id
    })

    expect(result.current.dashboards).toHaveLength(1)

    act(() => {
      result.current.deleteDashboard(dashboardId)
    })

    expect(result.current.dashboards).toHaveLength(0)
  })

  test('should get dashboard by id', () => {
    const { result } = renderHook(() => useDashboards())

    let dashboardId: string
    act(() => {
      const dashboard = result.current.createDashboard('Test Dashboard')
      dashboardId = dashboard.id
    })

    const foundDashboard = result.current.getDashboard(dashboardId)
    expect(foundDashboard).toBeDefined()
    expect(foundDashboard?.name).toBe('Test Dashboard')

    const notFound = result.current.getDashboard('non-existent-id')
    expect(notFound).toBeUndefined()
  })

  test('should add ballot to dashboard', () => {
    const { result } = renderHook(() => useDashboards())

    let dashboardId: string
    act(() => {
      const dashboard = result.current.createDashboard('Test Dashboard')
      dashboardId = dashboard.id
    })

    act(() => {
      result.current.addBallot(dashboardId, 'ballot-123')
    })

    expect(result.current.dashboards[0].ballotIds).toContain('ballot-123')
    expect(result.current.dashboards[0].ballotIds).toHaveLength(1)
  })

  test('should not add duplicate ballots', () => {
    const { result } = renderHook(() => useDashboards())

    let dashboardId: string
    act(() => {
      const dashboard = result.current.createDashboard('Test Dashboard')
      dashboardId = dashboard.id
    })

    act(() => {
      result.current.addBallot(dashboardId, 'ballot-123')
      result.current.addBallot(dashboardId, 'ballot-123')
    })

    expect(result.current.dashboards[0].ballotIds).toHaveLength(1)
  })

  test('should remove ballot from dashboard', () => {
    const { result } = renderHook(() => useDashboards())

    let dashboardId: string
    act(() => {
      const dashboard = result.current.createDashboard('Test Dashboard')
      dashboardId = dashboard.id
    })

    act(() => {
      result.current.addBallot(dashboardId, 'ballot-123')
    })

    act(() => {
      result.current.addBallot(dashboardId, 'ballot-456')
    })

    expect(result.current.dashboards[0].ballotIds).toHaveLength(2)

    act(() => {
      result.current.removeBallot(dashboardId, 'ballot-123')
    })

    expect(result.current.dashboards[0].ballotIds).toHaveLength(1)
    expect(result.current.dashboards[0].ballotIds).toContain('ballot-456')
    expect(result.current.dashboards[0].ballotIds).not.toContain('ballot-123')
  })

  test('should persist dashboards to localStorage', () => {
    const { result } = renderHook(() => useDashboards())

    act(() => {
      result.current.createDashboard('Persisted Dashboard')
    })

    const stored = localStorage.getItem('dashboards')
    expect(stored).toBeDefined()

    const parsed = JSON.parse(stored!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('Persisted Dashboard')
  })

  test('should load dashboards from localStorage on mount', () => {
    const mockDashboard = {
      id: 'test-id',
      name: 'Existing Dashboard',
      ballotIds: ['ballot-1'],
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    }

    localStorage.setItem('dashboards', JSON.stringify([mockDashboard]))

    const { result } = renderHook(() => useDashboards())

    expect(result.current.dashboards).toHaveLength(1)
    expect(result.current.dashboards[0].name).toBe('Existing Dashboard')
    expect(result.current.dashboards[0].ballotIds).toContain('ballot-1')
  })

  test('should trim whitespace from dashboard names', () => {
    const { result } = renderHook(() => useDashboards())

    act(() => {
      result.current.createDashboard('  Trimmed Name  ')
    })

    expect(result.current.dashboards[0].name).toBe('Trimmed Name')
  })

  test('should update updatedAt timestamp on changes', () => {
    const { result } = renderHook(() => useDashboards())

    let dashboardId: string
    let originalUpdatedAt: string

    act(() => {
      const dashboard = result.current.createDashboard('Test Dashboard')
      dashboardId = dashboard.id
      originalUpdatedAt = dashboard.updatedAt
    })

    // Wait a moment to ensure timestamp changes
    setTimeout(() => {
      act(() => {
        result.current.addBallot(dashboardId, 'ballot-123')
      })

      const updatedDashboard = result.current.getDashboard(dashboardId)
      expect(updatedDashboard?.updatedAt).not.toBe(originalUpdatedAt)
    }, 10)
  })
})
