import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { getItemById, getRecentItems, getTodayItems } from './repository'
import { ingestClipboardJson } from './ingestion'
import { startClipboardMonitor } from './clipboard-monitor'

const app = express()
const port = Number(process.env.API_PORT ?? 4310)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/items/recent', (_req, res) => {
  res.json(getRecentItems())
})

app.get('/api/items/today', (_req, res) => {
  res.json(getTodayItems())
})

app.get('/api/items/:id', (req, res) => {
  const item = getItemById(req.params.id)
  if (!item) {
    res.status(404).json({ message: 'Item not found' })
    return
  }
  res.json(item)
})

const ingestBody = z.object({
  payload: z.string().min(2),
})

app.post('/api/ingest', (req, res) => {
  try {
    const { payload } = ingestBody.parse(req.body)
    const result = ingestClipboardJson(payload)
    res.json(result)
  } catch (error) {
    res.status(400).json({ message: 'Invalid payload', detail: error instanceof Error ? error.message : 'unknown' })
  }
})

const stopClipboardMonitor = process.env.ENABLE_CLIPBOARD_MONITOR === 'true' ? startClipboardMonitor() : null

const server = app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`)
})

process.on('SIGINT', () => {
  stopClipboardMonitor?.()
  server.close(() => process.exit(0))
})
