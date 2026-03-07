import { ingestClipboardJson } from './ingestion'
import { emitItemCaptured } from './item-events'

export function captureClipboardPayload(payload: string): { inserted: boolean; id: string | null } {
  const result = ingestClipboardJson(payload)
  if (!result.inserted || !result.id || !result.capturedAt || !result.displayName) {
    return { inserted: result.inserted, id: result.id }
  }

  emitItemCaptured({
    itemId: result.id,
    displayName: result.displayName,
    capturedAt: result.capturedAt,
  })

  return { inserted: true, id: result.id }
}
