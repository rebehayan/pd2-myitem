import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ApiError, deleteItem, fetchCalendarMonth, fetchItemsByDate, fetchTodayPublicData } from '../lib/api'
import { getItemVisualState } from '../lib/item-visual-state'
import { useUiLanguage } from '../lib/ui-language-context'
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

function formatLocalDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonth(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value
  }
  return formatLocalDate(value).slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const base = new Date(`${month}-01T00:00:00`)
  base.setMonth(base.getMonth() + delta)
  const year = base.getFullYear()
  const nextMonth = `${base.getMonth() + 1}`.padStart(2, '0')
  return `${year}-${nextMonth}`
}

function getStatsFromItems(source: TodayCardItem[]): TodayStats {
  const totalItems = source.length
  const uniqueItems = source.filter((row) => row.quality?.toLowerCase() === 'unique').length
  const runes = source.filter((row) => row.category === 'rune').length
  const materials = source.filter((row) => row.category === 'material').length
  return {
    totalItems,
    uniqueItems,
    runes,
    materials,
  }
}

export function TodayPage() {
  const { language } = useUiLanguage()
  const timeLocale = language === 'ko' ? 'ko-KR' : 'en-US'
  const text =
    language === 'ko'
      ? {
          title: 'Today Loot',
          prev: 'Prev',
          next: 'Next',
          today: 'Today',
          statsUnavailable: 'Stats unavailable.',
          items: 'Items',
          unique: 'Unique',
          runes: 'Runes',
          quality: 'Quality',
          category: 'Category',
          all: 'All',
          selectAll: 'Select All',
          unselectAll: 'Unselect All',
          deleteChecked: 'Delete Checked',
          select: 'Select',
          corrupted: 'Corrupted',
          ethereal: 'Ethereal',
          socketed: 'Socketed',
          qty: 'Qty',
          empty: 'No items captured today.',
          loadCalendarFail: 'Failed to load calendar.',
          loadTodayFail: 'Failed to load today items',
          deleteFail: 'Failed to delete selected items.',
          confirmDelete: 'Delete selected item(s)?',
          deleted: 'item(s) deleted.',
        }
      : {
          title: 'Today Loot',
          prev: 'Prev',
          next: 'Next',
          today: 'Today',
          statsUnavailable: 'Stats unavailable.',
          items: 'Items',
          unique: 'Unique',
          runes: 'Runes',
          quality: 'Quality',
          category: 'Category',
          all: 'All',
          selectAll: 'Select All',
          unselectAll: 'Unselect All',
          deleteChecked: 'Delete Checked',
          select: 'Select',
          corrupted: 'Corrupted',
          ethereal: 'Ethereal',
          socketed: 'Socketed',
          qty: 'Qty',
          empty: 'No items captured today.',
          loadCalendarFail: 'Failed to load calendar.',
          loadTodayFail: 'Failed to load today items',
          deleteFail: 'Failed to delete selected items.',
          confirmDelete: 'Delete selected item(s)?',
          deleted: 'item(s) deleted.',
        }
  const location = useLocation()
  const [items, setItems] = useState<TodayCardItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<TodayStats | null>(null)
  const todayDate = useMemo(() => formatLocalDate(new Date()), [])
  const [selectedDate, setSelectedDate] = useState<string>(todayDate)
  const [pageDate, setPageDate] = useState<string>(todayDate)
  const [calendarMonth, setCalendarMonth] = useState<string>(formatMonth(todayDate))
  const [calendarCounts, setCalendarCounts] = useState<Record<string, number>>({})
  const [calendarError, setCalendarError] = useState<string | null>(null)
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
  const isSharedView = key.length > 0

  const loadCalendar = useCallback(async () => {
    if (key) {
      return
    }
    try {
      setCalendarError(null)
      const results = await fetchCalendarMonth(calendarMonth)
      if (!mountedRef.current) {
        return
      }
      const next: Record<string, number> = {}
      for (const entry of results) {
        next[entry.date] = entry.count
      }
      setCalendarCounts(next)
    } catch (err: unknown) {
      if (!mountedRef.current) {
        return
      }
      setCalendarError(err instanceof Error ? err.message : text.loadCalendarFail)
      setCalendarCounts({})
    }
  }, [calendarMonth, key, text.loadCalendarFail])

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
      const itemsForDate = await fetchItemsByDate(selectedDate)
      if (!mountedRef.current) {
        return
      }
      const mapped = itemsForDate.map(toTodayCardItemFromPrivate)
      setItems(mapped)
      setSelectedIds(new Set())
      setStats(getStatsFromItems(mapped))
      setPageDate(selectedDate)
      if (formatMonth(selectedDate) === calendarMonth) {
        void loadCalendar()
      }
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : null
      if (!key && (status === 403 || status === 404)) {
        const fallbackPayload = await fetchItemsByDate(selectedDate).catch(() => null)
        if (fallbackPayload) {
          if (!mountedRef.current) {
            return
          }
          const mapped = fallbackPayload.map(toTodayCardItemFromPrivate)
          setItems(mapped)
          setSelectedIds(new Set())
          setStats(getStatsFromItems(mapped))
          setPageDate(selectedDate)
          setError(null)
          return
        }
      }

      if (!mountedRef.current) {
        return
      }
      const message = err instanceof Error ? err.message : text.loadTodayFail
      setError(message)
      setItems([])
      setSelectedIds(new Set())
      setStats(null)
    } finally {
      loadingRef.current = false
    }
  }, [calendarMonth, key, loadCalendar, selectedDate, text.loadTodayFail])

  useEffect(() => {
    mountedRef.current = true
    void loadItems()
    return () => {
      mountedRef.current = false
    }
  }, [loadItems])

  useEffect(() => {
    void loadCalendar()
  }, [loadCalendar])

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
    if (!window.confirm(`${text.confirmDelete} (${selectedIds.size})`)) {
      return
    }

    try {
      setDeleting(true)
      setActionError(null)
      await Promise.all(Array.from(selectedIds).map((id) => deleteItem(id)))
      await loadItems()
      setSelectedIds(new Set())
      setActionMessage(`${selectedIds.size} ${text.deleted}`)
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : text.deleteFail
      setActionError(message)
    } finally {
      setDeleting(false)
    }
  }

  const headerDateText = useMemo(() => {
    const date = new Date(`${pageDate}T00:00:00`)
    return Number.isNaN(date.getTime()) ? pageDate : date.toLocaleDateString()
  }, [pageDate])

  const monthDate = useMemo(() => new Date(`${calendarMonth}-01T00:00:00`), [calendarMonth])
  const monthLabel = useMemo(() => {
    if (Number.isNaN(monthDate.getTime())) {
      return calendarMonth
    }
    return monthDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  }, [calendarMonth, monthDate])
  const firstDay = useMemo(() => {
    if (Number.isNaN(monthDate.getTime())) {
      return 0
    }
    return new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay()
  }, [monthDate])
  const totalDays = useMemo(() => {
    if (Number.isNaN(monthDate.getTime())) {
      return 0
    }
    return new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  }, [monthDate])
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays])

  const formatCapturedTime = useCallback(
    (value: string) => {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        return value
      }
      return date.toLocaleTimeString(timeLocale, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    },
    [timeLocale],
  )

  return (
    <section className={`today-page ${isSharedView ? 'today-page--shared' : 'd2-ui'}`}>
      <header className={isSharedView ? 'today-header today-header--shared' : 'd2-panel today-header'}>
        <h2>{text.title}</h2>
        <p>{headerDateText}</p>
      </header>

      {!key ? (
        <section className="d2-panel today-calendar" aria-label="Calendar">
          <div className="today-calendar__header">
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={() => {
                const next = shiftMonth(calendarMonth, -1)
                setCalendarMonth(next)
                setSelectedDate(`${next}-01`)
              }}
            >
               {text.prev}
            </button>
            <div className="today-calendar__title">
              <strong>{monthLabel}</strong>
              <button
                type="button"
                className="d2-button d2-button--secondary d2-button--sm"
                onClick={() => {
                  setCalendarMonth(formatMonth(todayDate))
                  setSelectedDate(todayDate)
                }}
              >
                 {text.today}
              </button>
            </div>
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={() => {
                const next = shiftMonth(calendarMonth, 1)
                setCalendarMonth(next)
                setSelectedDate(`${next}-01`)
              }}
            >
               {text.next}
            </button>
          </div>
          <div className="today-calendar__weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="today-calendar__grid">
            {Array.from({ length: firstDay }).map((_, index) => (
              <div key={`empty-${index}`} className="today-calendar__empty" />
            ))}
            {days.map((day) => {
              const dateKey = `${calendarMonth}-${String(day).padStart(2, '0')}`
              const count = calendarCounts[dateKey] ?? 0
              const isSelected = dateKey === selectedDate
              const isToday = dateKey === todayDate
              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`today-calendar__day${count > 0 ? ' has-items' : ''}${isSelected ? ' is-selected' : ''}${
                    isToday ? ' is-today' : ''
                  }`}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  <span>{day}</span>
                  {count > 0 ? <em>{count}</em> : null}
                </button>
              )
            })}
          </div>
          {calendarError ? <p>{calendarError}</p> : null}
        </section>
      ) : null}

      <section
        className={isSharedView ? 'today-stats today-stats--shared' : 'd2-panel today-stats d2-stat-grid'}
        aria-label="Today stats"
      >
        {stats ? (
          <>
            <article className="d2-stat">
              <p className="d2-stat__label">{text.items}</p>
              <p className="d2-stat__value">{stats.totalItems}</p>
            </article>
            <article className="d2-stat">
              <p className="d2-stat__label">{text.unique}</p>
              <p className="d2-stat__value">{stats.uniqueItems}</p>
            </article>
            <article className="d2-stat">
              <p className="d2-stat__label">{text.runes}</p>
              <p className="d2-stat__value">{stats.runes}</p>
            </article>
          </>
        ) : (
          <p>{text.statsUnavailable}</p>
        )}
      </section>

      {!isSharedView ? (
        <section className="d2-panel today-filters" aria-label="Today filters">
          <label>
            <span className="d2-label">{text.quality}</span>
            <select className="d2-select" value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)}>
              <option value="all">{text.all}</option>
              {qualityOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="d2-label">{text.category}</span>
            <select className="d2-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">{text.all}</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {manageableItems.length > 0 ? (
        <div className="today-actions">
          <button
            type="button"
            className="d2-button d2-button--secondary d2-button--sm"
            onClick={onToggleAll}
          >
            {manageableItems.length > 0 && manageableItems.every((item) => selectedIds.has(item.id as string))
               ? text.unselectAll
               : text.selectAll}
          </button>
          <button
            type="button"
            className="d2-button d2-button--secondary d2-button--sm"
            onClick={onDeleteChecked}
            disabled={selectedIds.size === 0 || deleting}
          >
            {text.deleteChecked} ({selectedIds.size})
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
          const visualState = getItemVisualState({ analysisTags: item.analysisTags })

          return (
            <article
              key={`${item.displayName}-${item.capturedAt}-${index}`}
              className={isSharedView ? 'today-item-card today-item-card--shared' : 'd2-panel today-item-card item-themed'}
              style={isSharedView ? undefined : theme.style}
            >
              {item.id ? (
                <label className="today-item-card__select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggleSelected(item.id as string)}
                  />
                   <span>{text.select}</span>
                </label>
              ) : null}
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.displayName}
                  className={`today-item-card__thumb${visualState.isEthereal ? ' is-ethereal' : ''}`}
                />
              ) : null}
              <h3 className={isSharedView ? '' : 'item-theme-name'}>
                {item.displayName}
              </h3>
              <div className="item-theme-badges">
                <span className="item-theme-badge">{theme.rule.label}</span>
                 {item.isCorrupted ? <span className="item-theme-badge corrupted-badge">{text.corrupted}</span> : null}
                 {visualState.isEthereal ? <span className="item-theme-badge ethereal-badge">{text.ethereal}</span> : null}
                 {visualState.socketCount !== null ? (
                   <span className="item-theme-badge socket-badge">{text.socketed} ({visualState.socketCount})</span>
                 ) : null}
               </div>
               <p>{text.quality}: {item.quality}</p>
               <p>{text.qty}: {item.quantity ?? 1}</p>
               <p>{formatCapturedTime(item.capturedAt)}</p>
            </article>
          )
        })}
      </section>

      {filteredItems.length === 0 ? (
        <div className={isSharedView ? 'today-empty-shared' : 'd2-panel'}>
           <p>{text.empty}</p>
        </div>
      ) : null}
    </section>
  )
}
