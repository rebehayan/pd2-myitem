import type { AppSettings, ItemDetail, ItemSummary, TodayPublicItem, TodayPublicPayload, TodayStats } from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

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
  const res = await fetch(`${API_BASE}/api/items/recent`)
  const items = await parseJson<ApiItemSummary[]>(res)
  return items.map(toItemSummary)
}

export async function fetchTodayItems(): Promise<ItemSummary[]> {
  const res = await fetch(`${API_BASE}/api/items/today`)
  const items = await parseJson<ApiItemSummary[]>(res)
  return items.map(toItemSummary)
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
  const res = await fetch(`${API_BASE}/api/today/public${query}`)
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
  items: ApiItemSummary[]
}

export async function fetchOverlayItems(): Promise<{
  title: string
  titleEnabled: boolean
  titleSize?: number
  titleColor?: string
  titleBackgroundColor?: string
  titlePadding?: number
  items: ItemSummary[]
}> {
  const res = await fetch(`${API_BASE}/api/overlay`, { cache: 'no-store' })
  const payload = await parseJson<unknown>(res)
  if (Array.isArray(payload)) {
    let fallbackTitle = 'Overlay Feed'
    let fallbackTitleEnabled = true
    try {
      const settings = await fetchSettings()
      fallbackTitle = settings.overlay_title ?? fallbackTitle
      fallbackTitleEnabled = settings.overlay_title_enabled ?? fallbackTitleEnabled
    } catch {
      // ignore
    }
    return {
      title: fallbackTitle,
      titleEnabled: fallbackTitleEnabled,
      titleSize: settings.overlay_title_size,
      titleColor: settings.overlay_title_color,
      titleBackgroundColor: settings.overlay_title_background_color,
      titlePadding: settings.overlay_title_padding,
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
  const res = await fetch(`${API_BASE}/api/stats/today`)
  const stats = await parseJson<ApiTodayStats>(res)
  return {
    totalItems: stats.total_items,
    uniqueItems: stats.unique_items,
    runes: stats.runes,
    materials: stats.materials,
  }
}

export async function fetchItemDetail(id: string): Promise<ItemDetail> {
  const res = await fetch(`${API_BASE}/api/items/${id}`)
  return parseJson<ItemDetail>(res)
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/items/${id}`, {
    method: 'DELETE',
  })
  await parseJson<{ deleted: boolean }>(res)
}

export async function clearItems(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/items`, {
    method: 'DELETE',
  })
  const payload = await parseJson<{ deleted_items: number }>(res)
  return payload.deleted_items
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`)
  return parseJson<AppSettings>(res)
}

export async function updateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return parseJson<AppSettings>(res)
}
