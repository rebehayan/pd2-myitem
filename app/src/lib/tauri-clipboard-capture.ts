import { markLocalSyncPending, readLocalItems, writeLocalItems } from './local-store'
import { resolveLocalThumbnailPath } from './local-thumbnail'
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
  thumbnail?: string
  iconPath?: string
  icon_path?: string
  image?: string
  image_url?: string
}

const pollIntervalMs = 1200
const maxLocalItems = 400
const captureStatusKey = 'pd2_capture_status'
const captureLastErrorKey = 'pd2_capture_last_error'
const captureLastSeenAtKey = 'pd2_capture_last_seen_at'
const captureLastPayloadKey = 'pd2_capture_last_payload'
const captureSourceKey = 'pd2_capture_source'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function mirrorOverlayItemsSnapshot(items: ItemDetail[]): Promise<void> {
  if (!isTauriRuntime()) {
    return
  }
  const payload = {
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      displayName: item.displayName,
      quality: item.quality,
      quantity: item.quantity,
      isCorrupted: item.isCorrupted,
      thumbnail: item.thumbnail,
      capturedAt: item.capturedAt,
      keyStats: item.keyStats,
      category: item.category,
      analysisProfile: item.analysisProfile,
      analysisTags: item.analysisTags,
    })),
  }
  try {
    await fetch('http://127.0.0.1:4310/api/items/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
  } catch {
    void 0
  }
}

function setCaptureStatus(status: string) {
  window.localStorage.setItem(captureStatusKey, status)
}

function setCaptureSource(source: string) {
  window.localStorage.setItem(captureSourceKey, source)
}

function setCaptureError(message: string) {
  window.localStorage.setItem(captureLastErrorKey, message)
}

function clearCaptureError() {
  window.localStorage.removeItem(captureLastErrorKey)
}

function setCaptureSeen(rawText: string) {
  window.localStorage.setItem(captureLastSeenAtKey, new Date().toISOString())
  window.localStorage.setItem(captureLastPayloadKey, rawText.slice(0, 220))
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

  const candidate = 'item' in value && (value as { item?: unknown }).item && typeof (value as { item?: unknown }).item === 'object'
    ? ((value as { item: RawClipboardItem }).item as RawClipboardItem)
    : (value as RawClipboardItem)

  const hasType = typeof candidate.type === 'string' && candidate.type.trim().length > 0
  const hasQuality = typeof candidate.quality === 'string' && candidate.quality.trim().length > 0
  const hasLocation = typeof candidate.location === 'string' && candidate.location.trim().length > 0
  const hasILevel = typeof candidate.iLevel === 'number'
  const hasQuantity = typeof candidate.quantity === 'number'
  const hasDefense = typeof candidate.defense === 'number'
  const hasStats = Array.isArray(candidate.stats) && candidate.stats.length > 0
  const hasName = typeof candidate.name === 'string' && candidate.name.trim().length > 0

  if (!hasType || !hasQuality) {
    return false
  }

  return hasLocation || hasILevel || hasQuantity || hasDefense || hasStats || hasName
}

function parseClipboardPayload(rawText: string): unknown | null {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return null
  }

  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
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
  if (normalized.includes('rune') || normalized.includes('룬')) {
    return 'rune'
  }
  if (normalized.includes('map') || normalized.includes('shard') || normalized.includes('맵') || normalized.includes('파편')) {
    return 'map'
  }
  if (quantity !== null && quantity > 1) {
    return 'material'
  }
  if (normalized.includes('ring') || normalized.includes('반지') || normalized.includes('amulet') || normalized.includes('necklace') || normalized.includes('목걸이')) {
    return 'jewelry'
  }
  if (normalized.includes('charm')) {
    return 'charm'
  }
  if (normalized.includes('jewel')) {
    return 'jewel'
  }
  return 'misc'
}

function pickRawThumbnail(item: RawClipboardItem): string | null {
  const candidates = [item.thumbnail, item.iconPath, item.icon_path, item.image, item.image_url]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue
    }
    const trimmed = candidate.trim()
    if (trimmed) {
      return trimmed
    }
  }
  return null
}

function pickRawThumbnailFromPayload(rawPayload: unknown, item: RawClipboardItem): string | null {
  const fromItem = pickRawThumbnail(item)
  if (fromItem) {
    return fromItem
  }
  if (!rawPayload || typeof rawPayload !== 'object') {
    return null
  }
  const raw = rawPayload as Record<string, unknown>
  for (const key of ['thumbnail', 'iconPath', 'icon_path', 'image', 'image_url']) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
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
  const rawThumbnail = pickRawThumbnailFromPayload(rawPayload, item)
  const thumbnail = resolveLocalThumbnailPath({
    name: typeof item.name === 'string' ? item.name : null,
    type: item.type,
    quality: item.quality,
    category,
    existingThumbnail: rawThumbnail,
  })

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
    thumbnail,
    capturedAt: nowIso,
    category,
    analysisProfile: 'unknown',
    analysisTags: [`quality:${item.quality.trim().toLowerCase()}`, `category:${category}`, `fingerprint:${fingerprint}`],
    keyStats: buildKeyStats(stats),
    stats,
  }
}

function isDuplicate(items: ItemDetail[], fingerprint: string, nowMs: number): boolean {
  const threshold = nowMs - 5000
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
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (!isTauriRuntime()) {
    setCaptureStatus('inactive_non_tauri')
    return () => {}
  }

  let disposed = false
  let lastPayload = ''

  const run = async () => {
    if (disposed) {
      return
    }

    try {
      let rawText = ''
      try {
        const plugin = await import('@tauri-apps/plugin-clipboard-manager')
        rawText = (await plugin.readText()).trim()
        setCaptureSource('tauri-plugin')
      } catch (pluginError) {
        setCaptureError(pluginError instanceof Error ? pluginError.message : 'clipboard plugin error')
        if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
          try {
            rawText = (await navigator.clipboard.readText()).trim()
            setCaptureSource('navigator-clipboard')
          } catch (webError) {
            setCaptureError(webError instanceof Error ? webError.message : 'navigator clipboard error')
            setCaptureStatus('read_failed')
            return
          }
        } else {
          setCaptureStatus('read_failed')
          return
        }
      }

      if (!rawText || rawText === lastPayload) {
        setCaptureStatus('idle')
        return
      }
      const parsed = parseClipboardPayload(rawText)
      let detail: ItemDetail | null = null
      if (parsed) {
        detail = await toItemDetail(parsed)
      }
      if (!detail) {
        lastPayload = rawText
        setCaptureStatus('ignored_non_item')
        return
      }

      setCaptureSeen(rawText)

      const fingerprintTag = detail.analysisTags?.find((tag) => tag.startsWith('fingerprint:'))
      const fingerprint = fingerprintTag ? fingerprintTag.replace('fingerprint:', '') : ''
      const items = await readLocalItems()
      if (fingerprint && isDuplicate(items, fingerprint, Date.now())) {
        lastPayload = rawText
        setCaptureStatus('duplicate_ignored')
        return
      }

      const next = [withFingerprint(detail, fingerprint), ...items].slice(0, maxLocalItems)
      await writeLocalItems(next)
      await mirrorOverlayItemsSnapshot(next)
      await markLocalSyncPending()
      lastPayload = rawText
      clearCaptureError()
      setCaptureStatus('captured')
    } catch {
      setCaptureStatus('capture_error')
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
