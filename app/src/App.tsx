import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import './components/d2-ui.css'
import { DashboardPage } from './pages/DashboardPage'
import { D2KitPage } from './pages/D2KitPage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { OverlayPage } from './pages/OverlayPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'

function App() {
  const location = useLocation()
  const isOverlayRoute = location.pathname === '/overlay' || location.pathname === '/overlay/'
  const isTodayRoute = location.pathname === '/today' || location.pathname === '/today/'

  if (isOverlayRoute) {
    return <OverlayPage />
  }

  if (isTodayRoute) {
    return <TodayPage />
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <h1>PD2 Broadcast Item Tracker</h1>
        <p>Local-first item tracking for dashboard, overlay, and today page.</p>
      </header>

      <nav className="shell__nav" aria-label="Main navigation">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/overlay">Overlay</NavLink>
        <NavLink to="/today">Today</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>

      <main className="shell__main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/overlay" element={<OverlayPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/kit" element={<D2KitPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
