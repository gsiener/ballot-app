import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { BallotList } from './components/BallotList'
import { BallotDetailPage } from './components/BallotDetailPage'
import { AdminPanel } from './components/AdminPanel'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
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
