import { useState, useEffect } from 'react'
import type { Attendance } from 'shared/dist'

const API_URL = import.meta.env.VITE_API_URL || 'https://ballot-app-server.siener.workers.dev'

export function useAttendance() {
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all attendances from API
  const fetchAttendances = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_URL}/api/attendance`)
      if (!response.ok) {
        throw new Error('Failed to fetch attendances')
      }
      const data = await response.json()
      setAttendances(data)
    } catch (err) {
      console.error('Error fetching attendances:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Load attendances on mount
  useEffect(() => {
    fetchAttendances()
  }, [])

  const createAttendance = async (title: string, date: string): Promise<Attendance> => {
    try {
      const response = await fetch(`${API_URL}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), date })
      })

      if (!response.ok) {
        throw new Error('Failed to create attendance')
      }

      const newAttendance = await response.json()
      setAttendances([newAttendance, ...attendances])
      return newAttendance
    } catch (err) {
      console.error('Error creating attendance:', err)
      throw err
    }
  }

  const getAttendance = async (id: string): Promise<Attendance | null> => {
    try {
      const response = await fetch(`${API_URL}/api/attendance/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to fetch attendance')
      }
      return await response.json()
    } catch (err) {
      console.error('Error fetching attendance:', err)
      throw err
    }
  }

  const addResponse = async (id: string, name: string, attending: boolean): Promise<Attendance> => {
    try {
      const response = await fetch(`${API_URL}/api/attendance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, attending })
      })

      if (!response.ok) {
        throw new Error('Failed to add response')
      }

      const updatedAttendance = await response.json()
      setAttendances(attendances.map(a => a.id === id ? updatedAttendance : a))
      return updatedAttendance
    } catch (err) {
      console.error('Error adding response:', err)
      throw err
    }
  }

  const deleteAttendance = async (id: string, adminKey: string) => {
    try {
      const response = await fetch(`${API_URL}/api/attendance/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminKey}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete attendance')
      }

      setAttendances(attendances.filter(a => a.id !== id))
    } catch (err) {
      console.error('Error deleting attendance:', err)
      throw err
    }
  }

  return {
    attendances,
    loading,
    error,
    createAttendance,
    getAttendance,
    addResponse,
    deleteAttendance,
    refetch: fetchAttendances
  }
}
