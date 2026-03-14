import { db } from './db'

interface CountRow {
  count: number
}

interface QueueMetaRow {
  last_error: string | null
  next_retry_at: string | null
}

interface QueueRow {
  id: number
  entity_type: string
  entity_id: string
  operation: string
  attempt_count: number
  next_retry_at: string | null
  last_error: string | null
}

export interface SyncQueueItem {
  id: number
  entityType: string
  entityId: string
  operation: string
  attemptCount: number
  nextRetryAt: string | null
  lastError: string | null
}

export interface SyncStatus {
  pendingItems: number
  failedItems: number
  queuedOperations: number
  failedOperations: number
  lastError: string | null
  nextRetryAt: string | null
}

export function enqueueSyncOperation(entityType: string, entityId: string, operation: string): void {
  const nowIso = new Date().toISOString()
  db.prepare(
    `
      INSERT INTO sync_queue (entity_type, entity_id, operation, attempt_count, next_retry_at, last_error, created_at)
      VALUES (?, ?, ?, 0, NULL, NULL, ?)
    `,
  ).run(entityType, entityId, operation, nowIso)
}

export function fetchSyncQueueBatch(limit: number): SyncQueueItem[] {
  const safeLimit = Math.max(1, Math.min(200, limit))
  const nowIso = new Date().toISOString()
  const rows = db
    .prepare<[string, number], QueueRow>(
      `
        SELECT id, entity_type, entity_id, operation, attempt_count, next_retry_at, last_error
        FROM sync_queue
        WHERE next_retry_at IS NULL OR next_retry_at <= ?
        ORDER BY id ASC
        LIMIT ?
      `,
    )
    .all(nowIso, safeLimit)

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    attemptCount: row.attempt_count,
    nextRetryAt: row.next_retry_at,
    lastError: row.last_error,
  }))
}

export function removeSyncQueueItem(id: number): void {
  db.prepare('DELETE FROM sync_queue WHERE id = ?').run(id)
}

export function markSyncQueueItemFailed(id: number, attemptCount: number, reason: string): void {
  const safeAttempt = Math.max(1, attemptCount)
  const backoffSeconds = Math.min(300, 2 ** Math.min(safeAttempt, 8))
  const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString()
  db.prepare(
    `
      UPDATE sync_queue
      SET attempt_count = ?, last_error = ?, next_retry_at = ?
      WHERE id = ?
    `,
  ).run(safeAttempt, reason.slice(0, 400), nextRetryAt, id)
}

function readCount(sql: string): number {
  const row = db.prepare<[], CountRow>(sql).get()
  return row?.count ?? 0
}

export function getSyncStatus(): SyncStatus {
  const pendingItems = readCount("SELECT COUNT(*) AS count FROM items WHERE sync_state = 'pending'")
  const failedItems = readCount("SELECT COUNT(*) AS count FROM items WHERE sync_state = 'failed'")
  const queuedOperations = readCount('SELECT COUNT(*) AS count FROM sync_queue')
  const failedOperations = readCount('SELECT COUNT(*) AS count FROM sync_queue WHERE last_error IS NOT NULL')
  const queueMeta = db
    .prepare<[], QueueMetaRow>(
      'SELECT last_error, next_retry_at FROM sync_queue ORDER BY CASE WHEN last_error IS NOT NULL THEN 0 ELSE 1 END, id DESC LIMIT 1',
    )
    .get()

  return {
    pendingItems,
    failedItems,
    queuedOperations,
    failedOperations,
    lastError: queueMeta?.last_error ?? null,
    nextRetryAt: queueMeta?.next_retry_at ?? null,
  }
}
