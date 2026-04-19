import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useUiLanguage } from '../lib/ui-language-context'

export function LoginPage() {
  const { language } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          title: '로그인',
          subtitle: '대시보드 사용을 위해 Supabase 계정으로 로그인하세요.',
          missingEnv: 'Supabase 환경변수가 없어 로그인 기능이 비활성화됩니다. 게스트 모드는 사용 가능합니다.',
          email: '이메일',
          password: '비밀번호',
          signIn: '로그인',
          signingIn: '로그인 중...',
          create: '계정 생성',
          google: 'Google로 계속',
          signInSuccess: '로그인되었습니다.',
          signupSuccess: '이메일 인증 후 로그인하세요. 로컬 데이터는 로그인 후 동기화됩니다.',
          forgotPassword: '비밀번호 찾기',
          sendingReset: '재설정 메일 전송 중...',
          resetSent: '입력한 이메일 계정이 존재하면 비밀번호 재설정 메일을 보냈습니다. 메일함을 확인하세요.',
          resetRequiresEmail: '비밀번호 재설정 메일을 보내려면 이메일을 먼저 입력하세요.',
          resetRequestFailed: '재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도하세요.',
          missingSupabase: 'Supabase auth가 설정되지 않았습니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인하세요.',
        }
      : {
          title: 'Sign in',
          subtitle: 'Use your Supabase account to access the dashboard.',
          missingEnv: 'Supabase env is missing. Guest mode still works, but login is disabled.',
          email: 'Email',
          password: 'Password',
          signIn: 'Sign in',
          signingIn: 'Signing in...',
          create: 'Create account',
          google: 'Continue with Google',
          signInSuccess: 'Signed in successfully.',
          signupSuccess: 'Check your email to confirm your account. Local data will sync after sign-in.',
          forgotPassword: 'Forgot password',
          sendingReset: 'Sending reset email...',
          resetSent: 'If an account exists for this email, we sent a password reset link. Please check your inbox.',
          resetRequiresEmail: 'Enter your email first to receive a password reset email.',
          resetRequestFailed: 'Could not send reset email. Please try again shortly.',
          missingSupabase: 'Supabase auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        }
  const navigate = useNavigate()
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetRequesting, setResetRequesting] = useState(false)
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
    if (!supabase) {
      setError(text.missingSupabase)
      setResetRequesting(false)
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
      setMessage(text.signInSuccess)
    }
    setLoading(false)
  }

  const onGoogleSignIn = async () => {
    if (loading) {
      return
    }
    if (!supabase) {
      setError(text.missingSupabase)
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

  const onResetPassword = async () => {
    if (loading) {
      return
    }
    if (!supabase) {
      setError(text.missingSupabase)
      return
    }

    const targetEmail = email.trim()
    if (!targetEmail) {
      setError(text.resetRequiresEmail)
      setMessage(null)
      setResetRequesting(false)
      return
    }

    setResetRequesting(true)
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      setError(text.resetRequestFailed)
    } else {
      setMessage(text.resetSent)
    }
    setResetRequesting(false)
    setLoading(false)
  }

  return (
    <section className="login-page">
      <div className="d2-panel login-card">
        <h2>{text.title}</h2>
        <p>{text.subtitle}</p>
        {!supabaseConfigured ? (
          <p className="login-error">{text.missingEnv}</p>
        ) : null}
        <form onSubmit={onSignIn} className="login-form">
          <label className="login-field">
            <span>{text.email}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="login-field">
            <span>{text.password}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
            />
          </label>
          <div className="login-actions">
            <button type="submit" className="button-primary" disabled={loading || !supabaseConfigured}>
              {loading ? text.signingIn : text.signIn}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={onGoogleSignIn}
              disabled={loading || !supabaseConfigured}
            >
              {text.google}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={onResetPassword}
              disabled={loading || !supabaseConfigured}
            >
              {resetRequesting ? text.sendingReset : text.forgotPassword}
            </button>
          </div>
          {message ? <p className="login-message">{message}</p> : null}
          {error ? <p className="login-error">{error}</p> : null}
        </form>
      </div>
    </section>
  )
}
