import { useEffect, useRef } from 'react'
import { getAccessToken } from './supabase'

interface ItemCaptureRefreshOptions {
  enabled?: boolean
  burstCount?: number
  burstIntervalMs?: number
}

export function useItemCaptureRefresh(onRefresh: () => void, options: ItemCaptureRefreshOptions = {}) {
  const { enabled = true, burstCount = 3, burstIntervalMs = 450 } = options
  const refreshRef = useRef(onRefresh)

  useEffect(() => {
    refreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let disposed = false
    let burstToken = 0
    let timeouts: number[] = []

    const clearTimeouts = () => {
      timeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      timeouts = []
    }

    const runBurst = () => {
      burstToken += 1
      const token = burstToken
      clearTimeouts()

      for (let index = 0; index < burstCount; index += 1) {
        const delay = index * burstIntervalMs
        const timeoutId = window.setTimeout(() => {
          if (disposed || token !== burstToken) {
            return
          }
          refreshRef.current()
        }, delay)
        timeouts.push(timeoutId)
      }
    }

    const apiBase = import.meta.env.VITE_API_BASE ?? ''
    let eventSource: EventSource | null = null
    const localCaptureEvent = 'pd2:item-captured'

    const startStream = async () => {
      if (!apiBase) {
        return
      }
      const token = await getAccessToken()
      if (disposed) {
        return
      }
      const query = token ? `?token=${encodeURIComponent(token)}` : ''
      eventSource = new EventSource(`${apiBase}/api/events/items${query}`)
      const onCaptured = () => runBurst()

      eventSource.addEventListener('item-captured', onCaptured)
      eventSource.onerror = () => {
        eventSource?.close()
      }
    }

    const onLocalCaptured = () => runBurst()
    const onStorageChanged = (event: StorageEvent) => {
      if (event.key === 'pd2_local_items_v1') {
        runBurst()
      }
    }

    window.addEventListener(localCaptureEvent, onLocalCaptured)
    window.addEventListener('storage', onStorageChanged)
    void startStream()

    return () => {
      disposed = true
      clearTimeouts()
      eventSource?.close()
      window.removeEventListener(localCaptureEvent, onLocalCaptured)
      window.removeEventListener('storage', onStorageChanged)
    }
  }, [enabled, burstCount, burstIntervalMs])
}
