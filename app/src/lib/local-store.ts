import localforage from 'localforage'
import type { AppSettings, ItemDetail, ItemSummary, TodayStats } from './types'
import { resolveLocalThumbnailPath } from './local-thumbnail'

const LOCAL_ITEMS_KEY = 'pd2_local_items'
const LOCAL_SETTINGS_KEY = 'pd2_local_settings'
const LOCAL_SYNC_PENDING_KEY = 'pd2_local_sync_pending'
const LOCAL_CAPTURE_EVENT = 'pd2:item-captured'

// Configure localForage
const itemStorage = localforage.createInstance({
  name: 'PD2ItemTracker',
  storeName: 'items',
})

const settingsStorage = localforage.createInstance({
  name: 'PD2ItemTracker',
  storeName: 'settings',
})

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

export async function readLocalItems(): Promise<ItemDetail[]> {
  try {
    const items = await itemStorage.getItem<ItemDetail[]>(LOCAL_ITEMS_KEY)
    if (!items || !Array.isArray(items)) {
      return []
    }

    const validItems = items.filter((item): item is ItemDetail => Boolean(item && typeof item.id === 'string'))
    let didChange = false

    const normalized = validItems.map((item) => {
      const resolvedThumbnail = resolveLocalThumbnailPath({
        name: item.name,
        type: item.type,
        quality: item.quality,
        category: item.category ?? '',
        existingThumbnail: normalizeThumbnailPath(item.thumbnail ?? null),
      })

      if (resolvedThumbnail !== item.thumbnail) {
        didChange = true
        return {
          ...item,
          thumbnail: resolvedThumbnail,
        }
      }

      return item
    })

    if (didChange) {
      await itemStorage.setItem(LOCAL_ITEMS_KEY, normalized)
    }

    return normalized
  } catch {
    return []
  }
}

export async function writeLocalItems(items: ItemDetail[]) {
  await itemStorage.setItem(LOCAL_ITEMS_KEY, items)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_CAPTURE_EVENT))
  }
}

export async function clearLocalItems() {
  await itemStorage.removeItem(LOCAL_ITEMS_KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_CAPTURE_EVENT))
  }
}

export function hasLocalItems(): Promise<boolean> {
  return itemStorage.length().then((length) => length > 0)
}

export async function readLocalSettingsRaw(): Promise<AppSettings | null> {
  try {
    const stored = await settingsStorage.getItem<AppSettings>(LOCAL_SETTINGS_KEY)
    if (!stored || typeof stored !== 'object') {
      return null
    }
    return stored
  } catch {
    return null
  }
}

export async function readLocalSettings(defaults: AppSettings): Promise<AppSettings> {
  const stored = await readLocalSettingsRaw()
  if (!stored) {
    return defaults
  }
  return { ...defaults, ...stored }
}

export async function writeLocalSettings(settings: AppSettings) {
  await settingsStorage.setItem(LOCAL_SETTINGS_KEY, settings)
}

export async function clearLocalSettings() {
  await settingsStorage.removeItem(LOCAL_SETTINGS_KEY)
}

export async function markLocalSyncPending() {
  await settingsStorage.setItem(LOCAL_SYNC_PENDING_KEY, 'true')
}

export async function isLocalSyncPending(): Promise<boolean> {
  const value = await settingsStorage.getItem<string>(LOCAL_SYNC_PENDING_KEY)
  return value === 'true'
}

export async function clearLocalSyncPending() {
  await settingsStorage.removeItem(LOCAL_SYNC_PENDING_KEY)
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