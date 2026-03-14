import type { AppSettings, ItemDetail, ItemSummary, TodayStats } from './types'
import { resolveLocalThumbnailPath } from './local-thumbnail'

const LOCAL_ITEMS_KEY = 'pd2_local_items_v1'
const LOCAL_SETTINGS_KEY = 'pd2_local_settings_v1'
const LOCAL_SYNC_PENDING_KEY = 'pd2_local_sync_pending_v1'
const LOCAL_CAPTURE_EVENT = 'pd2:item-captured'

function safeParseJson<T>(value: string | null): T | null {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function safeWriteJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function readLocalItems(): ItemDetail[] {
  const parsed = safeParseJson<ItemDetail[]>(window.localStorage.getItem(LOCAL_ITEMS_KEY))
  if (!parsed || !Array.isArray(parsed)) {
    return []
  }
  return parsed.filter((item): item is ItemDetail => Boolean(item && typeof item.id === 'string'))
}

export function writeLocalItems(items: ItemDetail[]) {
  safeWriteJson(LOCAL_ITEMS_KEY, items)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_CAPTURE_EVENT))
  }
}

export function clearLocalItems() {
  window.localStorage.removeItem(LOCAL_ITEMS_KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_CAPTURE_EVENT))
  }
}

export function hasLocalItems(): boolean {
  return window.localStorage.getItem(LOCAL_ITEMS_KEY) !== null
}

export function readLocalSettingsRaw(): AppSettings | null {
  const parsed = safeParseJson<AppSettings>(window.localStorage.getItem(LOCAL_SETTINGS_KEY))
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  return parsed
}

export function readLocalSettings(defaults: AppSettings): AppSettings {
  const stored = readLocalSettingsRaw()
  if (!stored) {
    return defaults
  }
  return { ...defaults, ...stored }
}

export function writeLocalSettings(settings: AppSettings) {
  safeWriteJson(LOCAL_SETTINGS_KEY, settings)
}

export function clearLocalSettings() {
  window.localStorage.removeItem(LOCAL_SETTINGS_KEY)
}

export function markLocalSyncPending() {
  window.localStorage.setItem(LOCAL_SYNC_PENDING_KEY, 'true')
}

export function isLocalSyncPending(): boolean {
  return window.localStorage.getItem(LOCAL_SYNC_PENDING_KEY) === 'true'
}

export function clearLocalSyncPending() {
  window.localStorage.removeItem(LOCAL_SYNC_PENDING_KEY)
}

export function toItemSummary(item: ItemDetail): ItemSummary {
  const thumbnail = resolveLocalThumbnailPath({
    name: item.name,
    type: item.type,
    quality: item.quality,
    category: item.category ?? 'misc',
    existingThumbnail: normalizeThumbnailPath(item.thumbnail ?? null),
  })
  return {
    id: item.id,
    type: item.type,
    displayName: item.displayName,
    quality: item.quality,
    quantity: item.quantity,
    isCorrupted: item.isCorrupted,
    thumbnail,
    capturedAt: item.capturedAt,
    keyStats: item.keyStats ?? [],
    category: item.category,
    analysisProfile: item.analysisProfile,
    analysisTags: item.analysisTags,
  }
}

function normalizeThumbnailPath(path: string | null): string | null {
  if (!path) {
    return null
  }
  const trimmed = path.trim()
  if (!trimmed) {
    return null
  }
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || lower.startsWith('blob:')) {
    return trimmed
  }
  const iconsIndex = lower.indexOf('/icons/')
  if (iconsIndex >= 0) {
    return trimmed.slice(iconsIndex)
  }
  if (lower.startsWith('icons/')) {
    return `/${trimmed}`
  }
  if (lower.startsWith('./icons/')) {
    return `/${trimmed.slice(2)}`
  }
  return trimmed
}

export function getLocalItemSummaries(items: ItemDetail[]): ItemSummary[] {
  return items.map(toItemSummary)
}

export function getLocalTodayStats(items: ItemDetail[]): TodayStats {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const todayItems = items.filter((item) => new Date(item.capturedAt).getTime() >= dayStart.getTime())
  const totalItems = todayItems.length
  const uniqueItems = todayItems.filter((row) => row.quality?.toLowerCase() === 'unique').length
  const runes = todayItems.filter((row) => row.category === 'rune').length
  const materials = todayItems.filter((row) => row.category === 'material').length

  return {
    totalItems,
    uniqueItems,
    runes,
    materials,
  }
}
