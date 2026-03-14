import { db } from './db'
import {
  fetchSyncQueueBatch,
  markSyncQueueItemFailed,
  removeSyncQueueItem,
  type SyncQueueItem,
} from './sync-repository'
import { requireSyncOwnerId, supabaseAdmin, supabaseConfigured } from './supabase'

interface SettingRow {
  key: string
  value: string
  updated_at: string
}

interface LocalItemRow {
  id: string
  captured_at: string
  session_id: string
  name: string | null
  base_type: string
  quality: string
  item_level: number
  location: string
  defense: number | null
  quantity: number | null
  display_name: string
  is_corrupted: number
  icon_key: string | null
  category: string
  analysis_profile: string
  analysis_tags: string
  raw_json: string
  fingerprint: string
}

interface LocalItemStatRow {
  stat_name: string
  stat_value: number | null
  range_min: number | null
  range_max: number | null
  stat_id: number | null
  corrupted: number
}

interface LocalSessionRow {
  id: string
  title: string
  started_at: string
  ended_at: string | null
  active: number
}

export interface SyncPushResult {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  running: boolean
}

let running = false

function readSettingsRows(): SettingRow[] {
  return db.prepare<[], SettingRow>('SELECT key, value, updated_at FROM settings').all()
}

function readLocalItem(itemId: string): LocalItemRow | null {
  return (
    db
      .prepare<[string], LocalItemRow>(
        `
          SELECT
            id,
            captured_at,
            session_id,
            name,
            base_type,
            quality,
            item_level,
            location,
            defense,
            quantity,
            display_name,
            is_corrupted,
            icon_key,
            category,
            analysis_profile,
            analysis_tags,
            raw_json,
            fingerprint
          FROM items
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(itemId) ?? null
  )
}

function readLocalItemStats(itemId: string): LocalItemStatRow[] {
  return db
    .prepare<[string], LocalItemStatRow>(
      `
        SELECT stat_name, stat_value, range_min, range_max, stat_id, corrupted
        FROM item_stats
        WHERE item_id = ?
        ORDER BY id ASC
      `,
    )
    .all(itemId)
}

function readLocalSession(sessionId: string): LocalSessionRow | null {
  return (
    db
      .prepare<[string], LocalSessionRow>(
        'SELECT id, title, started_at, ended_at, active FROM sessions WHERE id = ? LIMIT 1',
      )
      .get(sessionId) ?? null
  )
}

async function ensureCloudSession(sessionId: string, fallbackStartedAt: string): Promise<void> {
  if (!supabaseAdmin) {
    return
  }

  const ownerId = requireSyncOwnerId()
  const localSession = readLocalSession(sessionId)
  const startedAt = localSession?.started_at ?? fallbackStartedAt
  const title = localSession?.title ?? `Session ${startedAt.slice(0, 10)}`
  const active = localSession ? localSession.active === 1 : true

  const { error } = await supabaseAdmin.from('sessions').upsert(
    {
      id: sessionId,
      owner_id: ownerId,
      title,
      started_at: startedAt,
      ended_at: localSession?.ended_at ?? null,
      active,
    },
    { onConflict: 'id' },
  )
  if (error) {
    throw new Error(`[supabase] upsert session: ${error.message}`)
  }
}

function markLocalItemSynced(itemId: string): void {
  const nowIso = new Date().toISOString()
  db.prepare("UPDATE items SET sync_state = 'synced', last_sync_at = ?, sync_error = NULL WHERE id = ?").run(nowIso, itemId)
}

function markLocalItemFailed(itemId: string, reason: string): void {
  db.prepare("UPDATE items SET sync_state = 'failed', sync_error = ? WHERE id = ?").run(reason.slice(0, 400), itemId)
}

async function pushItemUpsert(itemId: string): Promise<void> {
  if (!supabaseAdmin) {
    return
  }

  const localItem = readLocalItem(itemId)
  if (!localItem) {
    return
  }

  const ownerId = requireSyncOwnerId()
  await ensureCloudSession(localItem.session_id, localItem.captured_at)

  let analysisTags: string[] = []
  try {
    const parsed = JSON.parse(localItem.analysis_tags) as unknown
    if (Array.isArray(parsed)) {
      analysisTags = parsed.filter((entry): entry is string => typeof entry === 'string')
    }
  } catch {
    analysisTags = []
  }

  const { error: upsertItemError } = await supabaseAdmin.from('items').upsert(
    {
      id: localItem.id,
      owner_id: ownerId,
      captured_at: localItem.captured_at,
      session_id: localItem.session_id,
      name: localItem.name,
      base_type: localItem.base_type,
      quality: localItem.quality,
      item_level: localItem.item_level,
      location: localItem.location,
      defense: localItem.defense,
      quantity: localItem.quantity,
      display_name: localItem.display_name,
      is_corrupted: Boolean(localItem.is_corrupted),
      icon_key: localItem.icon_key,
      category: localItem.category,
      analysis_profile: localItem.analysis_profile,
      analysis_tags: analysisTags,
      raw_json: localItem.raw_json,
      fingerprint: localItem.fingerprint,
    },
    { onConflict: 'id' },
  )
  if (upsertItemError) {
    throw new Error(`[supabase] push item: ${upsertItemError.message}`)
  }

  const { error: deleteStatsError } = await supabaseAdmin.from('item_stats').delete().eq('item_id', itemId)
  if (deleteStatsError) {
    throw new Error(`[supabase] delete item stats before upsert: ${deleteStatsError.message}`)
  }

  const stats = readLocalItemStats(itemId)
  if (stats.length > 0) {
    const { error: upsertStatsError } = await supabaseAdmin.from('item_stats').insert(
      stats.map((stat) => ({
        item_id: itemId,
        stat_name: stat.stat_name,
        stat_value: stat.stat_value,
        range_min: stat.range_min,
        range_max: stat.range_max,
        stat_id: stat.stat_id,
        corrupted: Boolean(stat.corrupted),
      })),
    )
    if (upsertStatsError) {
      throw new Error(`[supabase] push item stats: ${upsertStatsError.message}`)
    }
  }
}

async function pushItemDelete(itemId: string): Promise<void> {
  if (!supabaseAdmin) {
    return
  }
  const { error: deleteStatsError } = await supabaseAdmin.from('item_stats').delete().eq('item_id', itemId)
  if (deleteStatsError) {
    throw new Error(`[supabase] delete item stats: ${deleteStatsError.message}`)
  }
  const { error: deleteItemError } = await supabaseAdmin
    .from('items')
    .delete()
    .eq('owner_id', requireSyncOwnerId())
    .eq('id', itemId)
  if (deleteItemError) {
    throw new Error(`[supabase] delete item: ${deleteItemError.message}`)
  }
}

async function processQueueItem(item: SyncQueueItem): Promise<'ok' | 'failed' | 'skipped'> {
  if (!supabaseConfigured || !supabaseAdmin) {
    return 'skipped'
  }

  if (item.entityType === 'setting' && item.operation === 'upsert') {
    const rows = readSettingsRows()
    if (rows.length === 0) {
      removeSyncQueueItem(item.id)
      return 'ok'
    }

    const { error } = await supabaseAdmin.from('settings').upsert(rows, { onConflict: 'key' })
    if (error) {
      markSyncQueueItemFailed(item.id, item.attemptCount + 1, `[supabase] push settings: ${error.message}`)
      return 'failed'
    }

    removeSyncQueueItem(item.id)
    return 'ok'
  }

  if (item.entityType === 'item' && item.operation === 'upsert') {
    try {
      await pushItemUpsert(item.entityId)
      markLocalItemSynced(item.entityId)
      removeSyncQueueItem(item.id)
      return 'ok'
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown item upsert failure'
      markLocalItemFailed(item.entityId, reason)
      markSyncQueueItemFailed(item.id, item.attemptCount + 1, reason)
      return 'failed'
    }
  }

  if (item.entityType === 'item' && item.operation === 'delete') {
    try {
      await pushItemDelete(item.entityId)
      removeSyncQueueItem(item.id)
      return 'ok'
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown item delete failure'
      markSyncQueueItemFailed(item.id, item.attemptCount + 1, reason)
      return 'failed'
    }
  }

  removeSyncQueueItem(item.id)
  return 'skipped'
}

export async function runSyncPushBatch(limit = 50): Promise<SyncPushResult> {
  if (running) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      running: true,
    }
  }

  running = true
  let processed = 0
  let succeeded = 0
  let failed = 0
  let skipped = 0

  try {
    const queue = fetchSyncQueueBatch(limit)
    for (const item of queue) {
      processed += 1
      const result = await processQueueItem(item)
      if (result === 'ok') {
        succeeded += 1
      } else if (result === 'failed') {
        failed += 1
      } else {
        skipped += 1
      }
    }

    return {
      processed,
      succeeded,
      failed,
      skipped,
      running: false,
    }
  } finally {
    running = false
  }
}

export function isSyncPushRunning(): boolean {
  return running
}

export function startSyncPushLoop(intervalMs = 15_000): () => void {
  const safeInterval = Math.max(5_000, intervalMs)
  const timer = setInterval(() => {
    void runSyncPushBatch().catch((error: unknown) => {
      console.warn('[sync] push loop failed', error)
    })
  }, safeInterval)

  return () => {
    clearInterval(timer)
  }
}
