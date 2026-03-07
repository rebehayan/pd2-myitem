import { randomUUID } from 'node:crypto'
import { db } from './db'
import type { ParsedItem } from './types'
import { resolveThumbnail } from './icon-mapping'

function getOrCreateActiveSessionId(): string {
  const row = db
    .prepare<{ active: number }, { id: string }>('SELECT id FROM sessions WHERE active = @active LIMIT 1')
    .get({ active: 1 })

  if (row) {
    return row.id
  }

  const id = randomUUID()
  const nowIso = new Date().toISOString()
  db.prepare(
    'INSERT INTO sessions (id, title, started_at, active) VALUES (@id, @title, @started_at, @active)',
  ).run({
    id,
    title: `Session ${nowIso.slice(0, 10)}`,
    started_at: nowIso,
    active: 1,
  })

  return id
}

export interface SaveParsedItemResult {
  inserted: boolean
  id: string | null
  capturedAt: string | null
  displayName: string | null
}

export function saveParsedItem(item: ParsedItem): SaveParsedItemResult {
  const existing = db
    .prepare<{ fingerprint: string; threshold: string }, { id: string }>(
      `SELECT id
       FROM items
       WHERE fingerprint = @fingerprint
         AND captured_at >= @threshold
       ORDER BY captured_at DESC
       LIMIT 1`,
    )
    .get({
      fingerprint: item.fingerprint,
      threshold: new Date(Date.now() - 3000).toISOString(),
    })

  if (existing) {
    return { inserted: false, id: existing.id, capturedAt: null, displayName: null }
  }

  const itemId = randomUUID()
  const sessionId = getOrCreateActiveSessionId()
  const nowIso = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO items (
        id, captured_at, session_id, name, base_type, quality, item_level, location,
        defense, quantity, display_name, is_corrupted, icon_key, category, analysis_profile, analysis_tags, raw_json, fingerprint
      ) VALUES (
        @id, @captured_at, @session_id, @name, @base_type, @quality, @item_level, @location,
        @defense, @quantity, @display_name, @is_corrupted, @icon_key, @category, @analysis_profile, @analysis_tags, @raw_json, @fingerprint
      )`,
    ).run({
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
      is_corrupted: item.isCorrupted ? 1 : 0,
      icon_key: item.iconKey,
      category: item.category,
      analysis_profile: item.analysisProfile,
      analysis_tags: JSON.stringify(item.analysisTags),
      raw_json: item.rawJson,
      fingerprint: item.fingerprint,
    })

    const statStmt = db.prepare(
      `INSERT INTO item_stats (item_id, stat_name, stat_value, range_min, range_max, stat_id, corrupted)
       VALUES (@item_id, @stat_name, @stat_value, @range_min, @range_max, @stat_id, @corrupted)`,
    )

    for (const stat of item.stats) {
      statStmt.run({
        item_id: itemId,
        stat_name: stat.statName,
        stat_value: stat.statValue,
        range_min: stat.rangeMin,
        range_max: stat.rangeMax,
        stat_id: stat.statId,
        corrupted: stat.isCorrupted ? 1 : 0,
      })
    }
  })

  tx()
  return { inserted: true, id: itemId, capturedAt: nowIso, displayName: item.displayName }
}

interface ItemSummaryRow {
  id: string
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

function parseAnalysisTags(rawTags: string): string[] {
  try {
    const parsed = JSON.parse(rawTags) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

function mapSummaryRow(row: ItemSummaryRow) {
  const thumbnail = resolveThumbnail({
    baseType: row.base_type,
    quality: row.quality,
    quantity: row.quantity,
    isCorrupted: Boolean(row.is_corrupted),
  })

  return {
    id: row.id,
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

export function getRecentItems(limit = 20) {
  const rows = db
    .prepare<{ limit: number }, ItemSummaryRow>(
      `SELECT id, base_type, display_name, quality, quantity, is_corrupted, category, analysis_profile, analysis_tags, captured_at
       FROM items
       ORDER BY captured_at DESC
       LIMIT @limit`,
    )
    .all({ limit })

  return rows.map(mapSummaryRow)
}

export function getTodayItems() {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const rows = db
    .prepare<{ day_start: string }, ItemSummaryRow>(
      `SELECT id, base_type, display_name, quality, quantity, is_corrupted, category, analysis_profile, analysis_tags, captured_at
       FROM items
       WHERE captured_at >= @day_start
       ORDER BY captured_at DESC`,
    )
    .all({ day_start: dayStart.toISOString() })

  return rows.map(mapSummaryRow)
}

export function getOverlayItems(limit = 10) {
  return getRecentItems(limit)
}

interface TodayStatsRow {
  total_items: number
  unique_items: number
  runes: number
  materials: number
}

export function getTodayStats() {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const row = db
    .prepare<{ day_start: string }, TodayStatsRow>(
      `SELECT
         COUNT(*) AS total_items,
         SUM(CASE WHEN LOWER(quality) = 'unique' THEN 1 ELSE 0 END) AS unique_items,
         SUM(CASE WHEN category = 'rune' THEN 1 ELSE 0 END) AS runes,
         SUM(CASE WHEN category = 'material' THEN 1 ELSE 0 END) AS materials
       FROM items
       WHERE captured_at >= @day_start`,
    )
    .get({ day_start: dayStart.toISOString() })

  return {
    totalItems: row?.total_items ?? 0,
    uniqueItems: row?.unique_items ?? 0,
    runes: row?.runes ?? 0,
    materials: row?.materials ?? 0,
  }
}

interface ItemRow {
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
  icon_key: string | null
  category: string
  analysis_profile: string
  analysis_tags: string
  captured_at: string
}

interface StatRow {
  stat_name: string
  stat_value: number
  range_min: number | null
  range_max: number | null
  corrupted: number
}

export function getItemById(id: string) {
  const row = db
    .prepare<{ id: string }, ItemRow>(
      `SELECT id, name, base_type, item_level, location, defense, display_name, quality, quantity, is_corrupted, icon_key, category, analysis_profile, analysis_tags, captured_at
       FROM items
       WHERE id = @id`,
    )
    .get({ id })

  if (!row) {
    return null
  }

  const stats: StatRow[] = db
    .prepare<{ item_id: string }, StatRow>(
      `SELECT stat_name, stat_value, range_min, range_max, corrupted
       FROM item_stats
       WHERE item_id = @item_id`,
    )
    .all({ item_id: id })

  const thumbnail = resolveThumbnail({
    baseType: row.base_type,
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
