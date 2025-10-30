import { useState, useEffect } from 'react'
import { Dashboard } from '../types/dashboard'

const API_URL = import.meta.env.VITE_API_URL || 'https://ballot-app-server.siener.workers.dev'

export function useDashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all dashboards from API
  const fetchDashboards = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_URL}/api/dashboards`)
      if (!response.ok) {
        throw new Error('Failed to fetch dashboards')
      }
      const data = await response.json()
      setDashboards(data)
    } catch (err) {
      console.error('Error fetching dashboards:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Load dashboards on mount
  useEffect(() => {
    fetchDashboards()
  }, [])

  const createDashboard = async (name: string): Promise<Dashboard> => {
    try {
      const response = await fetch(`${API_URL}/api/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })

      if (!response.ok) {
        throw new Error('Failed to create dashboard')
      }

      const newDashboard = await response.json()
      setDashboards([...dashboards, newDashboard])
      return newDashboard
    } catch (err) {
      console.error('Error creating dashboard:', err)
      throw err
    }
  }

  const updateDashboard = async (id: string, updates: Partial<Dashboard>) => {
    try {
      const dashboard = dashboards.find(d => d.id === id)
      if (!dashboard) {
        throw new Error('Dashboard not found')
      }

      const response = await fetch(`${API_URL}/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update dashboard')
      }

      const updatedDashboard = await response.json()
      setDashboards(dashboards.map(d => d.id === id ? updatedDashboard : d))
    } catch (err) {
      console.error('Error updating dashboard:', err)
      throw err
    }
  }

  const deleteDashboard = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete dashboard')
      }

      setDashboards(dashboards.filter(d => d.id !== id))
    } catch (err) {
      console.error('Error deleting dashboard:', err)
      throw err
    }
  }

  const getDashboard = (id: string): Dashboard | undefined => {
    return dashboards.find(d => d.id === id)
  }

  const addBallot = async (dashboardId: string, ballotId: string) => {
    try {
      const dashboard = dashboards.find(d => d.id === dashboardId)
      if (!dashboard) {
        throw new Error('Dashboard not found')
      }

      // Use Set to avoid duplicates
      const updatedBallotIds = [...new Set([...dashboard.ballotIds, ballotId])]

      await updateDashboard(dashboardId, { ballotIds: updatedBallotIds })
    } catch (err) {
      console.error('Error adding ballot to dashboard:', err)
      throw err
    }
  }

  const removeBallot = async (dashboardId: string, ballotId: string) => {
    try {
      const dashboard = dashboards.find(d => d.id === dashboardId)
      if (!dashboard) {
        throw new Error('Dashboard not found')
      }

      const updatedBallotIds = dashboard.ballotIds.filter(id => id !== ballotId)

      await updateDashboard(dashboardId, { ballotIds: updatedBallotIds })
    } catch (err) {
      console.error('Error removing ballot from dashboard:', err)
      throw err
    }
  }

  return {
    dashboards,
    loading,
    error,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    getDashboard,
    addBallot,
    removeBallot,
    refetch: fetchDashboards
  }
}
