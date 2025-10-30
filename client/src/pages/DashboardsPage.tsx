import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboards } from '../hooks/useDashboards'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Trash2, Eye, Plus } from 'lucide-react'

export function DashboardsPage() {
  const navigate = useNavigate()
  const { dashboards, loading, createDashboard, deleteDashboard } = useDashboards()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDashboardName, setNewDashboardName] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDashboardName.trim()) return

    try {
      const dashboard = await createDashboard(newDashboardName)
      setNewDashboardName('')
      setShowCreateForm(false)
      navigate(`/dashboards/${dashboard.id}`)
    } catch (error) {
      console.error('Failed to create dashboard:', error)
      alert('Failed to create dashboard. Please try again.')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      try {
        await deleteDashboard(id)
      } catch (error) {
        console.error('Failed to delete dashboard:', error)
        alert('Failed to delete dashboard. Please try again.')
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="text-center py-8">Loading dashboards...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Dashboards</h1>
          <p className="text-muted-foreground mt-1">
            Organize and track multiple ballots in one place
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Dashboard
        </Button>
      </div>

      {showCreateForm && (
        <div className="bg-card text-card-foreground border border-border rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Create New Dashboard</h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              type="text"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              placeholder="Dashboard name (e.g., Q1 Team Surveys)"
              className="flex-grow"
              autoFocus
            />
            <Button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              Create
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateForm(false)
                setNewDashboardName('')
              }}
            >
              Cancel
            </Button>
          </form>
        </div>
      )}

      {dashboards.length === 0 ? (
        <div className="text-center py-16 bg-card text-card-foreground border border-border rounded-lg">
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-2">No dashboards yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first dashboard to track multiple ballots in one place
            </p>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-red-500 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="bg-card text-card-foreground border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    {dashboard.name}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {dashboard.ballotIds.length} ballot{dashboard.ballotIds.length !== 1 ? 's' : ''}
                    </span>
                    <span>•</span>
                    <span>Updated {formatDate(dashboard.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboards/${dashboard.id}`)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(dashboard.id, dashboard.name)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
