import { useState, useEffect } from 'react'
import type { Attendance } from 'shared/dist'
import { attendanceApi, ApiError } from '../api/client'

export function useAttendance() {
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all attendances from API
  const fetchAttendances = async () => {
    try {
      setLoading(true)
      setError(null)
      setAttendances(await attendanceApi.getAll())
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
      const newAttendance = await attendanceApi.create(title, date)
      setAttendances(prev => [newAttendance, ...prev])
      return newAttendance
    } catch (err) {
      console.error('Error creating attendance:', err)
      throw err
    }
  }

  const getAttendance = async (id: string): Promise<Attendance | null> => {
    try {
      return await attendanceApi.getById(id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null
      }
      console.error('Error fetching attendance:', err)
      throw err
    }
  }

  const addResponse = async (id: string, name: string, attending: boolean): Promise<Attendance> => {
    try {
      const updatedAttendance = await attendanceApi.respond(id, name, attending)
      setAttendances(prev => prev.map(a => a.id === id ? updatedAttendance : a))
      return updatedAttendance
    } catch (err) {
      console.error('Error adding response:', err)
      throw err
    }
  }

  const deleteAttendance = async (id: string, adminKey: string) => {
    try {
      await attendanceApi.delete(adminKey, id)
      setAttendances(prev => prev.filter(a => a.id !== id))
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
