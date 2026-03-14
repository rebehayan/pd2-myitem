import cors from 'cors'
import express from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  clearAllItems,
  deleteItemById,
  getItemById,
  getItemDateCountsByMonth,
  getItemsByDate,
  getOverlayItems,
  getRecentItems,
  getTodayItems,
  getTodayStats,
} from './repository'
import { startClipboardMonitor } from './clipboard-monitor'
import { captureClipboardPayload } from './capture-service'
import { ingestClipboardJson } from './ingestion'
import { onItemCaptured } from './item-events'
import { getSettings, updateSettings } from './settings-repository'
import { supabaseAdmin, supabaseConfigured } from './supabase'
import { getSyncStatus } from './sync-repository'
import { isSyncPushRunning, runSyncPushBatch, startSyncPushLoop } from './sync-service'

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

const publicRoutes = new Set(['/api/health', '/api/today/public'])
const allowGuestLocalApi =
  process.env.ALLOW_GUEST_LOCAL_API === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.ALLOW_GUEST_LOCAL_API !== 'false')

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function isLocalRequest(req: Request): boolean {
  const origin = req.header('origin')
  if (origin) {
    try {
      const url = new URL(origin)
      if (isLoopbackHost(url.hostname)) {
        return true
      }
    } catch {
      // ignore invalid origin value
    }
  }

  const host = req.header('host')
  if (host) {
    const hostname = host.split(':')[0]?.trim().toLowerCase() ?? ''
    if (isLoopbackHost(hostname)) {
      return true
    }
  }

  const ip = req.ip?.toLowerCase() ?? ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

function getAuthToken(req: Request): string | null {
  const authHeader = req.header('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length)
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim()
  }
  return null
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

async function requireAuthenticatedUser(req: Request, res: Response): Promise<boolean> {
  if (!supabaseConfigured || !supabaseAdmin) {
    res.status(503).json({ message: 'Auth backend is not configured' })
    return false
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ message: 'Login required for sharing' })
    return false
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ message: 'Invalid auth token' })
    return false
  }

  const masterUserId = process.env.MASTER_USER_ID
  if (masterUserId && data.user.id !== masterUserId) {
    res.status(403).json({ message: 'Master access required' })
    return false
  }

  return true
}

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS' || !req.path.startsWith('/api') || publicRoutes.has(req.path)) {
    next()
    return
  }

  if (allowGuestLocalApi && isLocalRequest(req)) {
    next()
    return
  }

  if (!supabaseConfigured || !supabaseAdmin) {
    res.status(503).json({ message: 'Auth backend is not configured' })
    return
  }

  const token = getAuthToken(req)
  if (!token) {
    res.status(401).json({ message: 'Missing auth token' })
    return
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ message: 'Invalid auth token' })
    return
  }

  const masterUserId = process.env.MASTER_USER_ID
  if (masterUserId && data.user.id !== masterUserId) {
    res.status(403).json({ message: 'Master access required' })
    return
  }

  next()
})

interface ApiItemSummary {
  id: string
  type: string
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: boolean
  thumbnail: string | null
  captured_at: string
  key_stats?: string[]
  category: string
  analysis_profile: string
  analysis_tags: string[]
}

interface ApiTodayPublicItem {
  display_name: string
  quality: string
  quantity: number | null
  is_corrupted: boolean
  thumbnail: string | null
  captured_at: string
  category?: string
  analysis_profile?: string
  analysis_tags?: string[]
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

const asyncHandler = (handler: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error: unknown) => {
      console.error('[api] request failed', error)
      res.status(500).json({ message: 'Internal server error' })
    })
  }
}

const settingsBody = z.object({
  overlay_item_limit: z.number().int().min(1).max(20).optional(),
  overlay_opacity: z.number().min(0.1).max(1).optional(),
  overlay_minimal_mode: z.boolean().optional(),
  overlay_title: z.string().max(60).optional(),
  overlay_title_enabled: z.boolean().optional(),
  overlay_title_size: z.number().int().min(12).max(36).optional(),
  overlay_title_color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  overlay_title_background_color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  overlay_title_padding: z.number().int().min(0).max(24).optional(),
  qr_public_enabled: z.boolean().optional(),
  qr_token: z.union([z.string().regex(/^[a-f0-9]{32}$/i), z.literal('')]).optional(),
})

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
  keyStats?: string[]
  category?: string
  analysisProfile?: string
  analysisTags?: string[]
}): ApiItemSummary {
  const rawThumbnail = item.thumbnail ?? 'generic/item_unknown.svg'
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
    key_stats: item.keyStats ?? [],
    category: item.category ?? 'misc',
    analysis_profile: item.analysisProfile ?? 'unknown',
    analysis_tags: item.analysisTags ?? [],
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

async function getTodayPublicPayload(): Promise<ApiTodayPublicPayload> {
  const todayItems = await getTodayItems()
  const stats = await getTodayStats()

  return {
    date: new Date().toISOString().slice(0, 10),
    stats: {
      total_items: stats.totalItems,
      unique_items: stats.uniqueItems,
      runes: stats.runes,
      materials: stats.materials,
    },
    items: todayItems.map((item) => {
      const rawThumbnail = item.thumbnail ?? 'generic/item_unknown.svg'
      const normalizedThumbnail = rawThumbnail.startsWith('/icons/') ? rawThumbnail : `/icons/${rawThumbnail}`

      return {
        display_name: item.displayName,
        quality: item.quality,
        quantity: item.quantity,
        is_corrupted: item.isCorrupted,
        thumbnail: normalizedThumbnail,
        captured_at: item.capturedAt,
        category: item.category ?? item.type,
        analysis_profile: item.analysisProfile ?? 'unknown',
        analysis_tags: item.analysisTags ?? [],
      }
    }),
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/sync/status', (_req, res) => {
  res.json({
    ...getSyncStatus(),
    running: isSyncPushRunning(),
  })
})

app.post(
  '/api/sync/push',
  asyncHandler(async (_req, res) => {
    const result = await runSyncPushBatch()
    res.json(result)
  }),
)

app.get(
  '/api/items/recent',
  asyncHandler(async (_req, res) => {
    res.json((await getRecentItems()).map(toApiItemSummary))
  }),
)

app.get(
  '/api/items/today',
  asyncHandler(async (_req, res) => {
    res.json((await getTodayItems()).map(toApiItemSummary))
  }),
)

app.get(
  '/api/items/by-date',
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : ''
    if (!date) {
      res.status(400).json({ message: 'Missing date parameter' })
      return
    }
    res.json((await getItemsByDate(date)).map(toApiItemSummary))
  }),
)

app.get(
  '/api/items/calendar',
  asyncHandler(async (req, res) => {
    const month = typeof req.query.month === 'string' ? req.query.month : ''
    if (!month) {
      res.status(400).json({ message: 'Missing month parameter' })
      return
    }
    res.json(await getItemDateCountsByMonth(month))
  }),
)

app.get(
  '/api/overlay',
  asyncHandler(async (req, res) => {
    const settings = await getSettings()
    const overlayItemLimit = settings.overlay_item_limit
    const fetchCount = Math.max(overlayItemLimit * 5, 20)
    const items = (await getOverlayItems(fetchCount)).map(toApiItemSummary)

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    console.info('[overlay] payload generated', {
      minimalMode: settings.overlay_minimal_mode,
      itemLimit: settings.overlay_item_limit,
      titleEnabled: settings.overlay_title_enabled,
      itemCount: items.length,
      requestMode: allowGuestLocalApi && isLocalRequest(req) ? 'guest-local' : 'authenticated',
      userAgent: req.header('user-agent') ?? 'unknown',
      timestamp: new Date().toISOString(),
    })

    res.json({
      title: settings.overlay_title,
      title_enabled: settings.overlay_title_enabled,
      title_size: settings.overlay_title_size,
      title_color: settings.overlay_title_color,
      title_background_color: settings.overlay_title_background_color,
      title_padding: settings.overlay_title_padding,
      overlay_item_limit: overlayItemLimit,
      overlay_minimal_mode: settings.overlay_minimal_mode,
      items,
    })
  }),
)

app.get(
  '/api/stats/today',
  asyncHandler(async (_req, res) => {
    const stats = await getTodayStats()
    res.json({
      total_items: stats.totalItems,
      unique_items: stats.uniqueItems,
      runes: stats.runes,
      materials: stats.materials,
    })
  }),
)

app.get(
  '/api/today/public',
  asyncHandler(async (req, res) => {
    const settings = await getSettings()
    const key = typeof req.query.key === 'string' ? req.query.key : undefined
    const tokenMatched = Boolean(key && settings.qr_token && key === settings.qr_token)

    if (!tokenMatched) {
      res.status(403).json({ message: 'Invalid share key' })
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

    const payload = await getTodayPublicPayload()
    publicTodayCache = {
      payload,
      expiresAt: now + publicTodayCacheTtlMs,
    }
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(payload)
  }),
)

app.get(
  '/api/settings',
  asyncHandler(async (req, res) => {
    const allowGuestSettings = allowGuestLocalApi && isLocalRequest(req)
    if (!allowGuestSettings && !(await requireAuthenticatedUser(req, res))) {
      return
    }
    res.json(await getSettings())
  }),
)

const syncItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  displayName: z.string().optional(),
  type: z.string().min(1),
  quality: z.string().min(1),
  quantity: z.number().nullable().optional(),
  isCorrupted: z.boolean().optional(),
  capturedAt: z.string().optional(),
  category: z.string().optional(),
  analysisProfile: z.string().optional(),
  analysisTags: z.array(z.string()).optional(),
  iLevel: z.number().int().optional(),
  location: z.string().optional(),
  defense: z.number().nullable().optional(),
  stats: z
    .array(
      z.object({
        statName: z.string().min(1),
        statValue: z.number().nullable().optional(),
        rangeMin: z.number().nullable().optional(),
        rangeMax: z.number().nullable().optional(),
      }),
    )
    .optional(),
})

const syncBody = z.object({
  items: z.array(syncItemSchema).optional(),
  settings: settingsBody.optional(),
})

app.post(
  '/api/sync',
  asyncHandler(async (req, res) => {
    const payload = syncBody.parse(req.body)
    let importedItems = 0
    if (payload.items && payload.items.length > 0) {
      for (const item of payload.items) {
        const rawItem = {
          name: item.name ?? item.displayName,
          type: item.type,
          iLevel: item.iLevel ?? 0,
          location: item.location ?? 'Unknown',
          quality: item.quality,
          defense: item.defense ?? undefined,
          quantity: item.quantity ?? undefined,
          corrupted: item.isCorrupted ?? false,
          stats:
            item.stats?.map((stat) => ({
              name: stat.statName,
              value: stat.statValue ?? undefined,
              range:
                stat.rangeMin !== null && stat.rangeMax !== null
                  ? {
                      min: stat.rangeMin,
                      max: stat.rangeMax,
                    }
                  : undefined,
            })) ?? [],
        }

        try {
          const result = await ingestClipboardJson(JSON.stringify(rawItem))
          if (result.inserted) {
            importedItems += 1
          }
        } catch (error) {
          console.warn('[api] sync item failed', error)
        }
      }
    }

    let importedSettings = false
    if (payload.settings) {
      await updateSettings(payload.settings)
      importedSettings = true
    }

    res.json({ imported_items: importedItems, imported_settings: importedSettings })
  }),
)

app.put(
  '/api/settings',
  asyncHandler(async (req, res) => {
    const allowGuestSettings = allowGuestLocalApi && isLocalRequest(req)
    if (!allowGuestSettings && !(await requireAuthenticatedUser(req, res))) {
      return
    }
    try {
      const patch = settingsBody.parse(req.body)
      const updated = await updateSettings(patch)
      console.info('[settings] updated', {
        overlayMinimalMode: updated.overlay_minimal_mode,
        overlayItemLimit: updated.overlay_item_limit,
        overlayTitleEnabled: updated.overlay_title_enabled,
        requestMode: allowGuestSettings ? 'guest-local' : 'authenticated',
        timestamp: new Date().toISOString(),
      })
      res.json(updated)
    } catch (error) {
      res
        .status(400)
        .json({ message: 'Invalid settings payload', detail: error instanceof Error ? error.message : 'unknown' })
    }
  }),
)

app.get(
  '/api/items/:id',
  asyncHandler(async (req, res) => {
    const itemId = readParam(req.params.id)
    const item = await getItemById(itemId)
    if (!item) {
      res.status(404).json({ message: 'Item not found' })
      return
    }

    const rawThumbnail = item.thumbnail ?? 'generic/item_unknown.svg'
    const normalizedThumbnail = rawThumbnail.startsWith('/icons/') ? rawThumbnail : `/icons/${rawThumbnail}`
    res.json({
      ...item,
      thumbnail: normalizedThumbnail,
    })
  }),
)

app.delete(
  '/api/items/:id',
  asyncHandler(async (req, res) => {
    const itemId = readParam(req.params.id)
    const deleted = await deleteItemById(itemId)
    if (!deleted) {
      res.status(404).json({ message: 'Item not found' })
      return
    }

    res.json({ deleted: true })
  }),
)

app.delete(
  '/api/items',
  asyncHandler(async (_req, res) => {
    const result = await clearAllItems()
    res.json({ deleted_items: result.deletedItems })
  }),
)

app.get(
  '/api/events/items',
  asyncHandler(async (req, res) => {
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
  }),
)

const ingestBody = z.object({
  payload: z.string().min(2),
})

app.post(
  '/api/ingest',
  asyncHandler(async (req, res) => {
    try {
      const { payload } = ingestBody.parse(req.body)
      const result = await captureClipboardPayload(payload)
      res.json(result)
    } catch (error) {
      res.status(400).json({ message: 'Invalid payload', detail: error instanceof Error ? error.message : 'unknown' })
    }
  }),
)

const clipboardMonitorEnabled = process.env.ENABLE_CLIPBOARD_MONITOR !== 'false'
const stopClipboardMonitor = clipboardMonitorEnabled ? startClipboardMonitor() : null
const stopSyncPushLoop = startSyncPushLoop()

const server = app.listen(port, host, () => {
  console.log(`[api] listening on http://${host}:${port}`)
  console.log(`[clipboard] monitor ${clipboardMonitorEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[supabase] ${supabaseConfigured ? 'configured' : 'not configured (fallback mode)'}`)
  console.log(`[api] guest local api access ${allowGuestLocalApi ? 'enabled' : 'disabled'}`)
  console.log('[sync] push loop enabled (15s interval)')
})

process.on('SIGINT', () => {
  stopClipboardMonitor?.()
  stopSyncPushLoop()
  server.close(() => process.exit(0))
})
