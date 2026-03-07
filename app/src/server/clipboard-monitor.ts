import { ingestClipboardJson } from './ingestion'

const pollIntervalMs = 750

export function startClipboardMonitor() {
  let lastValue = ''

  const timer = setInterval(async () => {
    try {
      const { default: clipboard } = await import('clipboardy')
      const current = (await clipboard.read()).trim()
      if (!current || current === lastValue) {
        return
      }
      lastValue = current

      if (!(current.startsWith('{') && current.endsWith('}'))) {
        return
      }

      try {
        const result = ingestClipboardJson(current)
        if (result.inserted) {
          console.log(`[ingest] captured item ${result.id}`)
        }
      } catch {
        // Ignore invalid clipboard payloads while monitoring continuously.
      }
    } catch (error) {
      console.error('[clipboard] monitor error', error)
    }
  }, pollIntervalMs)

  return () => clearInterval(timer)
}
