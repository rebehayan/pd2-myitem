import { ingestClipboardJson } from './ingestion'
import { emitItemCaptured } from './item-events'

export async function captureClipboardPayload(payload: string): Promise<{ inserted: boolean; id: string | null }> {
  const result = await ingestClipboardJson(payload)
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
