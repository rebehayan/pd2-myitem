import { markLocalSyncPending, readLocalItems, writeLocalItems } from './local-store'
import type { ItemDetail, ItemStat } from './types'

interface RawClipboardStat {
  name?: string
  value?: number
  corrupted?: number
  range?: {
    min?: number
    max?: number
  }
}

interface RawClipboardItem {
  name?: string
  type?: string
  iLevel?: number
  location?: string
  quality?: string
  defense?: number
  quantity?: number
  corrupted?: boolean | number
  stats?: RawClipboardStat[]
}

const pollIntervalMs = 1200
const maxLocalItems = 400

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function canonicalizeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(',')}]`
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, innerValue]) => `${JSON.stringify(key)}:${canonicalizeJson(innerValue)}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value)
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function looksLikePd2Payload(value: unknown): value is RawClipboardItem | { item: RawClipboardItem } {
  if (!value || typeof value !== 'object') {
    return false
  }
  if ('type' in value && typeof (value as RawClipboardItem).type === 'string') {
    return true
  }
  if (
    'item' in value &&
    (value as { item?: unknown }).item &&
    typeof (value as { item?: unknown }).item === 'object' &&
    typeof ((value as { item: RawClipboardItem }).item?.type) === 'string'
  ) {
    return true
  }
  return false
}

function toCoreItem(value: RawClipboardItem | { item: RawClipboardItem }): RawClipboardItem {
  if ('item' in value && value.item && typeof value.item === 'object') {
    return value.item as RawClipboardItem
  }
  return value as RawClipboardItem
}

function toItemStats(rawStats: RawClipboardStat[] | undefined): ItemStat[] {
  const stats = rawStats ?? []
  return stats
    .filter((entry) => typeof entry.name === 'string' && entry.name.trim().length > 0)
    .map((entry) => ({
      statName: entry.name as string,
      statValue: typeof entry.value === 'number' ? entry.value : null,
      rangeMin: typeof entry.range?.min === 'number' ? entry.range.min : null,
      rangeMax: typeof entry.range?.max === 'number' ? entry.range.max : null,
      isCorrupted: entry.corrupted === 1 || entry.name?.trim().toLowerCase() === 'corrupt',
    }))
}

function buildKeyStats(stats: ItemStat[]): string[] {
  return stats.slice(0, 3).map((stat) => {
    const base = stat.statValue === null ? stat.statName : `${stat.statName} ${stat.statValue}`
    if (stat.rangeMin === null || stat.rangeMax === null) {
      return base
    }
    return `${base} [${stat.rangeMin}-${stat.rangeMax}]`
  })
}

function detectCorrupted(item: RawClipboardItem, stats: ItemStat[]): boolean {
  if (item.corrupted === true || item.corrupted === 1) {
    return true
  }
  return stats.some((stat) => stat.isCorrupted)
}

function detectCategory(type: string, quantity: number | null): string {
  const normalized = type.trim().toLowerCase()
  if (normalized.includes('rune')) {
    return 'rune'
  }
  if (normalized.includes('map') || normalized.includes('shard')) {
    return 'map'
  }
  if (quantity !== null && quantity > 1) {
    return 'material'
  }
  if (normalized.includes('charm')) {
    return 'charm'
  }
  if (normalized.includes('jewel')) {
    return 'jewel'
  }
  return 'misc'
}

async function toItemDetail(rawPayload: unknown): Promise<ItemDetail | null> {
  if (!looksLikePd2Payload(rawPayload)) {
    return null
  }
  const item = toCoreItem(rawPayload)
  if (!item.type || !item.quality) {
    return null
  }

  const stats = toItemStats(item.stats)
  const quantity = typeof item.quantity === 'number' ? item.quantity : null
  const fingerprint = await sha256Hex(canonicalizeJson(rawPayload))
  const nowIso = new Date().toISOString()
  const isCorrupted = detectCorrupted(item, stats)
  const category = detectCategory(item.type, quantity)

  return {
    id: crypto.randomUUID(),
    name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name : null,
    type: item.type,
    iLevel: typeof item.iLevel === 'number' ? item.iLevel : 0,
    location: typeof item.location === 'string' && item.location.trim() ? item.location : 'Unknown',
    defense: typeof item.defense === 'number' ? item.defense : null,
    displayName: typeof item.name === 'string' && item.name.trim() ? item.name : item.type,
    quality: item.quality,
    quantity,
    isCorrupted,
    thumbnail: 'icons/generic/item_unknown.svg',
    capturedAt: nowIso,
    category,
    analysisProfile: 'unknown',
    analysisTags: [`quality:${item.quality.trim().toLowerCase()}`, `category:${category}`, `fingerprint:${fingerprint}`],
    keyStats: buildKeyStats(stats),
    stats,
  }
}

function isDuplicate(items: ItemDetail[], fingerprint: string, nowMs: number): boolean {
  const threshold = nowMs - 3000
  return items.some((entry) => {
    const hasFingerprint = entry.analysisTags?.includes(`fingerprint:${fingerprint}`)
    if (!hasFingerprint) {
      return false
    }
    return new Date(entry.capturedAt).getTime() >= threshold
  })
}

function withFingerprint(item: ItemDetail, fingerprint: string): ItemDetail {
  return {
    ...item,
    analysisTags: [...(item.analysisTags ?? []), `fingerprint:${fingerprint}`],
  }
}

export function startTauriClipboardCapture(): () => void {
  if (!isTauriRuntime()) {
    return () => {}
  }

  let disposed = false
  let lastPayload = ''

  const run = async () => {
    if (disposed) {
      return
    }

    try {
      const plugin = await import('@tauri-apps/plugin-clipboard-manager')
      const rawText = (await plugin.readText()).trim()
      if (!rawText || rawText === lastPayload) {
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(rawText)
      } catch {
        lastPayload = rawText
        return
      }

      const detail = await toItemDetail(parsed)
      if (!detail) {
        lastPayload = rawText
        return
      }

      const fingerprintTag = detail.analysisTags?.find((tag) => tag.startsWith('fingerprint:'))
      const fingerprint = fingerprintTag ? fingerprintTag.replace('fingerprint:', '') : ''
      const items = readLocalItems()
      if (fingerprint && isDuplicate(items, fingerprint, Date.now())) {
        lastPayload = rawText
        return
      }

      const next = [withFingerprint(detail, fingerprint), ...items].slice(0, maxLocalItems)
      writeLocalItems(next)
      markLocalSyncPending()
      lastPayload = rawText
    } catch {
      return
    }
  }

  const timer = window.setInterval(() => {
    void run()
  }, pollIntervalMs)
  void run()

  return () => {
    disposed = true
    window.clearInterval(timer)
  }
}
