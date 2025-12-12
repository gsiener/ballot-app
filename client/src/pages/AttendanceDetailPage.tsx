import { useParams, useNavigate } from 'react-router-dom'
import { AttendanceDetail } from '../components/AttendanceDetail'
import { Button } from '../components/ui/button'

export function AttendanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/attendance')
  }

  if (!id) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="text-center py-8">
          <p>Attendance not found</p>
          <Button onClick={handleBack} className="mt-4">Back to Attendance</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="container mx-auto p-4 max-w-3xl">
        <Button
          onClick={handleBack}
          variant="outline"
          className="mb-4"
        >
          ← Back to Attendance
        </Button>
      </div>
      <AttendanceDetail attendanceId={id} onBack={handleBack} />
    </div>
  )
}
