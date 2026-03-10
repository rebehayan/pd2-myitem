import type { AppSettings, ItemDetail, ItemSummary, TodayPublicItem, TodayPublicPayload, TodayStats } from './types'
import { defaultAppSettings } from './settings-defaults'
import {
  clearLocalItems,
  clearLocalSettings,
  getLocalItemSummaries,
  getLocalTodayStats,
  readLocalItems,
  readLocalSettings,
  readLocalSettingsRaw,
  toItemSummary as toLocalItemSummary,
  writeLocalItems,
  writeLocalSettings,
} from './local-store'
import { getAccessToken } from './supabase'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const preferApiWithoutAuth = import.meta.env.VITE_PREFER_API_WITHOUT_AUTH !== 'false'
let apiReachabilityChecked = false
let apiReachable = false
let apiReachabilityCheckedAt = 0
const apiReachabilityTtlMs = 5000

export class ApiError extends Error {
  status: number

  constructor(status: number, message?: string) {
    super(message ?? `API request failed: ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new ApiError(res.status)
  }
  return (await res.json()) as T
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(input, { ...init, headers })
}

async function shouldUseLocal(): Promise<boolean> {
  const token = await getAccessToken()
  if (token) {
    return false
  }

  if (!preferApiWithoutAuth) {
    return true
  }

  const now = Date.now()
  if (!apiReachabilityChecked || now - apiReachabilityCheckedAt > apiReachabilityTtlMs) {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' })
      apiReachable = res.ok
    } catch {
      apiReachable = false
    }
    apiReachabilityChecked = true
    apiReachabilityCheckedAt = now
  }

  return !apiReachable
}

function sortByCapturedAtDesc<T extends { capturedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    return new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()
  })
}

function formatKeyStat(stat: ItemDetail['stats'][number]): string {
  const base = stat.statValue === null ? stat.statName : `${stat.statName} ${stat.statValue}`
  if (stat.rangeMin === null || stat.rangeMax === null) {
    return base
  }
  return `${base} [${stat.rangeMin}-${stat.rangeMax}]`
}

function formatLocalDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface CalendarDayCount {
  date: string
  count: number
}

interface ApiItemSummary {
  id: string
  type?: string
  base_type?: string
  display_name?: string
  displayName?: string
  quality: string
  quantity: number | null
  is_corrupted?: boolean
  isCorrupted?: boolean
  thumbnail: string | null
  captured_at?: string
  capturedAt?: string
  key_stats?: string[]
  category?: string
  analysis_profile?: string
  analysis_tags?: string[]
  analysisProfile?: string
  analysisTags?: string[]
}

function toItemSummary(item: ApiItemSummary): ItemSummary {
  return {
    id: item.id,
    type: item.type ?? item.base_type ?? '',
    displayName: item.display_name ?? item.displayName ?? '',
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.is_corrupted ?? item.isCorrupted ?? false,
    thumbnail: item.thumbnail,
    capturedAt: item.captured_at ?? item.capturedAt ?? new Date(0).toISOString(),
    keyStats: item.key_stats ?? [],
    category: item.category,
    analysisProfile: item.analysis_profile ?? item.analysisProfile,
    analysisTags: item.analysis_tags ?? item.analysisTags,
  }
}

export async function fetchRecentItems(): Promise<ItemSummary[]> {
  if (await shouldUseLocal()) {
    const items = readLocalItems()
    return sortByCapturedAtDesc(getLocalItemSummaries(items))
  }
  const res = await authFetch(`${API_BASE}/api/items/recent`)
  const items = await parseJson<ApiItemSummary[]>(res)
  return items.map(toItemSummary)
}

export async function fetchTodayItems(): Promise<ItemSummary[]> {
  if (await shouldUseLocal()) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const items = readLocalItems().filter((item) => new Date(item.capturedAt).getTime() >= dayStart.getTime())
    return sortByCapturedAtDesc(getLocalItemSummaries(items))
  }
  const res = await authFetch(`${API_BASE}/api/items/today`)
  const items = await parseJson<ApiItemSummary[]>(res)
  return items.map(toItemSummary)
}

export async function fetchItemsByDate(date: string): Promise<ItemSummary[]> {
  if (await shouldUseLocal()) {
    const items = readLocalItems().filter((item) => formatLocalDate(item.capturedAt) === date)
    return sortByCapturedAtDesc(getLocalItemSummaries(items))
  }
  const query = `?date=${encodeURIComponent(date)}`
  const res = await authFetch(`${API_BASE}/api/items/by-date${query}`)
  const items = await parseJson<ApiItemSummary[]>(res)
  return items.map(toItemSummary)
}

export async function fetchCalendarMonth(month: string): Promise<CalendarDayCount[]> {
  if (await shouldUseLocal()) {
    const counts = new Map<string, number>()
    for (const item of readLocalItems()) {
      const dateKey = formatLocalDate(item.capturedAt)
      if (dateKey.startsWith(`${month}-`)) {
        counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }))
  }
  const query = `?month=${encodeURIComponent(month)}`
  const res = await authFetch(`${API_BASE}/api/items/calendar${query}`)
  return parseJson<CalendarDayCount[]>(res)
}

interface ApiTodayPublicItem {
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: boolean
  thumbnail: string | null
  captured_at: string
  category?: string
  analysis_profile?: string
  analysis_tags?: string[]
}

interface ApiTodayPublicPayload {
  date: string
  stats: ApiTodayStats
  items: ApiTodayPublicItem[]
}

function toTodayPublicItem(item: ApiTodayPublicItem): TodayPublicItem {
  return {
    displayName: item.display_name,
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.is_corrupted,
    thumbnail: item.thumbnail,
    capturedAt: item.captured_at,
    category: item.category,
    analysisProfile: item.analysis_profile,
    analysisTags: item.analysis_tags,
  }
}

export async function fetchTodayPublicData(key?: string): Promise<TodayPublicPayload> {
  const query = key ? `?key=${encodeURIComponent(key)}` : ''
  const res = await authFetch(`${API_BASE}/api/today/public${query}`)
  const payload = await parseJson<ApiTodayPublicPayload>(res)
  return {
    date: payload.date,
    stats: {
      totalItems: payload.stats.total_items,
      uniqueItems: payload.stats.unique_items,
      runes: payload.stats.runes,
      materials: payload.stats.materials,
    },
    items: payload.items.map(toTodayPublicItem),
  }
}

interface ApiOverlayPayload {
  title: string
  title_enabled: boolean
  title_size?: number
  title_color?: string
  title_background_color?: string
  title_padding?: number
  overlay_minimal_mode?: boolean
  items: ApiItemSummary[]
}

export async function fetchOverlayItems(): Promise<{
  title: string
  titleEnabled: boolean
  titleSize?: number
  titleColor?: string
  titleBackgroundColor?: string
  titlePadding?: number
  minimalMode?: boolean
  items: ItemSummary[]
}> {
  if (await shouldUseLocal()) {
    const settings = readLocalSettings(defaultAppSettings)
    const limit = settings.overlay_item_limit ?? defaultAppSettings.overlay_item_limit
    const items = sortByCapturedAtDesc(readLocalItems())
      .slice(0, limit)
      .map((item) => {
        const summary = toLocalItemSummary(item)
        const derivedKeyStats = item.stats ? item.stats.slice(0, 3).map(formatKeyStat) : []
        return {
          ...summary,
          keyStats: summary.keyStats && summary.keyStats.length > 0 ? summary.keyStats : derivedKeyStats,
        }
      })

    return {
      title: settings.overlay_title ?? 'Overlay Feed',
      titleEnabled: settings.overlay_title_enabled ?? true,
      titleSize: settings.overlay_title_size,
      titleColor: settings.overlay_title_color,
      titleBackgroundColor: settings.overlay_title_background_color,
      titlePadding: settings.overlay_title_padding,
      minimalMode: settings.overlay_minimal_mode,
      items,
    }
  }
  const res = await authFetch(`${API_BASE}/api/overlay`, { cache: 'no-store' })
  const payload = await parseJson<unknown>(res)
  if (Array.isArray(payload)) {
    let fallbackTitle = 'Overlay Feed'
    let fallbackTitleEnabled = true
    let fallbackTitleSize: number | undefined
    let fallbackTitleColor: string | undefined
    let fallbackTitleBackgroundColor: string | undefined
    let fallbackTitlePadding: number | undefined
    try {
      const settings = await fetchSettings()
      fallbackTitle = settings.overlay_title ?? fallbackTitle
      fallbackTitleEnabled = settings.overlay_title_enabled ?? fallbackTitleEnabled
      fallbackTitleSize = settings.overlay_title_size
      fallbackTitleColor = settings.overlay_title_color
      fallbackTitleBackgroundColor = settings.overlay_title_background_color
      fallbackTitlePadding = settings.overlay_title_padding
    } catch {
      // ignore
    }
    return {
      title: fallbackTitle,
      titleEnabled: fallbackTitleEnabled,
      titleSize: fallbackTitleSize,
      titleColor: fallbackTitleColor,
      titleBackgroundColor: fallbackTitleBackgroundColor,
      titlePadding: fallbackTitlePadding,
      minimalMode: undefined,
      items: payload.map(toItemSummary),
    }
  }
  const overlayPayload = payload as ApiOverlayPayload
  const items = Array.isArray(overlayPayload.items) ? overlayPayload.items : []
  return {
    title: typeof overlayPayload.title === 'string' && overlayPayload.title.trim() ? overlayPayload.title : 'Overlay Feed',
    titleEnabled: typeof overlayPayload.title_enabled === 'boolean' ? overlayPayload.title_enabled : true,
    titleSize: typeof overlayPayload.title_size === 'number' ? overlayPayload.title_size : undefined,
    titleColor: typeof overlayPayload.title_color === 'string' ? overlayPayload.title_color : undefined,
    titleBackgroundColor:
      typeof overlayPayload.title_background_color === 'string' ? overlayPayload.title_background_color : undefined,
    titlePadding: typeof overlayPayload.title_padding === 'number' ? overlayPayload.title_padding : undefined,
    minimalMode: typeof overlayPayload.overlay_minimal_mode === 'boolean' ? overlayPayload.overlay_minimal_mode : undefined,
    items: items.map(toItemSummary),
  }
}

interface ApiTodayStats {
  total_items: number
  unique_items: number
  runes: number
  materials: number
}

export async function fetchTodayStats(): Promise<TodayStats> {
  if (await shouldUseLocal()) {
    return getLocalTodayStats(readLocalItems())
  }
  const res = await authFetch(`${API_BASE}/api/stats/today`)
  const stats = await parseJson<ApiTodayStats>(res)
  return {
    totalItems: stats.total_items,
    uniqueItems: stats.unique_items,
    runes: stats.runes,
    materials: stats.materials,
  }
}

export async function fetchItemDetail(id: string): Promise<ItemDetail> {
  if (await shouldUseLocal()) {
    const items = readLocalItems()
    const match = items.find((item) => item.id === id)
    if (!match) {
      throw new ApiError(404, 'Item not found')
    }
    return match
  }
  const res = await authFetch(`${API_BASE}/api/items/${id}`)
  return parseJson<ItemDetail>(res)
}

export async function deleteItem(id: string): Promise<void> {
  if (await shouldUseLocal()) {
    const items = readLocalItems()
    const next = items.filter((item) => item.id !== id)
    if (next.length === items.length) {
      throw new ApiError(404, 'Item not found')
    }
    writeLocalItems(next)
    return
  }
  const res = await authFetch(`${API_BASE}/api/items/${id}`, {
    method: 'DELETE',
  })
  await parseJson<{ deleted: boolean }>(res)
}

export async function clearItems(): Promise<number> {
  if (await shouldUseLocal()) {
    const items = readLocalItems()
    clearLocalItems()
    return items.length
  }
  const res = await authFetch(`${API_BASE}/api/items`, {
    method: 'DELETE',
  })
  const payload = await parseJson<{ deleted_items: number }>(res)
  return payload.deleted_items
}

export async function fetchSettings(): Promise<AppSettings> {
  if (await shouldUseLocal()) {
    return readLocalSettings(defaultAppSettings)
  }
  const res = await authFetch(`${API_BASE}/api/settings`)
  return parseJson<AppSettings>(res)
}

export async function updateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  if (await shouldUseLocal()) {
    const current = readLocalSettings(defaultAppSettings)
    const next = { ...current, ...payload }
    writeLocalSettings(next)
    return next
  }
  const res = await authFetch(`${API_BASE}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return parseJson<AppSettings>(res)
}

export async function syncLocalDataToServer(): Promise<{ importedItems: number; importedSettings: boolean }> {
  const items = readLocalItems()
  const settings = readLocalSettingsRaw()
  if (items.length === 0 && !settings) {
    return { importedItems: 0, importedSettings: false }
  }
  const res = await authFetch(`${API_BASE}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items, settings: settings ?? undefined }),
  })
  const payload = await parseJson<{ imported_items: number; imported_settings: boolean }>(res)
  if (payload.imported_items > 0) {
    clearLocalItems()
  }
  if (payload.imported_settings) {
    clearLocalSettings()
  }
  return { importedItems: payload.imported_items, importedSettings: payload.imported_settings }
}
