import { useState, useEffect } from 'react'
import { Dashboard } from '../types/dashboard'

const STORAGE_KEY = 'dashboards'

export function useDashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setDashboards(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to parse dashboards from localStorage:', error)
      }
    }
    setLoading(false)
  }, [])

  const save = (newDashboards: Dashboard[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDashboards))
    setDashboards(newDashboards)
  }

  const createDashboard = (name: string): Dashboard => {
    const newDashboard: Dashboard = {
      id: crypto.randomUUID(),
      name: name.trim(),
      ballotIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    save([...dashboards, newDashboard])
    return newDashboard
  }

  const updateDashboard = (id: string, updates: Partial<Dashboard>) => {
    save(
      dashboards.map(d =>
        d.id === id
          ? { ...d, ...updates, updatedAt: new Date().toISOString() }
          : d
      )
    )
  }

  const deleteDashboard = (id: string) => {
    save(dashboards.filter(d => d.id !== id))
  }

  const getDashboard = (id: string): Dashboard | undefined => {
    return dashboards.find(d => d.id === id)
  }

  const addBallot = (dashboardId: string, ballotId: string) => {
    save(
      dashboards.map(d =>
        d.id === dashboardId
          ? {
              ...d,
              ballotIds: [...new Set([...d.ballotIds, ballotId])], // Use Set to avoid duplicates
              updatedAt: new Date().toISOString()
            }
          : d
      )
    )
  }

  const removeBallot = (dashboardId: string, ballotId: string) => {
    save(
      dashboards.map(d =>
        d.id === dashboardId
          ? {
              ...d,
              ballotIds: d.ballotIds.filter(id => id !== ballotId),
              updatedAt: new Date().toISOString()
            }
          : d
      )
    )
  }

  return {
    dashboards,
    loading,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    getDashboard,
    addBallot,
    removeBallot
  }
}
