import cors from 'cors'
import express from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  clearAllItems,
  deleteItemById,
  getItemById,
  getOverlayItems,
  getRecentItems,
  getTodayItems,
  getTodayStats,
} from './repository'
import { startClipboardMonitor } from './clipboard-monitor'
import { captureClipboardPayload } from './capture-service'
import { onItemCaptured } from './item-events'
import { getSettings, updateSettings } from './settings-repository'

const app = express()
const port = Number(process.env.API_PORT ?? 4310)
const host = '127.0.0.1'
const trustProxyForRateLimit = process.env.TRUST_PROXY_FOR_RATE_LIMIT === 'true'
const publicOrigins = (process.env.PUBLIC_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0)
const allowedOrigins = new Set([
  `http://${host}:5173`,
  'http://localhost:5173',
  `http://${host}:4173`,
  'http://localhost:4173',
  ...publicOrigins,
])

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
  type: string
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: boolean
  thumbnail: string | null
  captured_at: string
}

interface ApiTodayPublicItem {
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: boolean
  thumbnail: string | null
  captured_at: string
  category?: string
}

interface ApiTodayPublicPayload {
  date: string
  stats: {
    total_items: number
    unique_items: number
    runes: number
    materials: number
  }
  items: ApiTodayPublicItem[]
}

const publicTodayCacheTtlMs = 30_000
const publicTodayRateLimitWindowMs = 60_000
const publicTodayRateLimitCount = 60
const publicTodayAccessLog = new Map<string, { windowStartedAt: number; count: number }>()
let publicTodayCache: { expiresAt: number; payload: ApiTodayPublicPayload } | null = null

function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1'
}

function isLocalOnlyRequest(req: Request): boolean {
  const ip = req.ip ?? ''
  const forwardedFor = req.header('x-forwarded-for')
  return isLoopbackIp(ip) && !forwardedFor && isLoopbackHostname(req.hostname)
}

function rejectIfNotLocal(req: Request, res: Response): boolean {
  if (isLocalOnlyRequest(req)) {
    return false
  }
  res.status(403).json({ message: 'This endpoint is available only from local app context' })
  return true
}

function getPublicClientId(req: Request): string {
  if (trustProxyForRateLimit) {
    const forwardedFor = req.header('x-forwarded-for')
    if (!forwardedFor) {
      return req.ip ?? 'unknown'
    }

    const first = forwardedFor
      .split(',')
      .map((value) => value.trim())
      .find((value) => value.length > 0)

    if (first) {
      return first
    }
  }

  return req.ip ?? 'unknown'
}

function toApiItemSummary(item: {
  id: string
  type: string
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
    type: item.type,
    display_name: item.displayName,
    quality: item.quality,
    quantity: item.quantity,
    is_corrupted: item.isCorrupted,
    thumbnail: normalizedThumbnail,
    captured_at: item.capturedAt,
  }
}

function canAccessTodayPublic(clientId: string): boolean {
  const now = Date.now()
  if (publicTodayAccessLog.size > 500) {
    for (const [entryId, entry] of publicTodayAccessLog.entries()) {
      if (now - entry.windowStartedAt >= publicTodayRateLimitWindowMs) {
        publicTodayAccessLog.delete(entryId)
      }
    }
  }

  const slot = publicTodayAccessLog.get(clientId)
  if (!slot || now - slot.windowStartedAt >= publicTodayRateLimitWindowMs) {
    publicTodayAccessLog.set(clientId, { windowStartedAt: now, count: 1 })
    return true
  }

  if (slot.count >= publicTodayRateLimitCount) {
    return false
  }

  slot.count += 1
  publicTodayAccessLog.set(clientId, slot)
  return true
}

function getTodayPublicPayload(): ApiTodayPublicPayload {
  const todayItems = getTodayItems()
  const stats = getTodayStats()

  return {
    date: new Date().toISOString().slice(0, 10),
    stats: {
      total_items: stats.totalItems,
      unique_items: stats.uniqueItems,
      runes: stats.runes,
      materials: stats.materials,
    },
    items: todayItems.map((item) => {
      const rawThumbnail = item.thumbnail ?? 'generic/item_unknown.png'
      const normalizedThumbnail = rawThumbnail.startsWith('/icons/') ? rawThumbnail : `/icons/${rawThumbnail}`

      return {
        display_name: item.displayName,
        quality: item.quality,
        quantity: item.quantity,
        is_corrupted: item.isCorrupted,
        thumbnail: normalizedThumbnail,
        captured_at: item.capturedAt,
        category: item.category ?? item.type,
      }
    }),
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/items/recent', (_req, res) => {
  if (rejectIfNotLocal(_req, res)) {
    return
  }
  res.json(getRecentItems().map(toApiItemSummary))
})

app.get('/api/items/today', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }
  res.json(getTodayItems().map(toApiItemSummary))
})

app.get('/api/overlay', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }
  const settings = getSettings()
  res.json(getOverlayItems(settings.overlay_item_limit).map(toApiItemSummary))
})

app.get('/api/stats/today', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }
  const stats = getTodayStats()
  res.json({
    total_items: stats.totalItems,
    unique_items: stats.uniqueItems,
    runes: stats.runes,
    materials: stats.materials,
  })
})

app.get('/api/today/public', (req, res) => {
  const settings = getSettings()
  const key = typeof req.query.key === 'string' ? req.query.key : undefined
  const tokenMatched = Boolean(key && settings.qr_token && key === settings.qr_token)

  if (!settings.qr_public_enabled && !tokenMatched) {
    res.status(403).json({ message: 'Today public page is disabled or key is invalid' })
    return
  }

  const clientId = getPublicClientId(req)
  if (!canAccessTodayPublic(clientId)) {
    res.status(429).json({ message: 'Rate limit exceeded' })
    return
  }

  const now = Date.now()
  if (publicTodayCache && publicTodayCache.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(publicTodayCache.payload)
    return
  }

  const payload = getTodayPublicPayload()
  publicTodayCache = {
    payload,
    expiresAt: now + publicTodayCacheTtlMs,
  }
  res.setHeader('Cache-Control', 'public, max-age=30')
  res.json(payload)
})

app.get('/api/settings', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }
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
  if (rejectIfNotLocal(req, res)) {
    return
  }
  try {
    const patch = settingsBody.parse(req.body)
    const updated = updateSettings(patch)
    res.json(updated)
  } catch (error) {
    res.status(400).json({ message: 'Invalid settings payload', detail: error instanceof Error ? error.message : 'unknown' })
  }
})

app.get('/api/items/:id', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }
  const item = getItemById(req.params.id)
  if (!item) {
    res.status(404).json({ message: 'Item not found' })
    return
  }

  const rawThumbnail = item.thumbnail ?? 'generic/item_unknown.png'
  const normalizedThumbnail = rawThumbnail.startsWith('/icons/') ? rawThumbnail : `/icons/${rawThumbnail}`
  res.json({
    ...item,
    thumbnail: normalizedThumbnail,
  })
})

app.delete('/api/items/:id', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }

  const deleted = deleteItemById(req.params.id)
  if (!deleted) {
    res.status(404).json({ message: 'Item not found' })
    return
  }

  res.json({ deleted: true })
})

app.delete('/api/items', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }

  const result = clearAllItems()
  res.json({ deleted_items: result.deletedItems })
})

app.get('/api/events/items', (req, res) => {
  if (rejectIfNotLocal(req, res)) {
    return
  }
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
  if (rejectIfNotLocal(req, res)) {
    return
  }
  try {
    const { payload } = ingestBody.parse(req.body)
    const result = captureClipboardPayload(payload)
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: 'Invalid payload', detail: error instanceof Error ? error.message : 'unknown' })
  }
})

const clipboardMonitorEnabled = process.env.ENABLE_CLIPBOARD_MONITOR !== 'false'
const stopClipboardMonitor = clipboardMonitorEnabled ? startClipboardMonitor() : null

const server = app.listen(port, host, () => {
  console.log(`[api] listening on http://${host}:${port}`)
  console.log(`[clipboard] monitor ${clipboardMonitorEnabled ? 'enabled' : 'disabled'}`)
})

process.on('SIGINT', () => {
  stopClipboardMonitor?.()
  server.close(() => process.exit(0))
})
