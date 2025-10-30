import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDashboards } from '../hooks/useDashboards'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ArrowLeft, Plus, X, ExternalLink, Pencil } from 'lucide-react'

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

export function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getDashboard, addBallot, removeBallot, updateDashboard } = useDashboards()

  const dashboard = id ? getDashboard(id) : undefined
  const [ballots, setBallots] = useState<Ballot[]>([])
  const [loading, setLoading] = useState(true)
  const [newBallotInput, setNewBallotInput] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(dashboard?.name || '')

  useEffect(() => {
    if (dashboard) {
      fetchBallots()
      setEditedName(dashboard.name)
    }
  }, [dashboard?.ballotIds])

  const fetchBallots = async () => {
    if (!dashboard) return

    setLoading(true)
    try {
      const ballotPromises = dashboard.ballotIds.map(async (ballotId) => {
        try {
          const response = await fetch(`${API_URL}/${ballotId}`)
          if (!response.ok) return null
          return await response.json()
        } catch {
          return null
        }
      })

      const results = await Promise.all(ballotPromises)
      setBallots(results.filter((b): b is Ballot => b !== null))
    } catch (error) {
      console.error('Error fetching ballots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBallot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBallotInput.trim() || !id) return

    // Extract ballot ID from URL or use as-is
    let ballotId = newBallotInput.trim()

    // Handle full URLs
    if (ballotId.includes('/')) {
      const parts = ballotId.split('/')
      ballotId = parts[parts.length - 1]
    }

    // Verify the ballot exists
    try {
      const response = await fetch(`${API_URL}/${ballotId}`)
      if (!response.ok) {
        alert('Ballot not found. Please check the ID or URL.')
        return
      }

      addBallot(id, ballotId)
      setNewBallotInput('')
    } catch (error) {
      alert('Failed to add ballot. Please try again.')
    }
  }

  const handleRemoveBallot = (ballotId: string) => {
    if (!id) return
    if (window.confirm('Remove this ballot from the dashboard?')) {
      removeBallot(id, ballotId)
    }
  }

  const handleSaveName = () => {
    if (!id || !editedName.trim()) return
    updateDashboard(id, { name: editedName.trim() })
    setIsEditing(false)
  }

  const countVotes = (ballot: Ballot, color: 'green' | 'yellow' | 'red') => {
    return ballot.votes.filter(vote => vote.color === color).length
  }

  const countComments = (ballot: Ballot) => {
    return ballot.votes.filter(vote => vote.comment && vote.comment.trim() !== '').length
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">Dashboard not found</h2>
          <Button onClick={() => navigate('/dashboards')}>
            Back to Dashboards
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/dashboards')}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboards
      </Button>

      <div className="mb-6">
        {isEditing ? (
          <div className="flex items-center gap-2 mb-2">
            <Input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="text-2xl font-bold"
              autoFocus
            />
            <Button onClick={handleSaveName} size="sm">
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsEditing(false)
                setEditedName(dashboard.name)
              }}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{dashboard.name}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 p-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-muted-foreground">
          {dashboard.ballotIds.length} ballot{dashboard.ballotIds.length !== 1 ? 's' : ''} •
          Last updated {new Date(dashboard.updatedAt).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-card text-card-foreground border border-border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Add Ballot</h2>
        <form onSubmit={handleAddBallot} className="flex gap-2">
          <Input
            type="text"
            value={newBallotInput}
            onChange={(e) => setNewBallotInput(e.target.value)}
            placeholder="Paste ballot URL or ID"
            className="flex-grow"
          />
          <Button
            type="submit"
            className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading ballots...</div>
      ) : ballots.length === 0 ? (
        <div className="text-center py-16 bg-card text-card-foreground border border-border rounded-lg">
          <p className="text-muted-foreground">
            No ballots in this dashboard yet. Add one above to get started!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ballots.map((ballot) => (
            <div
              key={ballot.id}
              className="bg-card text-card-foreground border border-border rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-grow pr-4">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {ballot.question}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {ballot.votes.length} votes • {countComments(ballot)} comments
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/${ballot.id}`, '_blank')}
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBallot(ballot.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1">
                  <span className="text-lg">✅</span>
                  <span className="font-medium">{countVotes(ballot, 'green')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium">{countVotes(ballot, 'yellow')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg">❌</span>
                  <span className="font-medium">{countVotes(ballot, 'red')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
