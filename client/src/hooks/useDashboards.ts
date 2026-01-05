import { useState, useEffect } from 'react'
import { dashboardApi, type Dashboard } from '../api/client'

export function useDashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all dashboards from API
  const fetchDashboards = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardApi.getAll()
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
      const newDashboard = await dashboardApi.create(name)
      // Use functional update to avoid stale closure
      setDashboards(prev => [...prev, newDashboard])
      return newDashboard
    } catch (err) {
      console.error('Error creating dashboard:', err)
      throw err
    }
  }

  const updateDashboard = async (id: string, updates: Partial<Dashboard>) => {
    try {
      const updatedDashboard = await dashboardApi.update(id, updates)
      // Use functional update to avoid stale closure
      setDashboards(prev => prev.map(d => d.id === id ? updatedDashboard : d))
    } catch (err) {
      console.error('Error updating dashboard:', err)
      throw err
    }
  }

  const deleteDashboard = async (id: string) => {
    try {
      await dashboardApi.delete(id)
      // Use functional update to avoid stale closure
      setDashboards(prev => prev.filter(d => d.id !== id))
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

  const addAttendance = async (dashboardId: string, attendanceId: string) => {
    try {
      const dashboard = dashboards.find(d => d.id === dashboardId)
      if (!dashboard) {
        throw new Error('Dashboard not found')
      }

      // Use Set to avoid duplicates
      const updatedAttendanceIds = [...new Set([...(dashboard.attendanceIds || []), attendanceId])]

      await updateDashboard(dashboardId, { attendanceIds: updatedAttendanceIds })
    } catch (err) {
      console.error('Error adding attendance to dashboard:', err)
      throw err
    }
  }

  const removeAttendance = async (dashboardId: string, attendanceId: string) => {
    try {
      const dashboard = dashboards.find(d => d.id === dashboardId)
      if (!dashboard) {
        throw new Error('Dashboard not found')
      }

      const updatedAttendanceIds = (dashboard.attendanceIds || []).filter(id => id !== attendanceId)

      await updateDashboard(dashboardId, { attendanceIds: updatedAttendanceIds })
    } catch (err) {
      console.error('Error removing attendance from dashboard:', err)
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
    addAttendance,
    removeAttendance,
    refetch: fetchDashboards
  }
}
