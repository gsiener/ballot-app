import React, { useState, useEffect } from 'react'
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { Label } from "./ui/label"
import { Circle, Copy } from 'lucide-react'

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
  const [newVote, setNewVote] = useState<Vote>({ color: 'green', comment: '', createdAt: '' })
  const [loading, setLoading] = useState(true)

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

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ballot) return

    const updatedVote = {
      ...newVote,
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
          votes: [...ballot.votes, updatedVote]
        }),
      })
      if (!response.ok) throw new Error('Failed to update ballot')
      const updatedBallot = await response.json()
      setBallot(updatedBallot)
      setNewVote({ color: 'green', comment: '', createdAt: '' })
    } catch (error) {
      console.error('Error updating ballot:', error)
    }
  }

  const countVotes = (color: 'green' | 'yellow' | 'red') => {
    return ballot?.votes.filter(v => v.color === color).length || 0
  }

  const getColorClass = (color: string) => {
    switch (color) {
      case 'green': return 'text-green-500'
      case 'yellow': return 'text-yellow-500'
      case 'red': return 'text-red-500'
      default: return ''
    }
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
      <div className="bg-white shadow-md rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-2">{ballot.question}</h1>
        <div className="text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-mono text-blue-600 flex-grow">{window.location.href}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                // Could add a toast notification here
              }}
              className="h-6 w-6 p-0"
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
          {ballot.votes.filter(v => v.comment).map((vote, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded">
              <Circle className={`w-6 h-6 mt-1 ${getColorClass(vote.color)}`} />
              <div className="flex-grow">
                <p className="text-gray-800">{vote.comment}</p>
                <p className="text-sm text-gray-600">
                  Created {new Date(vote.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleVote} className="space-y-4">
          <div>
            <Label className="text-lg font-semibold">Your Vote</Label>
            <RadioGroup 
              value={newVote.color} 
              onValueChange={(value) => setNewVote({ ...newVote, color: value as 'green' | 'yellow' | 'red' })}
              className="flex space-x-4 mt-2"
            >
              {['green', 'yellow', 'red'].map((color) => (
                <div key={color} className="flex items-center">
                  <RadioGroupItem value={color} id={`vote-${color}`} className="sr-only" />
                  <Label
                    htmlFor={`vote-${color}`}
                    className={`w-8 h-8 rounded-full border-2 ${color === 'green' ? 'border-green-500' : color === 'yellow' ? 'border-yellow-500' : 'border-red-500'} flex items-center justify-center cursor-pointer`}
                  >
                    {newVote.color === color && (
                      <div className={`w-4 h-4 rounded-full ${color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="comment" className="text-lg font-semibold">Comment (optional)</Label>
            <Textarea
              id="comment"
              value={newVote.comment}
              onChange={(e) => setNewVote({ ...newVote, comment: e.target.value })}
              placeholder="Add your comment here"
              className="mt-2"
            />
          </div>
          <Button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white">
            Vote Now
          </Button>
        </form>
      </div>
    </div>
  )
}