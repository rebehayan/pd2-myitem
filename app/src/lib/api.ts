import type { AppSettings, ItemDetail, ItemSummary, TodayStats } from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

interface ApiItemSummary {
  id: string
  display_name?: string
  displayName?: string
  quality: string
  quantity: number | null
  is_corrupted?: boolean
  isCorrupted?: boolean
  thumbnail: string | null
  captured_at?: string
  capturedAt?: string
}

function toItemSummary(item: ApiItemSummary): ItemSummary {
  return {
    id: item.id,
    displayName: item.display_name ?? item.displayName ?? '',
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.is_corrupted ?? item.isCorrupted ?? false,
    thumbnail: item.thumbnail,
    capturedAt: item.captured_at ?? item.capturedAt ?? new Date(0).toISOString(),
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

export async function fetchOverlayItems(): Promise<ItemSummary[]> {
  const res = await fetch(`${API_BASE}/api/overlay`)
  const items = await parseJson<ApiItemSummary[]>(res)
  return items.map(toItemSummary)
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
