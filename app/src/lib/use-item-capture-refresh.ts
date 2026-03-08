import { useEffect, useRef } from 'react'

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
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
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
    const eventSource = new EventSource(`${apiBase}/api/events/items`)
    const onCaptured = () => runBurst()

    eventSource.addEventListener('item-captured', onCaptured)
    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      disposed = true
      clearTimeouts()
      eventSource.close()
    }
  }, [enabled, burstCount, burstIntervalMs])
}
