import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from "./ui/button"
import { Input } from "./ui/input"

const API_URL = 'https://ballot-app-server.siener.workers.dev/api/ballots'

type Ballot = {
  id: string
  question: string
  votes: Array<{
    color: 'green' | 'yellow' | 'red'
    comment?: string
  }>
  createdAt: string
}

export function BallotList() {
  const navigate = useNavigate()
  const [ballots, setBallots] = useState<Ballot[]>([])
  const [loading, setLoading] = useState(true)
  const [newBallotQuestion, setNewBallotQuestion] = useState('')

  useEffect(() => {
    fetchBallots()
  }, [])

  const fetchBallots = async () => {
    try {
      const response = await fetch(API_URL)
      if (!response.ok) throw new Error('Failed to fetch ballots')
      const data = await response.json()
      setBallots(data)
    } catch (error) {
      console.error('Error fetching ballots:', error)
      setBallots([])
    } finally {
      setLoading(false)
    }
  }

  const createBallot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBallotQuestion.trim()) return

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: newBallotQuestion.trim() }),
      })
      if (!response.ok) throw new Error('Failed to create ballot')
      const newBallot = await response.json()
      setBallots([newBallot, ...ballots])
      setNewBallotQuestion('')
    } catch (error) {
      console.error('Error creating ballot:', error)
    }
  }

  const countVotes = (ballot: Ballot, color: 'green' | 'yellow' | 'red') => {
    return ballot.votes.filter(vote => vote.color === color).length
  }

  const countComments = (ballot: Ballot) => {
    return ballot.votes.filter(vote => vote.comment && vote.comment.trim() !== '').length
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="mb-6 p-4 bg-white rounded-md shadow-sm">
        <h1 className="text-xl mb-4">Create a ballot by asking a question you want feedback to...</h1>
        <form onSubmit={createBallot} className="flex gap-2">
          <Input
            type="text"
            value={newBallotQuestion}
            onChange={(e) => setNewBallotQuestion(e.target.value)}
            placeholder="Enter your ballot question"
            className="flex-grow"
          />
          <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">
            Create Ballot
          </Button>
        </form>
      </div>
      
      <div className="space-y-4">
        {ballots.map(ballot => (
          <div 
            key={ballot.id} 
            className="bg-white border rounded-md p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/ballot/${ballot.id}`)}
          >
            <h2 className="text-lg font-semibold text-blue-600 mb-1">{ballot.question}</h2>
            <p className="text-sm text-gray-600 mb-2">
              {ballot.votes.length} votes and {countComments(ballot)} comments
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-green-500 mr-1"></div>
                <span>{countVotes(ballot, 'green')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-yellow-500 mr-1"></div>
                <span>{countVotes(ballot, 'yellow')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-500 mr-1"></div>
                <span>{countVotes(ballot, 'red')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {ballots.length === 0 && (
        <div className="text-center text-gray-600 mt-8 bg-white p-8 rounded-md">
          <p>No ballots created yet. Be the first to create one!</p>
        </div>
      )}
    </div>
  )
}