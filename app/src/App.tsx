import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import './components/d2-ui.css'
import { DashboardPage } from './pages/DashboardPage'
import { D2KitPage } from './pages/D2KitPage'
import { GuidePage } from './pages/GuidePage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OverlayPage } from './pages/OverlayPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { useAuth } from './lib/auth-context'
import { useUiLanguage } from './lib/ui-language-context'

function App() {
  const location = useLocation()
  const { session, loading, signOut } = useAuth()
  const { language, toggleLanguage } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          title: 'PD2 방송 아이템 트래커',
          loading: '세션 불러오는 중...',
          subtitle: '대시보드, 오버레이, 투데이 페이지를 위한 로컬 우선 아이템 트래킹.',
          guest: '게스트 모드 (로그인 없이 바로 사용 가능)',
          signIn: '로그인',
          signOut: '로그아웃',
          signedIn: '로그인됨',
          dashboard: '대시보드',
          overlay: '오버레이',
          today: '투데이',
          guide: '가이드',
          settings: '설정',
          languageButton: 'English',
        }
      : {
          title: 'PD2 Broadcast Item Tracker',
          loading: 'Loading session...',
          subtitle: 'Local-first item tracking for dashboard, overlay, and today page.',
          guest: 'Guest mode (use instantly without signing in)',
          signIn: 'Sign in',
          signOut: 'Sign out',
          signedIn: 'Signed in',
          dashboard: 'Dashboard',
          overlay: 'Overlay',
          today: 'Today',
          guide: 'Guide',
          settings: 'Settings',
          languageButton: '한국어',
        }
  const isOverlayRoute = location.pathname === '/overlay' || location.pathname === '/overlay/'
  const isOverlaySubRoute = location.pathname.startsWith('/overlay/')
  const isTodayRoute = location.pathname === '/today' || location.pathname === '/today/'
  const todayParams = new URLSearchParams(location.search)
  const isTodaySharedRoute = isTodayRoute && Boolean(todayParams.get('key') ?? todayParams.get('token'))

  if (loading) {
    return (
      <div className="shell">
        <header className="shell__header">
          <h1>{text.title}</h1>
          <p>{text.loading}</p>
        </header>
        <footer className="shell__footer">© {new Date().getFullYear()} rebehayan</footer>
      </div>
    )
  }

  if (isOverlayRoute) {
    return <OverlayPage />
  }

  if (isOverlaySubRoute) {
    return <NotFoundPage overlayMode />
  }

  if (isTodaySharedRoute) {
    return <TodayPage />
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <h1>{text.title}</h1>
        <p>{text.subtitle}</p>
        <div className="shell__auth">
          {session ? (
            <>
              <span>{session.user.email ?? text.signedIn}</span>
              <button type="button" className="button-secondary" onClick={() => void signOut()}>
                {text.signOut}
              </button>
              <button type="button" className="button-secondary" onClick={toggleLanguage}>
                {text.languageButton}
              </button>
            </>
          ) : (
            <>
              <span>{text.guest}</span>
              <NavLink to="/login" className="button-secondary">
                {text.signIn}
              </NavLink>
              <button type="button" className="button-secondary" onClick={toggleLanguage}>
                {text.languageButton}
              </button>
            </>
          )}
        </div>
      </header>

      <nav className="shell__nav" aria-label="Main navigation">
        <NavLink to="/" end>
          {text.dashboard}
        </NavLink>
        <a href="/overlay" target="_blank" rel="noreferrer">
          {text.overlay}
        </a>
        <NavLink to="/today">{text.today}</NavLink>
        <NavLink to="/guide">{text.guide}</NavLink>
        <NavLink to="/settings">{text.settings}</NavLink>
      </nav>

      <main className="shell__main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/overlay" element={<OverlayPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/guide/*" element={<GuidePage />} />
          <Route path="/kit" element={<D2KitPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="shell__footer">© {new Date().getFullYear()} rebehayan</footer>
    </div>
  )
}

export default App
