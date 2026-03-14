import { randomUUID } from 'node:crypto'
import type { PostgrestError } from '@supabase/supabase-js'
import { db } from './db'
import { resolveThumbnail } from './icon-mapping'
import { enqueueSyncOperation } from './sync-repository'
import { requireSyncOwnerId, supabaseAdmin, supabaseConfigured } from './supabase'
import type { ParsedItem } from './types'

function raiseIfError(error: PostgrestError | null, context: string): void {
  if (error) {
    throw new Error(`[supabase] ${context}: ${error.message}`)
  }
}

interface LocalSessionRow {
  id: string
}

interface LocalDuplicateRow {
  id: string
}

interface LocalItemSummaryRow {
  id: string
  name: string | null
  base_type: string
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: number
  category: string
  analysis_profile: string
  analysis_tags: string
  captured_at: string
}

async function getOrCreateActiveSessionId(): Promise<string> {
  if (!supabaseConfigured || !supabaseAdmin) {
    const existing = db
      .prepare<[], LocalSessionRow>('SELECT id FROM sessions WHERE active = 1 ORDER BY started_at DESC LIMIT 1')
      .get()
    if (existing?.id) {
      return existing.id
    }

    const id = randomUUID()
    const nowIso = new Date().toISOString()
    db.prepare('INSERT INTO sessions (id, title, started_at, active) VALUES (?, ?, ?, 1)').run(
      id,
      `Session ${nowIso.slice(0, 10)}`,
      nowIso,
    )
    return id
  }

  const { data: existing, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('owner_id', requireSyncOwnerId())
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  raiseIfError(sessionError, 'fetch active session')

  if (existing?.id) {
    return existing.id
  }

  const id = randomUUID()
  const nowIso = new Date().toISOString()
  const ownerId = requireSyncOwnerId()
  const { error: insertError } = await supabaseAdmin.from('sessions').insert({
    id,
    owner_id: ownerId,
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
    const thresholdIso = new Date(Date.now() - 3000).toISOString()
    const duplicate = db
      .prepare<[string, string], LocalDuplicateRow>(
        'SELECT id FROM items WHERE fingerprint = ? AND captured_at >= ? ORDER BY captured_at DESC LIMIT 1',
      )
      .get(item.fingerprint, thresholdIso)

    if (duplicate?.id) {
      return { inserted: false, id: duplicate.id, capturedAt: null, displayName: null }
    }

    const itemId = randomUUID()
    const sessionId = await getOrCreateActiveSessionId()
    const nowIso = new Date().toISOString()
    const tagsJson = JSON.stringify(item.analysisTags)

    const insertItem = db.prepare(
      `
        INSERT INTO items (
          id, captured_at, session_id, name, base_type, quality, item_level, location,
          defense, quantity, display_name, is_corrupted, icon_key, category,
          analysis_profile, analysis_tags, sync_state, last_sync_at, sync_error, raw_json, fingerprint
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
      `,
    )
    const insertStat = db.prepare(
      `
        INSERT INTO item_stats (item_id, stat_name, stat_value, range_min, range_max, stat_id, corrupted)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )

    const tx = db.transaction(() => {
      insertItem.run(
        itemId,
        nowIso,
        sessionId,
        item.name,
        item.type,
        item.quality,
        item.iLevel,
        item.location,
        item.defense,
        item.quantity,
        item.displayName,
        item.isCorrupted ? 1 : 0,
        item.iconKey,
        item.category,
        item.analysisProfile,
        tagsJson,
        item.rawJson,
        item.fingerprint,
      )

      for (const stat of item.stats) {
        insertStat.run(
          itemId,
          stat.statName,
          stat.statValue,
          stat.rangeMin,
          stat.rangeMax,
          stat.statId,
          stat.isCorrupted ? 1 : 0,
        )
      }

      enqueueSyncOperation('item', itemId, 'upsert')
    })

    tx()

    return { inserted: true, id: itemId, capturedAt: nowIso, displayName: item.displayName }
  }

  const threshold = new Date(Date.now() - 3000).toISOString()
  const ownerId = requireSyncOwnerId()
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('items')
    .select('id')
    .eq('owner_id', ownerId)
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
    owner_id: ownerId,
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
    const rows = db
      .prepare<[string, number], KeyStatRow>(
        `
          SELECT stat_name, stat_value, range_min, range_max
          FROM item_stats
          WHERE item_id = ?
            AND range_min IS NOT NULL
            AND range_max IS NOT NULL
          ORDER BY id ASC
          LIMIT ?
        `,
      )
      .all(itemId, limit)
    return rows.map(formatKeyStat)
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
    const rows = db
      .prepare<[number], LocalItemSummaryRow>(
        `
          SELECT
            id,
            name,
            base_type,
            display_name,
            quality,
            quantity,
            is_corrupted,
            category,
            analysis_profile,
            analysis_tags,
            captured_at
          FROM items
          ORDER BY captured_at DESC
          LIMIT ?
        `,
      )
      .all(limit)
    return rows.map((row) => mapSummaryRow(row as unknown as ItemSummaryRow))
  }

  const { data: rows, error } = await supabaseAdmin
    .from('items')
    .select(
      'id, name, base_type, display_name, quality, quantity, is_corrupted, category, analysis_profile, analysis_tags, captured_at',
    )
    .eq('owner_id', requireSyncOwnerId())
    .order('captured_at', { ascending: false })
    .limit(limit)

  raiseIfError(error, 'fetch recent items')
  return (rows ?? []).map(mapSummaryRow)
}

export async function getTodayItems() {
  if (!supabaseConfigured || !supabaseAdmin) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const rows = db
      .prepare<[string, string], LocalItemSummaryRow>(
        `
          SELECT
            id,
            name,
            base_type,
            display_name,
            quality,
            quantity,
            is_corrupted,
            category,
            analysis_profile,
            analysis_tags,
            captured_at
          FROM items
          WHERE captured_at >= ? AND captured_at < ?
          ORDER BY captured_at DESC
        `,
      )
      .all(dayStart.toISOString(), dayEnd.toISOString())
    return rows.map((row) => mapSummaryRow(row as unknown as ItemSummaryRow))
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
    .eq('owner_id', requireSyncOwnerId())
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
    const rows = db
      .prepare<[string, string], LocalItemSummaryRow>(
        `
          SELECT
            id,
            name,
            base_type,
            display_name,
            quality,
            quantity,
            is_corrupted,
            category,
            analysis_profile,
            analysis_tags,
            captured_at
          FROM items
          WHERE captured_at >= ? AND captured_at < ?
          ORDER BY captured_at DESC
        `,
      )
      .all(dayStart.toISOString(), dayEnd.toISOString())
    return rows.map((row) => mapSummaryRow(row as unknown as ItemSummaryRow))
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
    .eq('owner_id', requireSyncOwnerId())
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

    const rows = db
      .prepare<[string, string], ItemDateRow>('SELECT captured_at FROM items WHERE captured_at >= ? AND captured_at < ?')
      .all(monthStart.toISOString(), monthEnd.toISOString())

    const counts = new Map<string, number>()
    for (const item of rows) {
      const captured = new Date(item.captured_at).getTime()
      if (captured < monthStart.getTime() || captured >= monthEnd.getTime()) {
        continue
      }
      const dateKey = formatLocalDate(item.captured_at)
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
    .eq('owner_id', requireSyncOwnerId())
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
    const safeRows = db
      .prepare<[string], { quality: string; category: string }>('SELECT quality, category FROM items WHERE captured_at >= ?')
      .all(dayStart.toISOString())
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
    .eq('owner_id', requireSyncOwnerId())
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
    const row = db
      .prepare<
        [string],
        {
          id: string
          name: string | null
          base_type: string
          item_level: number
          location: string
          defense: number | null
          display_name: string
          quality: string
          quantity: number | null
          is_corrupted: number
          category: string
          analysis_profile: string
          analysis_tags: string
          captured_at: string
        }
      >(
        `
          SELECT
            id,
            name,
            base_type,
            item_level,
            location,
            defense,
            display_name,
            quality,
            quantity,
            is_corrupted,
            category,
            analysis_profile,
            analysis_tags,
            captured_at
          FROM items
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(id)
    if (!row) {
      return null
    }

    const stats = db
      .prepare<
        [string],
        {
          stat_name: string
          stat_value: number | null
          range_min: number | null
          range_max: number | null
          corrupted: number
        }
      >('SELECT stat_name, stat_value, range_min, range_max, corrupted FROM item_stats WHERE item_id = ? ORDER BY id ASC')
      .all(id)
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
      stats: stats.map((stat) => ({
        statName: stat.stat_name,
        statValue: stat.stat_value,
        rangeMin: stat.range_min,
        rangeMax: stat.range_max,
        isCorrupted: Boolean(stat.corrupted),
      })),
    }
  }

  const { data: row, error } = await supabaseAdmin
    .from('items')
    .select(
      'id, name, base_type, item_level, location, defense, display_name, quality, quantity, is_corrupted, icon_key, category, analysis_profile, analysis_tags, captured_at',
    )
    .eq('owner_id', requireSyncOwnerId())
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
    const deletedStats = db.prepare('DELETE FROM item_stats WHERE item_id = ?').run(id)
    const deletedItem = db.prepare('DELETE FROM items WHERE id = ?').run(id)
    if (deletedItem.changes < 1) {
      return false
    }
    void deletedStats
    enqueueSyncOperation('item', id, 'delete')
    return true
  }

  const ownerId = requireSyncOwnerId()
  const { data, error } = await supabaseAdmin
    .from('items')
    .delete()
    .eq('owner_id', ownerId)
    .eq('id', id)
    .select('id')
  raiseIfError(error, 'delete item')

  if ((data ?? []).length > 0) {
    const { error: statError } = await supabaseAdmin.from('item_stats').delete().eq('item_id', id)
    raiseIfError(statError, 'delete item stats')
  }

  return (data ?? []).length > 0
}

export async function clearAllItems(): Promise<{ deletedItems: number }> {
  if (!supabaseConfigured || !supabaseAdmin) {
    const ids = db.prepare<[], { id: string }>('SELECT id FROM items').all().map((row) => row.id)
    const deletedItems = ids.length
    db.prepare('DELETE FROM item_stats').run()
    db.prepare('DELETE FROM items').run()
    db.prepare('DELETE FROM sessions').run()
    for (const id of ids) {
      enqueueSyncOperation('item', id, 'delete')
    }
    return { deletedItems }
  }

  const ownerId = requireSyncOwnerId()
  const { data: itemRows, error: itemRowsError } = await supabaseAdmin.from('items').select('id').eq('owner_id', ownerId)
  raiseIfError(itemRowsError, 'load item ids')

  const itemIds = (itemRows ?? []).map((row) => row.id)
  const count = itemIds.length

  if (itemIds.length > 0) {
    const { error: statsError } = await supabaseAdmin.from('item_stats').delete().in('item_id', itemIds)
    raiseIfError(statsError, 'clear item stats')
  }

  const { error: itemsError } = await supabaseAdmin.from('items').delete().eq('owner_id', ownerId)
  raiseIfError(itemsError, 'clear items')

  const { error: sessionsError } = await supabaseAdmin.from('sessions').delete().eq('owner_id', ownerId)
  raiseIfError(sessionsError, 'clear sessions')

  return { deletedItems: count ?? 0 }
}
