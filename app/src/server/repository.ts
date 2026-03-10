import { randomUUID } from 'node:crypto'
import type { PostgrestError } from '@supabase/supabase-js'
import { resolveThumbnail } from './icon-mapping'
import { supabaseAdmin, supabaseConfigured } from './supabase'
import type { ParsedItem } from './types'

function raiseIfError(error: PostgrestError | null, context: string): void {
  if (error) {
    throw new Error(`[supabase] ${context}: ${error.message}`)
  }
}

interface MemorySession {
  id: string
  active: boolean
}

interface MemoryItem {
  id: string
  sessionId: string
  capturedAt: string
  name: string | null
  baseType: string
  quality: string
  itemLevel: number
  location: string
  defense: number | null
  quantity: number | null
  displayName: string
  isCorrupted: boolean
  category: string
  analysisProfile: string
  analysisTags: string[]
  fingerprint: string
}

interface MemoryStat {
  id: number
  itemId: string
  statName: string
  statValue: number | null
  rangeMin: number | null
  rangeMax: number | null
  statId: number | null
  corrupted: boolean
}

const memorySessions: MemorySession[] = []
const memoryItems: MemoryItem[] = []
const memoryStats: MemoryStat[] = []
let memoryStatSeq = 0

async function getOrCreateActiveSessionId(): Promise<string> {
  if (!supabaseConfigured || !supabaseAdmin) {
    const existing = memorySessions.find((session) => session.active)
    if (existing) {
      return existing.id
    }

    const id = randomUUID()
    memorySessions.push({ id, active: true })
    return id
  }

  const { data: existing, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  raiseIfError(sessionError, 'fetch active session')

  if (existing?.id) {
    return existing.id
  }

  const id = randomUUID()
  const nowIso = new Date().toISOString()
  const { error: insertError } = await supabaseAdmin.from('sessions').insert({
    id,
    title: `Session ${nowIso.slice(0, 10)}`,
    started_at: nowIso,
    active: true,
  })

  raiseIfError(insertError, 'create session')
  return id
}

export interface SaveParsedItemResult {
  inserted: boolean
  id: string | null
  capturedAt: string | null
  displayName: string | null
}

export async function saveParsedItem(item: ParsedItem): Promise<SaveParsedItemResult> {
  if (!supabaseConfigured || !supabaseAdmin) {
    const threshold = Date.now() - 3000
    const duplicate = [...memoryItems]
      .reverse()
      .find((entry) => entry.fingerprint === item.fingerprint && new Date(entry.capturedAt).getTime() >= threshold)

    if (duplicate) {
      return { inserted: false, id: duplicate.id, capturedAt: null, displayName: null }
    }

    const itemId = randomUUID()
    const sessionId = await getOrCreateActiveSessionId()
    const nowIso = new Date().toISOString()

    memoryItems.push({
      id: itemId,
      sessionId,
      capturedAt: nowIso,
      name: item.name,
      baseType: item.type,
      quality: item.quality,
      itemLevel: item.iLevel,
      location: item.location,
      defense: item.defense,
      quantity: item.quantity,
      displayName: item.displayName,
      isCorrupted: item.isCorrupted,
      category: item.category,
      analysisProfile: item.analysisProfile,
      analysisTags: item.analysisTags,
      fingerprint: item.fingerprint,
    })

    for (const stat of item.stats) {
      memoryStatSeq += 1
      memoryStats.push({
        id: memoryStatSeq,
        itemId,
        statName: stat.statName,
        statValue: stat.statValue,
        rangeMin: stat.rangeMin,
        rangeMax: stat.rangeMax,
        statId: stat.statId,
        corrupted: stat.isCorrupted,
      })
    }

    return { inserted: true, id: itemId, capturedAt: nowIso, displayName: item.displayName }
  }

  const threshold = new Date(Date.now() - 3000).toISOString()
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('items')
    .select('id')
    .eq('fingerprint', item.fingerprint)
    .gte('captured_at', threshold)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  raiseIfError(existingError, 'check duplicate fingerprint')

  if (existing?.id) {
    return { inserted: false, id: existing.id, capturedAt: null, displayName: null }
  }

  const itemId = randomUUID()
  const sessionId = await getOrCreateActiveSessionId()
  const nowIso = new Date().toISOString()

  const { error: insertError } = await supabaseAdmin.from('items').insert({
    id: itemId,
    captured_at: nowIso,
    session_id: sessionId,
    name: item.name,
    base_type: item.type,
    quality: item.quality,
    item_level: item.iLevel,
    location: item.location,
    defense: item.defense,
    quantity: item.quantity,
    display_name: item.displayName,
    is_corrupted: item.isCorrupted,
    icon_key: item.iconKey,
    category: item.category,
    analysis_profile: item.analysisProfile,
    analysis_tags: item.analysisTags,
    raw_json: item.rawJson,
    fingerprint: item.fingerprint,
  })

  raiseIfError(insertError, 'insert item')

  if (item.stats.length > 0) {
    const { error: statError } = await supabaseAdmin.from('item_stats').insert(
      item.stats.map((stat) => ({
        item_id: itemId,
        stat_name: stat.statName,
        stat_value: stat.statValue,
        range_min: stat.rangeMin,
        range_max: stat.rangeMax,
        stat_id: stat.statId,
        corrupted: stat.isCorrupted,
      })),
    )
    raiseIfError(statError, 'insert item stats')
  }

  return { inserted: true, id: itemId, capturedAt: nowIso, displayName: item.displayName }
}

interface ItemSummaryRow {
  id: string
  name: string | null
  base_type: string
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: boolean
  category: string
  analysis_profile: string
  analysis_tags: unknown
  captured_at: string
}

function parseAnalysisTags(rawTags: unknown): string[] {
  if (Array.isArray(rawTags)) {
    return rawTags.filter((entry): entry is string => typeof entry === 'string')
  }
  if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string')
      }
    } catch {
      return []
    }
  }
  return []
}

function mapSummaryRow(row: ItemSummaryRow) {
  const thumbnail = resolveThumbnail({
    baseType: row.base_type,
    itemName: row.name,
    quality: row.quality,
    quantity: row.quantity,
    isCorrupted: Boolean(row.is_corrupted),
  })

  return {
    id: row.id,
    type: row.base_type,
    category: row.category,
    displayName: row.display_name,
    quality: row.quality,
    quantity: row.quantity,
    isCorrupted: Boolean(row.is_corrupted),
    thumbnail: thumbnail.iconPath,
    analysisProfile: row.analysis_profile,
    analysisTags: parseAnalysisTags(row.analysis_tags),
    capturedAt: row.captured_at,
  }
}

interface KeyStatRow {
  stat_name: string
  stat_value: number | null
  range_min: number | null
  range_max: number | null
}

function formatKeyStat(row: KeyStatRow): string {
  const base = row.stat_value === null ? row.stat_name : `${row.stat_name} ${row.stat_value}`
  if (row.range_min === null || row.range_max === null) {
    return base
  }
  return `${base} [${row.range_min}-${row.range_max}]`
}

async function getKeyStatsForItem(itemId: string, limit = 3): Promise<string[]> {
  if (!supabaseConfigured || !supabaseAdmin) {
    return memoryStats
      .filter((stat) => stat.itemId === itemId && stat.rangeMin !== null && stat.rangeMax !== null)
      .sort((left, right) => left.id - right.id)
      .slice(0, limit)
      .map((row) =>
        formatKeyStat({
          stat_name: row.statName,
          stat_value: row.statValue,
          range_min: row.rangeMin,
          range_max: row.rangeMax,
        }),
      )
  }

  const { data: rows, error } = await supabaseAdmin
    .from('item_stats')
    .select('stat_name, stat_value, range_min, range_max')
    .eq('item_id', itemId)
    .not('range_min', 'is', null)
    .not('range_max', 'is', null)
    .order('id', { ascending: true })
    .limit(limit)

  raiseIfError(error, 'fetch key stats')
  return (rows ?? []).map(formatKeyStat)
}

export async function getRecentItems(limit = 20) {
  if (!supabaseConfigured || !supabaseAdmin) {
    return [...memoryItems]
      .sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime())
      .slice(0, limit)
      .map((item) => {
        const thumbnail = resolveThumbnail({
          baseType: item.baseType,
          itemName: item.name,
          quality: item.quality,
          quantity: item.quantity,
          isCorrupted: item.isCorrupted,
        })

        return {
          id: item.id,
          type: item.baseType,
          category: item.category,
          displayName: item.displayName,
          quality: item.quality,
          quantity: item.quantity,
          isCorrupted: item.isCorrupted,
          thumbnail: thumbnail.iconPath,
          analysisProfile: item.analysisProfile,
          analysisTags: item.analysisTags,
          capturedAt: item.capturedAt,
        }
      })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('items')
    .select(
      'id, name, base_type, display_name, quality, quantity, is_corrupted, category, analysis_profile, analysis_tags, captured_at',
    )
    .order('captured_at', { ascending: false })
    .limit(limit)

  raiseIfError(error, 'fetch recent items')
  return (rows ?? []).map(mapSummaryRow)
}

export async function getTodayItems() {
  if (!supabaseConfigured || !supabaseAdmin) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    return (await getRecentItems(Number.MAX_SAFE_INTEGER)).filter(
      (item) => new Date(item.capturedAt).getTime() >= dayStart.getTime(),
    )
  }

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const { data: rows, error } = await supabaseAdmin
    .from('items')
    .select(
      'id, name, base_type, display_name, quality, quantity, is_corrupted, category, analysis_profile, analysis_tags, captured_at',
    )
    .gte('captured_at', dayStart.toISOString())
    .lt('captured_at', dayEnd.toISOString())
    .order('captured_at', { ascending: false })

  raiseIfError(error, 'fetch today items')
  return (rows ?? []).map(mapSummaryRow)
}

export async function getItemsByDate(date: string) {
  if (!supabaseConfigured || !supabaseAdmin) {
    const dayStart = new Date(`${date}T00:00:00`)
    if (Number.isNaN(dayStart.getTime())) {
      throw new Error('Invalid date')
    }
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return (await getRecentItems(Number.MAX_SAFE_INTEGER)).filter((item) => {
      const captured = new Date(item.capturedAt).getTime()
      return captured >= dayStart.getTime() && captured < dayEnd.getTime()
    })
  }

  const dayStart = new Date(`${date}T00:00:00`)
  if (Number.isNaN(dayStart.getTime())) {
    throw new Error('Invalid date')
  }
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const { data: rows, error } = await supabaseAdmin
    .from('items')
    .select(
      'id, name, base_type, display_name, quality, quantity, is_corrupted, category, analysis_profile, analysis_tags, captured_at',
    )
    .gte('captured_at', dayStart.toISOString())
    .lt('captured_at', dayEnd.toISOString())
    .order('captured_at', { ascending: false })

  raiseIfError(error, 'fetch items by date')
  return (rows ?? []).map(mapSummaryRow)
}

interface ItemDateRow {
  captured_at: string
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

export async function getItemDateCountsByMonth(month: string) {
  if (!supabaseConfigured || !supabaseAdmin) {
    const monthStart = new Date(`${month}-01T00:00:00`)
    if (Number.isNaN(monthStart.getTime())) {
      throw new Error('Invalid month')
    }
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const counts = new Map<string, number>()
    for (const item of memoryItems) {
      const captured = new Date(item.capturedAt).getTime()
      if (captured < monthStart.getTime() || captured >= monthEnd.getTime()) {
        continue
      }
      const dateKey = formatLocalDate(item.capturedAt)
      if (!dateKey) {
        continue
      }
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1)
    }

    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }))
  }

  const monthStart = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(monthStart.getTime())) {
    throw new Error('Invalid month')
  }
  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1)
  const { data: rows, error } = await supabaseAdmin
    .from('items')
    .select('captured_at')
    .gte('captured_at', monthStart.toISOString())
    .lt('captured_at', monthEnd.toISOString())

  raiseIfError(error, 'fetch item date counts')

  const counts = new Map<string, number>()
  for (const row of rows ?? []) {
    const dateKey = formatLocalDate((row as ItemDateRow).captured_at)
    if (!dateKey) {
      continue
    }
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }))
}

export async function getOverlayItems(limit = 10) {
  const items = await getRecentItems(limit)
  const enriched = await Promise.all(
    items.map(async (item) => ({
      ...item,
      keyStats: await getKeyStatsForItem(item.id),
    })),
  )
  return enriched
}

export async function getTodayStats() {
  if (!supabaseConfigured || !supabaseAdmin) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const safeRows = memoryItems.filter((item) => new Date(item.capturedAt).getTime() >= dayStart.getTime())
    const totalItems = safeRows.length
    const uniqueItems = safeRows.filter((row) => row.quality.toLowerCase() === 'unique').length
    const runes = safeRows.filter((row) => row.category === 'rune').length
    const materials = safeRows.filter((row) => row.category === 'material').length

    return {
      totalItems,
      uniqueItems,
      runes,
      materials,
    }
  }

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const { data: rows, error } = await supabaseAdmin
    .from('items')
    .select('quality, category')
    .gte('captured_at', dayStart.toISOString())

  raiseIfError(error, 'fetch today stats')

  const safeRows = rows ?? []
  const totalItems = safeRows.length
  const uniqueItems = safeRows.filter((row) => row.quality?.toLowerCase() === 'unique').length
  const runes = safeRows.filter((row) => row.category === 'rune').length
  const materials = safeRows.filter((row) => row.category === 'material').length

  return {
    totalItems,
    uniqueItems,
    runes,
    materials,
  }
}

interface StatRow {
  stat_name: string
  stat_value: number | null
  range_min: number | null
  range_max: number | null
  corrupted: boolean
}

export async function getItemById(id: string) {
  if (!supabaseConfigured || !supabaseAdmin) {
    const row = memoryItems.find((item) => item.id === id)
    if (!row) {
      return null
    }

    const stats = memoryStats.filter((stat) => stat.itemId === id)
    const thumbnail = resolveThumbnail({
      baseType: row.baseType,
      itemName: row.name,
      quality: row.quality,
      quantity: row.quantity,
      isCorrupted: row.isCorrupted,
    })

    return {
      id: row.id,
      name: row.name,
      type: row.baseType,
      iLevel: row.itemLevel,
      location: row.location,
      defense: row.defense,
      displayName: row.displayName,
      quality: row.quality,
      quantity: row.quantity,
      isCorrupted: row.isCorrupted,
      thumbnail: thumbnail.iconPath,
      category: row.category,
      analysisProfile: row.analysisProfile,
      analysisTags: row.analysisTags,
      capturedAt: row.capturedAt,
      stats: stats.map((stat) => ({
        statName: stat.statName,
        statValue: stat.statValue,
        rangeMin: stat.rangeMin,
        rangeMax: stat.rangeMax,
        isCorrupted: stat.corrupted,
      })),
    }
  }

  const { data: row, error } = await supabaseAdmin
    .from('items')
    .select(
      'id, name, base_type, item_level, location, defense, display_name, quality, quantity, is_corrupted, icon_key, category, analysis_profile, analysis_tags, captured_at',
    )
    .eq('id', id)
    .maybeSingle()

  raiseIfError(error, 'fetch item detail')

  if (!row) {
    return null
  }

  const { data: stats, error: statError } = await supabaseAdmin
    .from('item_stats')
    .select('stat_name, stat_value, range_min, range_max, corrupted')
    .eq('item_id', id)

  raiseIfError(statError, 'fetch item stats')

  const thumbnail = resolveThumbnail({
    baseType: row.base_type,
    itemName: row.name,
    quality: row.quality,
    quantity: row.quantity,
    isCorrupted: Boolean(row.is_corrupted),
  })

  return {
    id: row.id,
    name: row.name,
    type: row.base_type,
    iLevel: row.item_level,
    location: row.location,
    defense: row.defense,
    displayName: row.display_name,
    quality: row.quality,
    quantity: row.quantity,
    isCorrupted: Boolean(row.is_corrupted),
    thumbnail: thumbnail.iconPath,
    category: row.category,
    analysisProfile: row.analysis_profile,
    analysisTags: parseAnalysisTags(row.analysis_tags),
    capturedAt: row.captured_at,
    stats: (stats ?? []).map((stat: StatRow) => ({
      statName: stat.stat_name,
      statValue: stat.stat_value,
      rangeMin: stat.range_min,
      rangeMax: stat.range_max,
      isCorrupted: Boolean(stat.corrupted),
    })),
  }
}

export async function deleteItemById(id: string): Promise<boolean> {
  if (!supabaseConfigured || !supabaseAdmin) {
    const index = memoryItems.findIndex((item) => item.id === id)
    if (index < 0) {
      return false
    }
    memoryItems.splice(index, 1)
    for (let i = memoryStats.length - 1; i >= 0; i -= 1) {
      if (memoryStats[i]?.itemId === id) {
        memoryStats.splice(i, 1)
      }
    }
    return true
  }

  const { error: statError } = await supabaseAdmin.from('item_stats').delete().eq('item_id', id)
  raiseIfError(statError, 'delete item stats')

  const { data, error } = await supabaseAdmin.from('items').delete().eq('id', id).select('id')
  raiseIfError(error, 'delete item')

  return (data ?? []).length > 0
}

export async function clearAllItems(): Promise<{ deletedItems: number }> {
  if (!supabaseConfigured || !supabaseAdmin) {
    const deletedItems = memoryItems.length
    memoryItems.splice(0, memoryItems.length)
    memoryStats.splice(0, memoryStats.length)
    memorySessions.splice(0, memorySessions.length)
    memoryStatSeq = 0
    return { deletedItems }
  }

  const { count, error: countError } = await supabaseAdmin
    .from('items')
    .select('id', { count: 'exact', head: true })

  raiseIfError(countError, 'count items')

  const { error: statsError } = await supabaseAdmin.from('item_stats').delete().gt('id', 0)
  raiseIfError(statsError, 'clear item stats')

  const { error: itemsError } = await supabaseAdmin.from('items').delete().neq('id', '')
  raiseIfError(itemsError, 'clear items')

  const { error: sessionsError } = await supabaseAdmin.from('sessions').delete().neq('id', '')
  raiseIfError(sessionsError, 'clear sessions')

  return { deletedItems: count ?? 0 }
}
