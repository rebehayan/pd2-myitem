import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import './components/d2-ui.css'
import { DashboardPage } from './pages/DashboardPage'
import { D2KitPage } from './pages/D2KitPage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { LoginPage } from './pages/LoginPage'
import { OverlayPage } from './pages/OverlayPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { useAuth } from './lib/auth-context'

function App() {
  const location = useLocation()
  const { session, loading, signOut } = useAuth()
  const isOverlayRoute = location.pathname === '/overlay' || location.pathname === '/overlay/'
  const isTodayRoute = location.pathname === '/today' || location.pathname === '/today/'
  const todayParams = new URLSearchParams(location.search)
  const isTodaySharedRoute = isTodayRoute && Boolean(todayParams.get('key') ?? todayParams.get('token'))

  if (loading) {
    return (
      <div className="shell">
        <header className="shell__header">
          <h1>PD2 Broadcast Item Tracker</h1>
          <p>Loading session...</p>
        </header>
        <footer className="shell__footer">© {new Date().getFullYear()} rebehayan</footer>
      </div>
    )
  }

  if (isOverlayRoute) {
    return <OverlayPage />
  }

  if (isTodaySharedRoute) {
    return <TodayPage />
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <h1>PD2 Broadcast Item Tracker</h1>
        <p>Local-first item tracking for dashboard, overlay, and today page.</p>
        <div className="shell__auth">
          {session ? (
            <>
              <span>{session.user.email ?? 'Signed in'}</span>
              <button type="button" className="button-secondary" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <span>Guest mode (local storage)</span>
              <NavLink to="/login" className="button-secondary">
                Sign in
              </NavLink>
            </>
          )}
        </div>
      </header>

      <nav className="shell__nav" aria-label="Main navigation">
        <NavLink to="/">Dashboard</NavLink>
        <a href="/overlay" target="_blank" rel="noreferrer">
          Overlay
        </a>
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
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>

      <footer className="shell__footer">© {new Date().getFullYear()} rebehayan</footer>
    </div>
  )
}

export default App
