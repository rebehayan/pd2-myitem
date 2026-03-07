import type { ItemDetail, ItemSummary } from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export async function fetchRecentItems(): Promise<ItemSummary[]> {
  const res = await fetch(`${API_BASE}/api/items/recent`)
  return parseJson<ItemSummary[]>(res)
}

export async function fetchTodayItems(): Promise<ItemSummary[]> {
  const res = await fetch(`${API_BASE}/api/items/today`)
  return parseJson<ItemSummary[]>(res)
}

export async function fetchItemDetail(id: string): Promise<ItemDetail> {
  const res = await fetch(`${API_BASE}/api/items/${id}`)
  return parseJson<ItemDetail>(res)
}
