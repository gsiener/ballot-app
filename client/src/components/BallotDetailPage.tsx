import { useParams, useNavigate } from 'react-router-dom'
import { BallotDetail } from './BallotDetail'
import { Button } from './ui/button'

export function BallotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/')
  }

  if (!id) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="text-center py-8">
          <p>Ballot not found</p>
          <Button onClick={handleBack} className="mt-4">Back to Ballots</Button>
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
          ← Back to Ballots
        </Button>
      </div>
      <BallotDetail ballotId={id} onBack={handleBack} />
    </div>
  )
}