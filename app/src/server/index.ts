import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { getItemById, getOverlayItems, getRecentItems, getTodayItems, getTodayStats } from './repository'
import { startClipboardMonitor } from './clipboard-monitor'
import { captureClipboardPayload } from './capture-service'
import { onItemCaptured } from './item-events'
import { getSettings, updateSettings } from './settings-repository'

const app = express()
const port = Number(process.env.API_PORT ?? 4310)
const host = '127.0.0.1'
const allowedOrigins = new Set([`http://${host}:5173`, 'http://localhost:5173'])

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin not allowed'))
    },
  }),
)
app.use(express.json())

interface ApiItemSummary {
  id: string
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: boolean
  thumbnail: string | null
  captured_at: string
}

function toApiItemSummary(item: {
  id: string
  displayName: string
  quality: string
  quantity: number | null
  isCorrupted: boolean
  thumbnail: string | null
  capturedAt: string
}): ApiItemSummary {
  const rawThumbnail = item.thumbnail ?? 'generic/item_unknown.png'
  const normalizedThumbnail = rawThumbnail.startsWith('/icons/') ? rawThumbnail : `/icons/${rawThumbnail}`

  return {
    id: item.id,
    display_name: item.displayName,
    quality: item.quality,
    quantity: item.quantity,
    is_corrupted: item.isCorrupted,
    thumbnail: normalizedThumbnail,
    captured_at: item.capturedAt,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/items/recent', (_req, res) => {
  res.json(getRecentItems().map(toApiItemSummary))
})

app.get('/api/items/today', (_req, res) => {
  res.json(getTodayItems().map(toApiItemSummary))
})

app.get('/api/overlay', (_req, res) => {
  const settings = getSettings()
  res.json(getOverlayItems(settings.overlay_item_limit).map(toApiItemSummary))
})

app.get('/api/stats/today', (_req, res) => {
  const stats = getTodayStats()
  res.json({
    total_items: stats.totalItems,
    unique_items: stats.uniqueItems,
    runes: stats.runes,
    materials: stats.materials,
  })
})

app.get('/api/settings', (_req, res) => {
  res.json(getSettings())
})

const settingsBody = z.object({
  overlay_item_limit: z.number().int().min(1).max(20).optional(),
  overlay_position: z.enum(['right', 'left', 'bottom']).optional(),
  overlay_opacity: z.number().min(0.1).max(1).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  qr_public_enabled: z.boolean().optional(),
  qr_token: z.string().regex(/^[a-f0-9]{32}$/i).optional(),
})

app.put('/api/settings', (req, res) => {
  try {
    const patch = settingsBody.parse(req.body)
    const updated = updateSettings(patch)
    res.json(updated)
  } catch (error) {
    res.status(400).json({ message: 'Invalid settings payload', detail: error instanceof Error ? error.message : 'unknown' })
  }
})

app.get('/api/items/:id', (req, res) => {
  const item = getItemById(req.params.id)
  if (!item) {
    res.status(404).json({ message: 'Item not found' })
    return
  }
  res.json(item)
})

app.get('/api/events/items', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let closed = false
  const safeWrite = (chunk: string): boolean => {
    if (closed) {
      return false
    }
    try {
      res.write(chunk)
      return true
    } catch {
      return false
    }
  }

  const closeStream = () => {
    if (closed) {
      return
    }
    closed = true
    clearInterval(heartbeat)
    release()
    res.end()
  }

  const release = onItemCaptured((event) => {
    if (!safeWrite('event: item-captured\n')) {
      closeStream()
      return
    }
    if (!safeWrite(`data: ${JSON.stringify(event)}\n\n`)) {
      closeStream()
    }
  })

  const heartbeat = setInterval(() => {
    if (!safeWrite(': keep-alive\n\n')) {
      closeStream()
    }
  }, 15000)

  req.on('close', () => {
    closeStream()
  })

  req.on('error', () => {
    closeStream()
  })
})

const ingestBody = z.object({
  payload: z.string().min(2),
})

app.post('/api/ingest', (req, res) => {
  try {
    const { payload } = ingestBody.parse(req.body)
    const result = captureClipboardPayload(payload)
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: 'Invalid payload', detail: error instanceof Error ? error.message : 'unknown' })
  }
})

const stopClipboardMonitor = process.env.ENABLE_CLIPBOARD_MONITOR === 'true' ? startClipboardMonitor() : null

const server = app.listen(port, host, () => {
  console.log(`[api] listening on http://${host}:${port}`)
})

process.on('SIGINT', () => {
  stopClipboardMonitor?.()
  server.close(() => process.exit(0))
})
