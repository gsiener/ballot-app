import { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Copy } from 'lucide-react'

const API_URL = 'https://ballot-app-server.siener.workers.dev/api/ballots'

type Vote = {
  color: 'green' | 'yellow' | 'red'
  comment?: string
  createdAt: string
}

type Ballot = {
  id: string
  question: string
  votes: Vote[]
  createdAt: string
}

interface BallotDetailProps {
  ballotId: string
  onBack: () => void
}

export function BallotDetail({ ballotId, onBack }: BallotDetailProps) {
  const [ballot, setBallot] = useState<Ballot | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [copyPressed, setCopyPressed] = useState(false)

  useEffect(() => {
    fetchBallot()
  }, [ballotId])

  const fetchBallot = async () => {
    try {
      const response = await fetch(`${API_URL}/${ballotId}`)
      if (!response.ok) throw new Error('Failed to fetch ballot')
      const data = await response.json()
      setBallot(data)
    } catch (error) {
      console.error('Error fetching ballot:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (color: 'green' | 'yellow' | 'red') => {
    if (!ballot) return

    const newVote: Vote = {
      color,
      comment: comment.trim() || undefined,
      createdAt: new Date().toISOString()
    }

    try {
      const response = await fetch(`${API_URL}/${ballotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...ballot,
          votes: [...ballot.votes, newVote]
        }),
      })
      if (!response.ok) throw new Error('Failed to update ballot')
      const updatedBallot = await response.json()
      setBallot(updatedBallot)
      setComment('')
    } catch (error) {
      console.error('Error updating ballot:', error)
    }
  }

  const countVotes = (color: 'green' | 'yellow' | 'red') => {
    return ballot?.votes.filter(v => v.color === color).length || 0
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  if (!ballot) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="text-center py-8">
          <p>Ballot not found</p>
          <Button onClick={onBack} className="mt-4">Back to Ballots</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="bg-card text-card-foreground shadow-md rounded-lg p-6 border border-border">
        <h1 className="text-3xl font-bold mb-2">{ballot.question}</h1>
        <div className="text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2 mb-1">
            <a
              href={`${window.location.origin}/${ballot.id}`}
              className="font-mono text-primary flex-grow hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {`${window.location.origin}/${ballot.id}`}
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setCopyPressed(true)
                await navigator.clipboard.writeText(`${window.location.origin}/${ballot.id}`)
                setTimeout(() => setCopyPressed(false), 150)
              }}
              className={`h-6 w-6 p-0 transition-all duration-150 ${copyPressed ? 'scale-95 bg-muted' : ''}`}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p>Created {new Date(ballot.createdAt).toLocaleDateString()}</p>
        </div>

        <div className="flex justify-center space-x-8 mb-8">
          {['green', 'yellow', 'red'].map((color) => (
            <div key={color} className="text-center">
              <div className={`w-24 h-24 rounded-full border-4 ${color === 'green' ? 'border-green-500' : color === 'yellow' ? 'border-yellow-500' : 'border-red-500'} flex items-center justify-center`}>
                <span className="text-4xl font-bold">{countVotes(color as 'green' | 'yellow' | 'red')}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 mb-8">
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add an optional comment"
            className="mb-2"
          />
          <div className="grid grid-cols-3 gap-3">
            <Button
              onClick={() => handleVote('green')}
              className="w-full h-12 bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700"
            >
              ✅ Vote Green
            </Button>
            <Button
              onClick={() => handleVote('yellow')}
              className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700"
            >
              ⚠️ Vote Yellow
            </Button>
            <Button
              onClick={() => handleVote('red')}
              className="w-full h-12 bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              ❌ Vote Red
            </Button>
          </div>
        </div>

        {ballot.votes.filter(v => v.comment).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Comments</h2>
            {ballot.votes.filter(v => v.comment).map((vote, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-muted rounded">
              <span className="text-2xl mt-1">
                {vote.color === 'green' ? '✅' : vote.color === 'yellow' ? '⚠️' : '❌'}
              </span>
              <div className="flex-grow">
                <p className="text-foreground">{vote.comment}</p>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(vote.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}