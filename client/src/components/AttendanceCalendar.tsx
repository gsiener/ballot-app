import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Attendance } from 'shared/dist'

interface AttendanceCalendarProps {
  attendances: Attendance[]
  onCreateAttendance: (title: string, date: string) => Promise<Attendance>
}

interface CalendarDay {
  date: Date
  dateStr: string
  isCurrentMonth: boolean
  isToday: boolean
}

function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatAttendanceTitle(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return `Attendance for ${date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })}`
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate()
}

export function AttendanceCalendar({ attendances, onCreateAttendance }: AttendanceCalendarProps) {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [isCreating, setIsCreating] = useState<string | null>(null)

  // Build attendance lookup map: date string -> attendance
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, Attendance>()
    attendances.forEach(a => {
      map.set(a.date, a)
    })
    return map
  }, [attendances])

  // Generate calendar grid for current month
  const calendarDays = useMemo((): CalendarDay[] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startDayOfWeek = firstDayOfMonth.getDay()

    const days: CalendarDay[] = []
    const today = new Date()

    // Add padding days from previous month
    const prevMonth = new Date(year, month, 0)
    const prevMonthDays = prevMonth.getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i
      const date = new Date(year, month - 1, day)
      days.push({
        date,
        dateStr: formatDateString(date),
        isCurrentMonth: false,
        isToday: false
      })
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push({
        date,
        dateStr: formatDateString(date),
        isCurrentMonth: true,
        isToday: isSameDay(date, today)
      })
    }

    // Add padding days from next month to complete grid (6 rows x 7 days = 42)
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day)
      days.push({
        date,
        dateStr: formatDateString(date),
        isCurrentMonth: false,
        isToday: false
      })
    }

    return days
  }, [currentDate])

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleDayClick = async (dateStr: string) => {
    const existing = attendanceByDate.get(dateStr)
    if (existing) {
      navigate(`/attendance/${existing.id}`)
    } else {
      setIsCreating(dateStr)
      try {
        const title = formatAttendanceTitle(dateStr)
        const newAttendance = await onCreateAttendance(title, dateStr)
        navigate(`/attendance/${newAttendance.id}`)
      } catch (error) {
        console.error('Failed to create attendance:', error)
        alert('Failed to create attendance. Please try again.')
      } finally {
        setIsCreating(null)
      }
    }
  }

  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-4 mb-6">
      {/* Header with month/year and navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePreviousMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <h2 className="text-lg font-semibold">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const hasAttendance = attendanceByDate.has(day.dateStr)
          const isCreatingThisDay = isCreating === day.dateStr

          return (
            <button
              key={day.dateStr}
              onClick={() => handleDayClick(day.dateStr)}
              disabled={isCreatingThisDay}
              className={cn(
                'relative aspect-square p-1 text-sm rounded-md transition-colors',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                !day.isCurrentMonth && 'text-muted-foreground/50',
                day.isToday && 'ring-2 ring-blue-500',
                hasAttendance && 'bg-blue-100 dark:bg-blue-900/50 font-medium',
                isCreatingThisDay && 'opacity-50 cursor-wait'
              )}
            >
              <span className="flex items-center justify-center h-full">
                {day.date.getDate()}
              </span>
              {/* Attendance indicator dot */}
              {hasAttendance && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          <span>Has attendance</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 ring-2 ring-blue-500 rounded" />
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}
