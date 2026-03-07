import { useEffect, useMemo, useState } from 'react'
import { ApiError, fetchOverlayItems } from '../lib/api'
import type { ItemSummary } from '../lib/types'

const overlayPollMs = 1000

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
  const [failed, setFailed] = useState(false)
  const src = failed ? '/icons/generic/item_unknown.png' : (item.thumbnail ?? '/icons/generic/item_unknown.png')

  return (
    <img
      className="overlay-row__thumb"
      src={src}
      alt={item.displayName}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function OverlayPage() {
  const [items, setItems] = useState<ItemSummary[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    const previousHtmlBackground = document.documentElement.style.background
    const previousBodyBackground = document.body.style.background
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'

    let active = true

    const run = async () => {
      try {
        const latest = await fetchOverlayItems()
        if (!active) {
          return
        }

        setLoadError(null)

        setItems((prev) => {
          const prevIds = new Set(prev.map((item) => item.id))
          const incomingIds = latest.map((item) => item.id).filter((id) => !prevIds.has(id))
          if (incomingIds.length > 0) {
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
          return latest
        })
      } catch (error: unknown) {
        if (!active) {
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
      }
    }

    run()
    const timer = window.setInterval(run, overlayPollMs)

    return () => {
      active = false
      window.clearInterval(timer)
      document.body.classList.remove('overlay-mode')
      document.documentElement.style.background = previousHtmlBackground
      document.body.style.background = previousBodyBackground
    }
  }, [])

  const empty = useMemo(() => items.length === 0, [items])

  return (
    <section className="overlay-shell" aria-label="OBS Overlay">
      <div className="overlay-list">
        {items.map((item) => (
          <article key={item.id} className={`overlay-row ${newIds.has(item.id) ? 'is-new' : ''}`}>
            <OverlayThumb item={item} />
            <div className="overlay-row__body">
              <p className="overlay-row__name" title={item.displayName}>
                {item.displayName}
              </p>
              <div className="overlay-row__badges">
                <span className={`overlay-badge quality ${qualityClass(item.quality)}`}>{item.quality}</span>
                {item.quantity !== null ? <span className="overlay-badge quantity">x{item.quantity}</span> : null}
                {item.isCorrupted ? <span className="overlay-badge corrupted">Corrupted</span> : null}
              </div>
            </div>
          </article>
        ))}

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
