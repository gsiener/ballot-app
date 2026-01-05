import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { BallotList } from './components/BallotList'
import { BallotDetailPage } from './components/BallotDetailPage'
import { AdminPanel } from './components/AdminPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { DashboardsPage } from './pages/DashboardsPage'
import { DashboardDetailPage } from './pages/DashboardDetailPage'
import { AttendanceListPage } from './pages/AttendanceListPage'
import { AttendanceDetailPage } from './pages/AttendanceDetailPage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
            <a href="/" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
              Ballots
            </a>
            <ThemeToggle />
          </div>
        </header>
        <Routes>
          <Route path="/" element={<BallotList />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/dashboards" element={<DashboardsPage />} />
          <Route path="/dashboards/:id" element={<DashboardDetailPage />} />
          <Route path="/attendance" element={<AttendanceListPage />} />
          <Route path="/attendance/:id" element={<AttendanceDetailPage />} />
          <Route path="/ballot/:id" element={<BallotDetailPage />} />
          <Route path="/:id" element={<BallotDetailPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
