import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, fetchOverlayItems, fetchSettings } from '../lib/api'
import { withBasePath } from '../lib/asset-path'
import { getItemVisualState } from '../lib/item-visual-state'
import { useUiLanguage } from '../lib/ui-language-context'
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
  if (normalized === 'crafted' || normalized === 'craft') {
    return 'is-crafted'
  }
  return 'is-normal'
}

function OverlayThumb({ item }: { item: ItemSummary }) {
  const src = withBasePath(item.thumbnail ?? 'icons/generic/item_unknown.svg')
  const visualState = getItemVisualState({ analysisTags: item.analysisTags })

  return (
    <img
      className={`overlay-row__thumb${visualState.isEthereal ? ' is-ethereal' : ''}`}
      src={src}
      alt={item.displayName}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = withBasePath('icons/generic/item_unknown.svg')
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

function isObsBrowserSource(): boolean {
  return /obs/i.test(window.navigator.userAgent)
}

function readPreviewActive(): boolean {
  if (isObsBrowserSource()) {
    return false
  }
  return window.localStorage.getItem('overlay_title_preview_active') === 'true'
}

export function OverlayPage() {
  const { language } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          fallbackTitle: 'Overlay Feed',
          denied: '오버레이 API 접근 거부 (403). 로컬 앱 URL(localhost/127.0.0.1)에서 열어주세요.',
          notFound: '오버레이 API 경로 없음 (404). 4310 포트 API 서버 실행 여부를 확인하세요.',
          requestFail: '오버레이 API 요청 실패',
          unavailable: '오버레이 API를 사용할 수 없습니다. 로컬 API 서버 실행 여부를 확인하세요.',
          preview: 'Overlay Preview',
          empty: 'No captured items yet.',
          corrupted: 'Corrupted',
          ethereal: 'Ethereal',
          socketed: 'Socketed',
          openDetail: '아이템 상세 열기',
        }
      : {
          fallbackTitle: 'Overlay Feed',
          denied: 'Overlay API denied (403). Open overlay from local app URL (localhost/127.0.0.1).',
          notFound: 'Overlay API route not found (404). Make sure the API server is running on port 4310.',
          requestFail: 'Overlay API request failed',
          unavailable: 'Overlay API is unavailable. Check if the local API server is running.',
          preview: 'Overlay Preview',
          empty: 'No captured items yet.',
          corrupted: 'Corrupted',
          ethereal: 'Ethereal',
          socketed: 'Socketed',
          openDetail: 'Open item details',
        }
  const [items, setItems] = useState<ItemSummary[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState(text.fallbackTitle)
  const [titleEnabled, setTitleEnabled] = useState(true)
  const [titleSize, setTitleSize] = useState(18)
  const [titleColor, setTitleColor] = useState('#f7e6a8')
  const [titleBackgroundColor, setTitleBackgroundColor] = useState('#1c1a1a')
  const [titlePadding, setTitlePadding] = useState(0)
  const [itemLimit, setItemLimit] = useState(10)
  const [minimalMode, setMinimalMode] = useState(false)
  const [carouselPage, setCarouselPage] = useState(0)
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)
  const lastAppliedModeLogRef = useRef<string>('')
  const newestItemIdRef = useRef<string | null>(null)

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    const previousHtmlBackground = document.documentElement.style.background
    const previousBodyBackground = document.body.style.background
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'

    const previewActive = readPreviewActive()
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
    if (previewActive) {
      const localMinimal = window.localStorage.getItem('overlay_minimal_mode_preview')
      if (localMinimal === 'true' || localMinimal === 'false') {
        setMinimalMode(localMinimal === 'true')
      }
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
      let overlayItemLimit = latest.itemLimit ?? itemLimit
      let overlayMinimalMode = latest.minimalMode ?? false
      let minimalModeSource: 'api-overlay' | 'settings' | 'local-override' = typeof latest.minimalMode === 'boolean'
        ? 'api-overlay'
        : 'settings'
      try {
        const settings = await fetchSettings()
        overlayTitle = settings.overlay_title ?? overlayTitle
        overlayTitleEnabled = settings.overlay_title_enabled ?? overlayTitleEnabled
        overlayTitleSize = settings.overlay_title_size ?? overlayTitleSize
        overlayTitleColor = settings.overlay_title_color ?? overlayTitleColor
        overlayTitleBackgroundColor = settings.overlay_title_background_color ?? overlayTitleBackgroundColor
        overlayTitlePadding = settings.overlay_title_padding ?? overlayTitlePadding
        overlayItemLimit = settings.overlay_item_limit ?? overlayItemLimit
        overlayMinimalMode = settings.overlay_minimal_mode ?? overlayMinimalMode
        minimalModeSource = 'settings'
      } catch {
        // ignore settings fetch failures
      }
      const previewActive = readPreviewActive()
      const overrides = readLocalTitleOverrides(previewActive ? 'overlay_title_preview' : 'overlay_title')
      overlayTitle = overrides.title ?? overlayTitle
      overlayTitleEnabled = overrides.titleEnabled ?? overlayTitleEnabled
      overlayTitleSize = overrides.size ?? overlayTitleSize
      overlayTitleColor = overrides.color ?? overlayTitleColor
      overlayTitleBackgroundColor = overrides.backgroundColor ?? overlayTitleBackgroundColor
      overlayTitlePadding = overrides.padding ?? overlayTitlePadding
      if (previewActive) {
        const localMinimal = window.localStorage.getItem('overlay_minimal_mode_preview')
        if (localMinimal === 'true' || localMinimal === 'false') {
          overlayMinimalMode = localMinimal === 'true'
          minimalModeSource = 'local-override'
        }
      }

      const appliedLogKey = `${overlayMinimalMode}:${minimalModeSource}:${latest.items.length}:${overlayItemLimit}`
      if (lastAppliedModeLogRef.current !== appliedLogKey) {
        lastAppliedModeLogRef.current = appliedLogKey
        console.info('[overlay] applied minimal mode', {
          minimalMode: overlayMinimalMode,
          source: minimalModeSource,
          itemCount: latest.items.length,
          itemLimit: overlayItemLimit,
          timestamp: new Date().toISOString(),
        })
      }

      setTitle(overlayTitle)
      setTitleEnabled(overlayTitleEnabled)
      setTitleSize(overlayTitleSize)
      setTitleColor(overlayTitleColor)
      setTitleBackgroundColor(overlayTitleBackgroundColor)
      setTitlePadding(overlayTitlePadding)
      setItemLimit(Math.max(1, overlayItemLimit))
      setMinimalMode(overlayMinimalMode)

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
      const newestId = latest.items[0]?.id ?? null
      if (newestId !== newestItemIdRef.current) {
        newestItemIdRef.current = newestId
        setCarouselPage(0)
      }
    } catch (error: unknown) {
      if (!mountedRef.current) {
        return
      }
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setLoadError(text.denied)
        } else if (error.status === 404) {
          setLoadError(text.notFound)
        } else {
          setLoadError(`${text.requestFail} (${error.status}).`)
        }
      } else {
        setLoadError(text.unavailable)
      }
      setItems([])
    } finally {
      loadingRef.current = false
    }
  }, [itemLimit, text.denied, text.notFound, text.requestFail, text.unavailable])

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

  useItemCaptureRefresh(loadItems, { enabled: true })

  const safeItemLimit = Math.max(1, itemLimit)

  useEffect(() => {
    if (items.length <= safeItemLimit) {
      return
    }

    const intervalId = window.setInterval(() => {
      setCarouselPage((prev) => prev + 1)
    }, 3500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [items.length, safeItemLimit])

  const visibleItems = useMemo(() => {
    if (items.length <= safeItemLimit) {
      return items
    }

    const maxPage = Math.ceil(items.length / safeItemLimit)
    const normalizedPage = ((carouselPage % maxPage) + maxPage) % maxPage
    const start = normalizedPage * safeItemLimit
    return items.slice(start, start + safeItemLimit)
  }, [carouselPage, items, safeItemLimit])

  const empty = useMemo(() => visibleItems.length === 0, [visibleItems])

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
            {title || text.fallbackTitle}
          </p>
        </div>
      ) : null}
      <div className="overlay-list d2-ui">
        {visibleItems.map((item) => {
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
          const hasCorruptedLabel = labelNormalized.includes('corrupted')
          const visualState = getItemVisualState({ analysisTags: item.analysisTags })

          return (
            <a
              key={item.id}
              className={`overlay-row item-themed overlay-row--clickable ${newIds.has(item.id) ? 'is-new' : ''}`}
              style={theme.style}
              href={withBasePath(`item/${encodeURIComponent(item.id)}`)}
              target="_blank"
              rel="noreferrer"
              aria-label={`${item.displayName} - ${text.openDetail}`}
            >
              {minimalMode ? null : <OverlayThumb item={item} />}
              <div className="overlay-row__body">
                <p className="overlay-row__name item-theme-name" title={item.displayName}>
                  {item.displayName}
                </p>
                {item.keyStats && item.keyStats.length > 0 ? (
                  <p className="overlay-row__stats">{item.keyStats.join(' · ')}</p>
                ) : null}
                {minimalMode ? null : (
                  <div className="overlay-row__badges">
                    <span className="overlay-badge item-theme-badge">{theme.rule.label}</span>
                    {showQualityBadge ? (
                      <span className={`overlay-badge quality ${qualityClass(item.quality)}`}>{item.quality}</span>
                    ) : null}
                    {item.quantity !== null ? <span className="overlay-badge quantity">x{item.quantity}</span> : null}
                    {item.isCorrupted && !hasCorruptedLabel ? <span className="overlay-badge corrupted">{text.corrupted}</span> : null}
                    {visualState.isEthereal ? <span className="overlay-badge item-theme-badge ethereal-badge">{text.ethereal}</span> : null}
                    {visualState.socketCount !== null ? (
                      <span className="overlay-badge item-theme-badge socket-badge">{text.socketed} ({visualState.socketCount})</span>
                    ) : null}
                  </div>
                )}
              </div>
            </a>
          )
        })}

        {empty ? (
          <div className="overlay-empty-panel">
            <p className="overlay-empty-title">{text.preview}</p>
            <p className="overlay-empty">{text.empty}</p>
            {loadError ? <p className="overlay-empty-error">{loadError}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
