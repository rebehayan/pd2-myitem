import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { DashboardPage } from './pages/DashboardPage'
import { OverlayPage } from './pages/OverlayPage'
import { TodayPage } from './pages/TodayPage'

function App() {
  return (
    <div className="shell">
      <header className="shell__header">
        <h1>PD2 Broadcast Item Tracker</h1>
        <p>Local-first item tracking for dashboard, overlay, and today page.</p>
      </header>

      <nav className="shell__nav" aria-label="Main navigation">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/overlay">Overlay</NavLink>
        <NavLink to="/today">Today</NavLink>
      </nav>

      <main className="shell__main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/overlay" element={<OverlayPage />} />
          <Route path="/today" element={<TodayPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
