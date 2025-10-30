import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { BallotList } from './components/BallotList'
import { BallotDetailPage } from './components/BallotDetailPage'
import { AdminPanel } from './components/AdminPanel'
import { ThemeToggle } from './components/ThemeToggle'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-end px-4">
            <ThemeToggle />
          </div>
        </header>
        <Routes>
          <Route path="/" element={<BallotList />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/ballot/:id" element={<BallotDetailPage />} />
          <Route path="/:id" element={<BallotDetailPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
