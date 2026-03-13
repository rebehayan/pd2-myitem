import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useUiLanguage } from '../lib/ui-language-context'

export function ResetPasswordPage() {
  const { language } = useUiLanguage()
  const navigate = useNavigate()
  const { session, signOut } = useAuth()
  const text =
    language === 'ko'
      ? {
          title: '비밀번호 재설정',
          subtitle: '메일의 링크로 들어온 뒤 새 비밀번호를 입력하세요.',
          password: '새 비밀번호',
          confirmPassword: '새 비밀번호 확인',
          update: '비밀번호 변경',
          updating: '변경 중...',
          success: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.',
          needRecovery: '이 재설정 링크는 유효하지 않거나 만료되었습니다. 비밀번호 찾기에서 새 링크를 요청해 주세요.',
          missingEnv: 'Supabase auth가 설정되지 않았습니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인하세요.',
          mismatch: '비밀번호 확인이 일치하지 않습니다.',
          tooShort: '비밀번호는 8자 이상으로 입력해 주세요.',
          backToLogin: '로그인으로 이동',
        }
      : {
          title: 'Reset password',
          subtitle: 'Open this page from your email reset link, then set a new password.',
          password: 'New password',
          confirmPassword: 'Confirm new password',
          update: 'Update password',
          updating: 'Updating...',
          success: 'Password updated successfully. Please sign in with your new password.',
          needRecovery: 'This reset link is invalid or expired. Request a new link from forgot password.',
          missingEnv: 'Supabase auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
          mismatch: 'Password confirmation does not match.',
          tooShort: 'Password must be at least 8 characters.',
          backToLogin: 'Back to sign in',
        }

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryEventDetected, setRecoveryEventDetected] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      return
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryEventDetected(true)
      }
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const hasRecoverySignal = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const hashRaw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const hashParams = new URLSearchParams(hashRaw)

    return (
      recoveryEventDetected ||
      searchParams.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery' ||
      Boolean(searchParams.get('code')) ||
      Boolean(hashParams.get('access_token')) ||
      Boolean(hashParams.get('token_hash'))
    )
  }, [recoveryEventDetected])

  const canSubmit = supabaseConfigured && Boolean(session) && hasRecoverySignal

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) {
      return
    }
    if (!supabase) {
      setError(text.missingEnv)
      setMessage(null)
      return
    }
    if (!session || !hasRecoverySignal) {
      setError(text.needRecovery)
      setMessage(null)
      return
    }
    if (password.length < 8) {
      setError(text.tooShort)
      setMessage(null)
      return
    }
    if (password !== confirmPassword) {
      setError(text.mismatch)
      setMessage(null)
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
    } else {
      window.history.replaceState({}, document.title, window.location.pathname)
      setPassword('')
      setConfirmPassword('')
      setMessage(text.success)
      await signOut()
      navigate('/login', { replace: true })
    }
    setLoading(false)
  }

  return (
    <section className="login-page">
      <div className="d2-panel login-card">
        <h2>{text.title}</h2>
        <p>{text.subtitle}</p>
        {!supabaseConfigured ? <p className="login-error">{text.missingEnv}</p> : null}
        {supabaseConfigured && (!session || !hasRecoverySignal) ? <p className="login-error">{text.needRecovery}</p> : null}
        <form onSubmit={onSubmit} className="login-form">
          <label className="login-field">
            <span>{text.password}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
              minLength={8}
            />
          </label>
          <label className="login-field">
            <span>{text.confirmPassword}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="********"
              required
              minLength={8}
            />
          </label>
          <div className="login-actions">
            <button type="submit" className="button-primary" disabled={loading || !canSubmit}>
              {loading ? text.updating : text.update}
            </button>
            <Link to="/login" className="button-secondary">
              {text.backToLogin}
            </Link>
          </div>
          {message ? <p className="login-message">{message}</p> : null}
          {error ? <p className="login-error">{error}</p> : null}
        </form>
      </div>
    </section>
  )
}
