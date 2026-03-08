import { createHash, randomBytes } from 'node:crypto'
import { db } from './db'

export interface AppSettings {
  overlay_item_limit: number
  overlay_position: 'right' | 'left' | 'bottom'
  overlay_opacity: number
  overlay_title: string
  overlay_title_enabled: boolean
  overlay_title_size: number
  overlay_title_color: string
  overlay_title_background_color: string
  overlay_title_padding: number
  theme: 'light' | 'dark'
  qr_public_enabled: boolean
  qr_token: string
}

interface SettingRow {
  key: string
  value: string
}

const defaults: AppSettings = {
  overlay_item_limit: 10,
  overlay_position: 'right',
  overlay_opacity: 0.8,
  overlay_title: 'Overlay Feed',
  overlay_title_enabled: true,
  overlay_title_size: 18,
  overlay_title_color: '#f7e6a8',
  overlay_title_background_color: '#1c1a1a',
  overlay_title_padding: 0,
  theme: 'light',
  qr_public_enabled: true,
  qr_token: randomBytes(16).toString('hex'),
}

function isHexToken32(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value)
}

function toStableToken(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBoolean(value: string, fallback: boolean): boolean {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return fallback
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }
  const trimmed = value.trim()
  if (!/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return fallback
  }
  return trimmed.toLowerCase()
}

function normalizeSettings(raw: Partial<AppSettings>): AppSettings {
  const limit = Math.min(20, Math.max(1, raw.overlay_item_limit ?? defaults.overlay_item_limit))
  const opacity = Math.min(1, Math.max(0.1, raw.overlay_opacity ?? defaults.overlay_opacity))
  const position =
    raw.overlay_position === 'left' || raw.overlay_position === 'bottom' || raw.overlay_position === 'right'
      ? raw.overlay_position
      : defaults.overlay_position
  const theme = raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : defaults.theme
  const token = raw.qr_token
    ? isHexToken32(raw.qr_token)
      ? raw.qr_token.toLowerCase()
      : toStableToken(raw.qr_token)
    : defaults.qr_token
  const overlayTitle = (raw.overlay_title ?? defaults.overlay_title).trim() || defaults.overlay_title
  const overlayTitleSize = Math.min(36, Math.max(12, raw.overlay_title_size ?? defaults.overlay_title_size))
  const overlayTitlePadding = Math.min(24, Math.max(0, raw.overlay_title_padding ?? defaults.overlay_title_padding))
  const overlayTitleColor = normalizeHexColor(raw.overlay_title_color, defaults.overlay_title_color)
  const overlayTitleBackgroundColor = normalizeHexColor(
    raw.overlay_title_background_color,
    defaults.overlay_title_background_color,
  )

  return {
    overlay_item_limit: limit,
    overlay_position: position,
    overlay_opacity: opacity,
    overlay_title: overlayTitle,
    overlay_title_enabled: raw.overlay_title_enabled ?? defaults.overlay_title_enabled,
    overlay_title_size: overlayTitleSize,
    overlay_title_color: overlayTitleColor,
    overlay_title_background_color: overlayTitleBackgroundColor,
    overlay_title_padding: overlayTitlePadding,
    theme,
    qr_public_enabled: raw.qr_public_enabled ?? defaults.qr_public_enabled,
    qr_token: token,
  }
}

function saveSettings(settings: AppSettings): void {
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (@key, @value, @updated_at)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
  const now = new Date().toISOString()

  stmt.run({ key: 'overlay_item_limit', value: String(settings.overlay_item_limit), updated_at: now })
  stmt.run({ key: 'overlay_position', value: settings.overlay_position, updated_at: now })
  stmt.run({ key: 'overlay_opacity', value: String(settings.overlay_opacity), updated_at: now })
  stmt.run({ key: 'overlay_title', value: settings.overlay_title, updated_at: now })
  stmt.run({ key: 'overlay_title_enabled', value: settings.overlay_title_enabled ? 'true' : 'false', updated_at: now })
  stmt.run({ key: 'overlay_title_size', value: String(settings.overlay_title_size), updated_at: now })
  stmt.run({
    key: 'overlay_title_color',
    value: settings.overlay_title_color,
    updated_at: now,
  })
  stmt.run({
    key: 'overlay_title_background_color',
    value: settings.overlay_title_background_color,
    updated_at: now,
  })
  stmt.run({ key: 'overlay_title_padding', value: String(settings.overlay_title_padding), updated_at: now })
  stmt.run({ key: 'theme', value: settings.theme, updated_at: now })
  stmt.run({ key: 'qr_public_enabled', value: settings.qr_public_enabled ? 'true' : 'false', updated_at: now })
  stmt.run({ key: 'qr_token', value: settings.qr_token, updated_at: now })
}

export function getSettings(): AppSettings {
  const rows = db.prepare<[], SettingRow>('SELECT key, value FROM settings').all()
  if (rows.length === 0) {
    return normalizeSettings(defaults)
  }

  const map = new Map(rows.map((row) => [row.key, row.value]))
  const loaded = normalizeSettings({
    overlay_item_limit: parseNumber(map.get('overlay_item_limit') ?? '', defaults.overlay_item_limit),
    overlay_position: map.get('overlay_position') as AppSettings['overlay_position'] | undefined,
    overlay_opacity: parseNumber(map.get('overlay_opacity') ?? '', defaults.overlay_opacity),
    overlay_title: map.get('overlay_title') ?? defaults.overlay_title,
    overlay_title_enabled: parseBoolean(map.get('overlay_title_enabled') ?? '', defaults.overlay_title_enabled),
    overlay_title_size: parseNumber(map.get('overlay_title_size') ?? '', defaults.overlay_title_size),
    overlay_title_color: map.get('overlay_title_color') ?? defaults.overlay_title_color,
    overlay_title_background_color:
      map.get('overlay_title_background_color') ?? defaults.overlay_title_background_color,
    overlay_title_padding: parseNumber(map.get('overlay_title_padding') ?? '', defaults.overlay_title_padding),
    theme: map.get('theme') as AppSettings['theme'] | undefined,
    qr_public_enabled: parseBoolean(map.get('qr_public_enabled') ?? '', defaults.qr_public_enabled),
    qr_token: map.get('qr_token') ?? defaults.qr_token,
  })

  return loaded
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next = normalizeSettings({ ...current, ...patch })
  saveSettings(next)
  return next
}
