import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { syncLocalDataToServer } from './api'
import { clearLocalSyncPending, isLocalSyncPending } from './local-store'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthContextValue['session']>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return
      }
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session || !isLocalSyncPending()) {
      return
    }

    let cancelled = false
    const runSync = async () => {
      try {
        await syncLocalDataToServer()
        if (!cancelled) {
          clearLocalSyncPending()
        }
      } catch {
        // keep pending flag for retry
      }
    }

    void runSync()
    return () => {
      cancelled = true
    }
  }, [session])

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }
  }, [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
