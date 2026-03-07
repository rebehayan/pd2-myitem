import { randomUUID } from 'node:crypto'
import { db } from './db'
import type { ParsedItem } from './types'

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

export function saveParsedItem(item: ParsedItem): { inserted: boolean; id: string | null } {
  const existing = db
    .prepare<{ fingerprint: string }, { id: string }>('SELECT id FROM items WHERE fingerprint = @fingerprint LIMIT 1')
    .get({ fingerprint: item.fingerprint })

  if (existing) {
    return { inserted: false, id: existing.id }
  }

  const itemId = randomUUID()
  const sessionId = getOrCreateActiveSessionId()
  const nowIso = new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO items (
        id, captured_at, session_id, name, base_type, quality, i_level, location,
        quantity, display_name, is_corrupted, icon_key, raw_json, fingerprint
      ) VALUES (
        @id, @captured_at, @session_id, @name, @base_type, @quality, @i_level, @location,
        @quantity, @display_name, @is_corrupted, @icon_key, @raw_json, @fingerprint
      )`,
    ).run({
      id: itemId,
      captured_at: nowIso,
      session_id: sessionId,
      name: item.name,
      base_type: item.type,
      quality: item.quality,
      i_level: item.iLevel,
      location: item.location,
      quantity: item.quantity,
      display_name: item.displayName,
      is_corrupted: item.isCorrupted ? 1 : 0,
      icon_key: item.iconKey,
      raw_json: item.rawJson,
      fingerprint: item.fingerprint,
    })

    const statStmt = db.prepare(
      `INSERT INTO item_stats (item_id, stat_name, stat_value, range_min, range_max, stat_id)
       VALUES (@item_id, @stat_name, @stat_value, @range_min, @range_max, @stat_id)`,
    )

    for (const stat of item.stats) {
      statStmt.run({
        item_id: itemId,
        stat_name: stat.statName,
        stat_value: stat.statValue,
        range_min: stat.rangeMin,
        range_max: stat.rangeMax,
        stat_id: stat.statId,
      })
    }
  })

  tx()
  return { inserted: true, id: itemId }
}

interface ItemSummaryRow {
  id: string
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: number
  icon_key: string | null
  captured_at: string
}

function mapSummaryRow(row: ItemSummaryRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    quality: row.quality,
    quantity: row.quantity,
    isCorrupted: Boolean(row.is_corrupted),
    thumbnail: row.icon_key,
    capturedAt: row.captured_at,
  }
}

export function getRecentItems(limit = 20) {
  const rows = db
    .prepare<{ limit: number }, ItemSummaryRow>(
      `SELECT id, display_name, quality, quantity, is_corrupted, icon_key, captured_at
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
      `SELECT id, display_name, quality, quantity, is_corrupted, icon_key, captured_at
       FROM items
       WHERE captured_at >= @day_start
       ORDER BY captured_at DESC`,
    )
    .all({ day_start: dayStart.toISOString() })

  return rows.map(mapSummaryRow)
}

interface ItemRow {
  id: string
  name: string | null
  base_type: string
  i_level: number
  location: string
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: number
  icon_key: string | null
  captured_at: string
}

interface StatRow {
  stat_name: string
  stat_value: number
  range_min: number | null
  range_max: number | null
}

export function getItemById(id: string) {
  const row = db
    .prepare<{ id: string }, ItemRow>(
      `SELECT id, name, base_type, i_level, location, display_name, quality, quantity, is_corrupted, icon_key, captured_at
       FROM items
       WHERE id = @id`,
    )
    .get({ id })

  if (!row) {
    return null
  }

  const stats: StatRow[] = db
    .prepare<{ item_id: string }, StatRow>(
      `SELECT stat_name, stat_value, range_min, range_max
       FROM item_stats
       WHERE item_id = @item_id`,
    )
    .all({ item_id: id })

  return {
    id: row.id,
    name: row.name,
    type: row.base_type,
    iLevel: row.i_level,
    location: row.location,
    displayName: row.display_name,
    quality: row.quality,
    quantity: row.quantity,
    isCorrupted: Boolean(row.is_corrupted),
    thumbnail: row.icon_key,
    capturedAt: row.captured_at,
    stats: stats.map((stat) => ({
      statName: stat.stat_name,
      statValue: stat.stat_value,
      rangeMin: stat.range_min,
      rangeMax: stat.range_max,
    })),
  }
}
