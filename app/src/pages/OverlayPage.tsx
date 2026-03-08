import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, fetchOverlayItems, fetchSettings } from '../lib/api'
import type { ItemSummary } from '../lib/types'
import { useItemCaptureRefresh } from '../lib/use-item-capture-refresh'
import { resolveItemTheme } from '../theme/resolveItemTheme'

function qualityClass(quality: string): string {
  const normalized = quality.trim().toLowerCase()
  if (normalized === 'magic') {
    return 'is-magic'
  }
  if (normalized === 'rare') {
    return 'is-rare'
  }
  if (normalized === 'set') {
    return 'is-set'
  }
  if (normalized === 'unique') {
    return 'is-unique'
  }
  return 'is-normal'
}

function OverlayThumb({ item }: { item: ItemSummary }) {
  const src = item.thumbnail ?? '/icons/generic/item_unknown.svg'

  return (
    <img
      className="overlay-row__thumb"
      src={src}
      alt={item.displayName}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = '/icons/generic/item_unknown.svg'
      }}
    />
  )
}

const titleDefaults = {
  size: 18,
  color: '#f7e6a8',
  backgroundColor: '#1c1a1a',
  padding: 0,
}

function readLocalTitleOverrides(prefix: string) {
  const overrides: {
    title?: string
    titleEnabled?: boolean
    size?: number
    color?: string
    backgroundColor?: string
    padding?: number
  } = {}
  const storedTitle = window.localStorage.getItem(prefix)
  const storedTitleEnabled = window.localStorage.getItem(`${prefix}_enabled`)
  const storedTitleSize = window.localStorage.getItem(`${prefix}_size`)
  const storedTitleColor = window.localStorage.getItem(`${prefix}_color`)
  const storedTitleBackgroundColor = window.localStorage.getItem(`${prefix}_background_color`)
  const storedTitlePadding = window.localStorage.getItem(`${prefix}_padding`)
  if (storedTitle) {
    overrides.title = storedTitle
  }
  if (storedTitleEnabled === 'true' || storedTitleEnabled === 'false') {
    overrides.titleEnabled = storedTitleEnabled === 'true'
  }
  if (storedTitleSize) {
    const parsed = Number(storedTitleSize)
    if (Number.isFinite(parsed)) {
      overrides.size = parsed
    }
  }
  if (storedTitleColor && /^#[0-9a-f]{6}$/i.test(storedTitleColor)) {
    overrides.color = storedTitleColor
  }
  if (storedTitleBackgroundColor && /^#[0-9a-f]{6}$/i.test(storedTitleBackgroundColor)) {
    overrides.backgroundColor = storedTitleBackgroundColor
  }
  if (storedTitlePadding) {
    const parsed = Number(storedTitlePadding)
    if (Number.isFinite(parsed)) {
      overrides.padding = parsed
    }
  }
  return overrides
}

export function OverlayPage() {
  const [items, setItems] = useState<ItemSummary[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('Overlay Feed')
  const [titleEnabled, setTitleEnabled] = useState(true)
  const [titleSize, setTitleSize] = useState(18)
  const [titleColor, setTitleColor] = useState('#f7e6a8')
  const [titleBackgroundColor, setTitleBackgroundColor] = useState('#1c1a1a')
  const [titlePadding, setTitlePadding] = useState(0)
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    const previousHtmlBackground = document.documentElement.style.background
    const previousBodyBackground = document.body.style.background
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'

    const previewActive = window.localStorage.getItem('overlay_title_preview_active') === 'true'
    const overrides = readLocalTitleOverrides(previewActive ? 'overlay_title_preview' : 'overlay_title')
    if (overrides.title) {
      setTitle(overrides.title)
    }
    if (typeof overrides.titleEnabled === 'boolean') {
      setTitleEnabled(overrides.titleEnabled)
    }
    if (typeof overrides.size === 'number') {
      setTitleSize(overrides.size)
    }
    if (overrides.color) {
      setTitleColor(overrides.color)
    }
    if (overrides.backgroundColor) {
      setTitleBackgroundColor(overrides.backgroundColor)
    }
    if (typeof overrides.padding === 'number') {
      setTitlePadding(overrides.padding)
    }

    return () => {
      document.body.classList.remove('overlay-mode')
      document.documentElement.style.background = previousHtmlBackground
      document.body.style.background = previousBodyBackground
    }
  }, [])

  const loadItems = useCallback(async () => {
    if (loadingRef.current || !mountedRef.current) {
      return
    }
    loadingRef.current = true

    try {
      const latest = await fetchOverlayItems()
      if (!mountedRef.current) {
        return
      }

      let overlayTitle = latest.title
      let overlayTitleEnabled = latest.titleEnabled
      let overlayTitleSize = latest.titleSize ?? titleDefaults.size
      let overlayTitleColor = latest.titleColor ?? titleDefaults.color
      let overlayTitleBackgroundColor = latest.titleBackgroundColor ?? titleDefaults.backgroundColor
      let overlayTitlePadding = latest.titlePadding ?? titleDefaults.padding
      try {
        const settings = await fetchSettings()
        overlayTitle = settings.overlay_title ?? overlayTitle
        overlayTitleEnabled = settings.overlay_title_enabled ?? overlayTitleEnabled
        overlayTitleSize = settings.overlay_title_size ?? overlayTitleSize
        overlayTitleColor = settings.overlay_title_color ?? overlayTitleColor
        overlayTitleBackgroundColor = settings.overlay_title_background_color ?? overlayTitleBackgroundColor
        overlayTitlePadding = settings.overlay_title_padding ?? overlayTitlePadding
      } catch {
        // ignore settings fetch failures
      }
      const previewActive = window.localStorage.getItem('overlay_title_preview_active') === 'true'
      const overrides = readLocalTitleOverrides(previewActive ? 'overlay_title_preview' : 'overlay_title')
      overlayTitle = overrides.title ?? overlayTitle
      overlayTitleEnabled = overrides.titleEnabled ?? overlayTitleEnabled
      overlayTitleSize = overrides.size ?? overlayTitleSize
      overlayTitleColor = overrides.color ?? overlayTitleColor
      overlayTitleBackgroundColor = overrides.backgroundColor ?? overlayTitleBackgroundColor
      overlayTitlePadding = overrides.padding ?? overlayTitlePadding
      setTitle(overlayTitle)
      setTitleEnabled(overlayTitleEnabled)
      setTitleSize(overlayTitleSize)
      setTitleColor(overlayTitleColor)
      setTitleBackgroundColor(overlayTitleBackgroundColor)
      setTitlePadding(overlayTitlePadding)

      setLoadError(null)

      setItems((prev) => {
        const prevById = new Map(prev.map((item) => [item.id, item]))
        const incoming = latest.items.filter((item) => !prevById.has(item.id))
        if (incoming.length > 0) {
          const incomingIds = incoming.map((item) => item.id)
          setNewIds((old) => {
            const merged = new Set(old)
            for (const id of incomingIds) {
              merged.add(id)
            }
            return merged
          })

          window.setTimeout(() => {
            setNewIds((old) => {
              const next = new Set(old)
              for (const id of incomingIds) {
                next.delete(id)
              }
              return next
            })
          }, 900)
        }

        return latest.items
      })
    } catch (error: unknown) {
      if (!mountedRef.current) {
        return
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setLoadError('Overlay API denied (403). Open overlay from local app URL (localhost/127.0.0.1).')
        } else if (error.status === 404) {
          setLoadError('Overlay API route not found (404). Make sure the API server is running on port 4310.')
        } else {
          setLoadError(`Overlay API request failed (${error.status}).`)
        }
      } else {
        setLoadError('Overlay API is unavailable. Check if the local API server is running.')
      }
      setItems([])
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void loadItems()
    return () => {
      mountedRef.current = false
    }
  }, [loadItems])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadItems()
    }, 2000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadItems])

  useItemCaptureRefresh(loadItems)

  const empty = useMemo(() => items.length === 0, [items])

  return (
    <section className="overlay-shell d2-ui" aria-label="OBS Overlay">
      {titleEnabled ? (
        <div className="overlay-header">
          <p
            className="overlay-title"
            aria-live="polite"
            style={{
              fontSize: `${titleSize}px`,
              color: titleColor,
              backgroundColor: titlePadding > 0 ? titleBackgroundColor : 'transparent',
              padding: `${titlePadding}px`,
            }}
          >
            {title || 'Overlay Feed'}
          </p>
        </div>
      ) : null}
      <div className="overlay-list d2-ui">
        {items.map((item) => {
          const theme = resolveItemTheme({
            displayName: item.displayName,
            type: item.type,
            quality: item.quality,
            category: item.category,
            isCorrupted: item.isCorrupted,
            quantity: item.quantity,
            analysisProfile: item.analysisProfile,
            analysisTags: item.analysisTags,
          })
          const labelNormalized = theme.rule.label.trim().toLowerCase()
          const qualityNormalized = item.quality.trim().toLowerCase()
          const showQualityBadge = labelNormalized !== qualityNormalized

          return (
            <article
              key={item.id}
              className={`overlay-row item-themed ${newIds.has(item.id) ? 'is-new' : ''}`}
              style={theme.style}
            >
              <OverlayThumb item={item} />
              <div className="overlay-row__body">
                <p className="overlay-row__name item-theme-name" title={item.displayName}>
                  {item.displayName}
                </p>
                {item.keyStats && item.keyStats.length > 0 ? (
                  <p className="overlay-row__stats">{item.keyStats.join(' · ')}</p>
                ) : null}
                <div className="overlay-row__badges">
                  <span className="overlay-badge item-theme-badge">{theme.rule.label}</span>
                  {showQualityBadge ? (
                    <span className={`overlay-badge quality ${qualityClass(item.quality)}`}>{item.quality}</span>
                  ) : null}
                  {item.quantity !== null ? <span className="overlay-badge quantity">x{item.quantity}</span> : null}
                  {item.isCorrupted ? <span className="overlay-badge corrupted">Corrupted</span> : null}
                </div>
              </div>
            </article>
          )
        })}

        {empty ? (
          <div className="overlay-empty-panel">
            <p className="overlay-empty-title">Overlay Preview</p>
            <p className="overlay-empty">No captured items yet.</p>
            {loadError ? <p className="overlay-empty-error">{loadError}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
