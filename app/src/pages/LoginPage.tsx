import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { markLocalSyncPending } from '../lib/local-store'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true })
    }
  }, [navigate, session])

  const onSignIn = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) {
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
    } else {
      setMessage('Signed in successfully.')
    }
    setLoading(false)
  }

  const onSignUp = async () => {
    if (loading) {
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
    } else {
      markLocalSyncPending()
      setMessage('Check your email to confirm your account. Local data will sync after sign-in.')
    }
    setLoading(false)
  }

  const onGoogleSignIn = async () => {
    if (loading) {
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
  }

  return (
    <section className="login-page">
      <div className="d2-panel login-card">
        <h2>Sign in</h2>
        <p>Use your Supabase account to access the dashboard.</p>
        <form onSubmit={onSignIn} className="login-form">
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
            />
          </label>
          <div className="login-actions">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <button type="button" className="button-secondary" onClick={onSignUp} disabled={loading}>
              Create account
            </button>
            <button type="button" className="button-secondary" onClick={onGoogleSignIn} disabled={loading}>
              Continue with Google
            </button>
          </div>
          {message ? <p className="login-message">{message}</p> : null}
          {error ? <p className="login-error">{error}</p> : null}
        </form>
      </div>
    </section>
  )
}
