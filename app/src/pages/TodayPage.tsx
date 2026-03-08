import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ApiError, deleteItem, fetchTodayItems, fetchTodayPublicData, fetchTodayStats } from '../lib/api'
import type { ItemSummary } from '../lib/types'
import type { TodayPublicItem, TodayStats } from '../lib/types'
import { useItemCaptureRefresh } from '../lib/use-item-capture-refresh'
import { resolveItemTheme } from '../theme/resolveItemTheme'

interface TodayCardItem {
  id?: string
  displayName: string
  quality: string
  quantity: number | null
  isCorrupted: boolean
  thumbnail: string | null
  capturedAt: string
  category?: string
  analysisProfile?: string
  analysisTags?: string[]
}

function toTodayCardItemFromPublic(item: TodayPublicItem): TodayCardItem {
  return {
    id: undefined,
    displayName: item.displayName,
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.isCorrupted,
    thumbnail: item.thumbnail,
    capturedAt: item.capturedAt,
    category: item.category,
    analysisProfile: item.analysisProfile,
    analysisTags: item.analysisTags,
  }
}

function toTodayCardItemFromPrivate(item: ItemSummary): TodayCardItem {
  return {
    id: item.id,
    displayName: item.displayName,
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.isCorrupted,
    thumbnail: item.thumbnail,
    capturedAt: item.capturedAt,
    category: item.category ?? item.type,
    analysisProfile: item.analysisProfile,
    analysisTags: item.analysisTags,
  }
}

function normalizeQuality(raw: string): string {
  return raw.trim().toLowerCase()
}

export function TodayPage() {
  const location = useLocation()
  const [items, setItems] = useState<TodayCardItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [pageDate, setPageDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [qualityFilter, setQualityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)

  const key = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('key') ?? params.get('token') ?? ''
    return raw.trim()
  }, [location.search])

  const loadItems = useCallback(async () => {
    if (loadingRef.current || !mountedRef.current) {
      return
    }
    loadingRef.current = true

    try {
      setError(null)
      if (key) {
        const payload = await fetchTodayPublicData(key)
        if (!mountedRef.current) {
          return
        }
        setItems(payload.items.map(toTodayCardItemFromPublic))
        setSelectedIds(new Set())
        setStats(payload.stats)
        setPageDate(payload.date)
        return
      }

      const payload = await fetchTodayPublicData()
      if (!mountedRef.current) {
        return
      }
      setItems(payload.items.map(toTodayCardItemFromPublic))
      setSelectedIds(new Set())
      setStats(payload.stats)
      setPageDate(payload.date)
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : null
      if (!key && (status === 403 || status === 404)) {
        const fallbackPayload = await Promise.all([fetchTodayItems(), fetchTodayStats()]).catch(() => null)
        if (fallbackPayload) {
          const [itemsFromPrivateApi, statsFromPrivateApi] = fallbackPayload
          if (!mountedRef.current) {
            return
          }
          setItems(itemsFromPrivateApi.map(toTodayCardItemFromPrivate))
          setSelectedIds(new Set())
          setStats(statsFromPrivateApi)
          setPageDate(new Date().toISOString().slice(0, 10))
          setError(null)
          return
        }
      }

      if (!mountedRef.current) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to load today items'
      setError(message)
      setItems([])
      setSelectedIds(new Set())
      setStats(null)
    } finally {
      loadingRef.current = false
    }
  }, [key])

  useEffect(() => {
    mountedRef.current = true
    void loadItems()
    return () => {
      mountedRef.current = false
    }
  }, [loadItems])

  useItemCaptureRefresh(loadItems, { enabled: !key })

  const qualityOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => normalizeQuality(item.quality))))
    values.sort((left, right) => left.localeCompare(right))
    return values
  }, [items])

  const categoryOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        items
          .map((item) => item.category?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    )
    values.sort((left, right) => left.localeCompare(right))
    return values
  }, [items])

  const filteredItems = useMemo(() => {
    const sorted = [...items].sort((left, right) => {
      return new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()
    })

    return sorted.filter((item) => {
      const qualityMatched = qualityFilter === 'all' || normalizeQuality(item.quality) === qualityFilter
      const categoryMatched = categoryFilter === 'all' || item.category === categoryFilter
      return qualityMatched && categoryMatched
    })
  }, [categoryFilter, items, qualityFilter])

  const manageableItems = useMemo(() => {
    return filteredItems.filter((item) => Boolean(item.id))
  }, [filteredItems])

  const onToggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const onToggleAll = () => {
    setSelectedIds((prev) => {
      const ids = manageableItems.map((item) => item.id as string)
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        for (const id of ids) {
          next.delete(id)
        }
        return next
      }
      const next = new Set(prev)
      for (const id of ids) {
        next.add(id)
      }
      return next
    })
  }

  const onDeleteChecked = async () => {
    if (deleting || selectedIds.size === 0) {
      return
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected item(s)?`)) {
      return
    }

    try {
      setDeleting(true)
      setActionError(null)
      await Promise.all(Array.from(selectedIds).map((id) => deleteItem(id)))
      await loadItems()
      setSelectedIds(new Set())
      setActionMessage(`Deleted ${selectedIds.size} item(s).`)
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete selected items.'
      setActionError(message)
    } finally {
      setDeleting(false)
    }
  }

  const headerDateText = useMemo(() => {
    const date = new Date(`${pageDate}T00:00:00`)
    return Number.isNaN(date.getTime()) ? pageDate : date.toLocaleDateString()
  }, [pageDate])

  return (
    <section className="today-page d2-ui">
      <header className="d2-panel today-header">
        <h2>Today Loot</h2>
        <p>{headerDateText}</p>
      </header>

      <section className="d2-panel today-stats d2-stat-grid" aria-label="Today stats">
        {stats ? (
          <>
            <article className="d2-stat">
              <p className="d2-stat__label">Items</p>
              <p className="d2-stat__value">{stats.totalItems}</p>
            </article>
            <article className="d2-stat">
              <p className="d2-stat__label">Unique</p>
              <p className="d2-stat__value">{stats.uniqueItems}</p>
            </article>
            <article className="d2-stat">
              <p className="d2-stat__label">Runes</p>
              <p className="d2-stat__value">{stats.runes}</p>
            </article>
          </>
        ) : (
          <p>Stats unavailable.</p>
        )}
      </section>

      <section className="d2-panel today-filters" aria-label="Today filters">
        <label>
          <span className="d2-label">Quality</span>
          <select className="d2-select" value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)}>
            <option value="all">All</option>
            {qualityOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="d2-label">Category</span>
          <select className="d2-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All</option>
            {categoryOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </section>

      {manageableItems.length > 0 ? (
        <div className="today-actions">
          <button
            type="button"
            className="d2-button d2-button--secondary d2-button--sm"
            onClick={onToggleAll}
          >
            {manageableItems.length > 0 && manageableItems.every((item) => selectedIds.has(item.id as string))
              ? 'Unselect All'
              : 'Select All'}
          </button>
          <button
            type="button"
            className="d2-button d2-button--secondary d2-button--sm"
            onClick={onDeleteChecked}
            disabled={selectedIds.size === 0 || deleting}
          >
            Delete Checked ({selectedIds.size})
          </button>
          {actionMessage ? <p>{actionMessage}</p> : null}
          {actionError ? <p>{actionError}</p> : null}
        </div>
      ) : null}

      {error ? <p>{error}</p> : null}

      <section className="today-grid" aria-label="Today items grid">
        {filteredItems.map((item, index) => {
          const theme = resolveItemTheme({
            displayName: item.displayName,
            type: item.category ?? '',
            quality: item.quality,
            category: item.category,
            isCorrupted: item.isCorrupted,
            quantity: item.quantity,
            analysisProfile: item.analysisProfile,
            analysisTags: item.analysisTags,
          })

          return (
            <article
              key={`${item.displayName}-${item.capturedAt}-${index}`}
              className="d2-panel today-item-card item-themed"
              style={theme.style}
            >
              {item.id ? (
                <label className="today-item-card__select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggleSelected(item.id as string)}
                  />
                  <span>Select</span>
                </label>
              ) : null}
              {item.thumbnail ? <img src={item.thumbnail} alt={item.displayName} className="today-item-card__thumb" /> : null}
              <h3 className="item-theme-name">{item.displayName}</h3>
              <div className="item-theme-badges">
                <span className="item-theme-badge">{theme.rule.label}</span>
              </div>
              <p>Quality: {item.quality}</p>
              <p>Qty: {item.quantity ?? 1}</p>
              {item.isCorrupted ? <p className="today-item-card__corrupted">Corrupted</p> : null}
              <p>{new Date(item.capturedAt).toLocaleTimeString()}</p>
            </article>
          )
        })}
      </section>

      {filteredItems.length === 0 ? (
        <div className="d2-panel">
          <p>No items captured today.</p>
        </div>
      ) : null}
    </section>
  )
}
