import { useState } from 'react'
import { BallotList } from './components/BallotList'
import { BallotDetail } from './components/BallotDetail'
import { Button } from './components/ui/button'

type View = 'list' | 'detail'

function App() {
  const [currentView, setCurrentView] = useState<View>('list')
  const [selectedBallotId, setSelectedBallotId] = useState<string | null>(null)

  const handleViewBallot = (ballotId: string) => {
    setSelectedBallotId(ballotId)
    setCurrentView('detail')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedBallotId(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'list' ? (
        <BallotList onViewBallot={handleViewBallot} />
      ) : (
        <div>
          <div className="container mx-auto p-4 max-w-3xl">
            <Button 
              onClick={handleBackToList}
              variant="outline"
              className="mb-4"
            >
              ← Back to Ballots
            </Button>
          </div>
          <BallotDetail ballotId={selectedBallotId!} onBack={handleBackToList} />
        </div>
      )}
    </div>
  )
}

export default App
