import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ApiError, fetchTodayItems, fetchTodayPublicData, fetchTodayStats } from '../lib/api'
import type { ItemSummary } from '../lib/types'
import type { TodayPublicItem, TodayStats } from '../lib/types'

const todayPollMs = 2000

interface TodayCardItem {
  displayName: string
  quality: string
  quantity: number | null
  isCorrupted: boolean
  thumbnail: string | null
  capturedAt: string
  category?: string
}

function toTodayCardItemFromPublic(item: TodayPublicItem): TodayCardItem {
  return {
    displayName: item.displayName,
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.isCorrupted,
    thumbnail: item.thumbnail,
    capturedAt: item.capturedAt,
    category: item.category,
  }
}

function toTodayCardItemFromPrivate(item: ItemSummary): TodayCardItem {
  return {
    displayName: item.displayName,
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.isCorrupted,
    thumbnail: item.thumbnail,
    capturedAt: item.capturedAt,
    category: item.type,
  }
}

function normalizeQuality(raw: string): string {
  return raw.trim().toLowerCase()
}

export function TodayPage() {
  const location = useLocation()
  const [items, setItems] = useState<TodayCardItem[]>([])
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [pageDate, setPageDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [qualityFilter, setQualityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)

  const key = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('key') ?? params.get('token') ?? ''
    return raw.trim()
  }, [location.search])

  useEffect(() => {
    let disposed = false
    let loading = false

    const load = async () => {
      if (loading) {
        return
      }
      loading = true

      try {
        setError(null)
        if (key) {
          const payload = await fetchTodayPublicData(key)
          if (disposed) {
            return
          }
          setItems(payload.items.map(toTodayCardItemFromPublic))
          setStats(payload.stats)
          setPageDate(payload.date)
          return
        }

        const payload = await fetchTodayPublicData()
        if (disposed) {
          return
        }
        setItems(payload.items.map(toTodayCardItemFromPublic))
        setStats(payload.stats)
        setPageDate(payload.date)
      } catch (err: unknown) {
        const status = err instanceof ApiError ? err.status : null
        if (!key && (status === 403 || status === 404)) {
          const fallbackPayload = await Promise.all([fetchTodayItems(), fetchTodayStats()]).catch(() => null)
          if (fallbackPayload) {
            const [itemsFromPrivateApi, statsFromPrivateApi] = fallbackPayload
            if (disposed) {
              return
            }
            setItems(itemsFromPrivateApi.map(toTodayCardItemFromPrivate))
            setStats(statsFromPrivateApi)
            setPageDate(new Date().toISOString().slice(0, 10))
            setError(null)
            return
          }
        }

        if (disposed) {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to load today items'
        setError(message)
        setItems([])
        setStats(null)
      } finally {
        loading = false
      }
    }

    load()
    const timer = window.setInterval(load, todayPollMs)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [key])

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

  const headerDateText = useMemo(() => {
    const date = new Date(`${pageDate}T00:00:00`)
    return Number.isNaN(date.getTime()) ? pageDate : date.toLocaleDateString()
  }, [pageDate])

  return (
    <section className="today-page">
      <header className="panel today-header">
        <h2>Today Loot</h2>
        <p>{headerDateText}</p>
      </header>

      <section className="panel today-stats" aria-label="Today stats">
        {stats ? (
          <>
            <article>
              <h3>Items</h3>
              <strong>{stats.totalItems}</strong>
            </article>
            <article>
              <h3>Unique</h3>
              <strong>{stats.uniqueItems}</strong>
            </article>
            <article>
              <h3>Runes</h3>
              <strong>{stats.runes}</strong>
            </article>
          </>
        ) : (
          <p>Stats unavailable.</p>
        )}
      </section>

      <section className="panel today-filters" aria-label="Today filters">
        <label>
          Quality
          <select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)}>
            <option value="all">All</option>
            {qualityOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All</option>
            {categoryOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <p>{error}</p> : null}

      <section className="today-grid" aria-label="Today items grid">
        {filteredItems.map((item, index) => (
          <article key={`${item.displayName}-${item.capturedAt}-${index}`} className="panel today-item-card">
            {item.thumbnail ? <img src={item.thumbnail} alt={item.displayName} className="today-item-card__thumb" /> : null}
            <h3>{item.displayName}</h3>
            <p>Quality: {item.quality}</p>
            <p>Qty: {item.quantity ?? 1}</p>
            {item.isCorrupted ? <p className="today-item-card__corrupted">Corrupted</p> : null}
            <p>{new Date(item.capturedAt).toLocaleTimeString()}</p>
          </article>
        ))}
      </section>

      {filteredItems.length === 0 ? (
        <div className="panel">
          <p>No items captured today.</p>
        </div>
      ) : null}
    </section>
  )
}
