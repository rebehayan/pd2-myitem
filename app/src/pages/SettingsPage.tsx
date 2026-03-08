import { useEffect, useState } from 'react'
import { fetchSettings, updateSettings } from '../lib/api'
import type { AppSettings } from '../lib/types'

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
  qr_token: '',
}

function withDefaults(value: Partial<AppSettings>): AppSettings {
  return {
    ...defaults,
    ...value,
    overlay_title: value.overlay_title ?? defaults.overlay_title,
    overlay_title_enabled: value.overlay_title_enabled ?? defaults.overlay_title_enabled,
    overlay_title_size: value.overlay_title_size ?? defaults.overlay_title_size,
    overlay_title_color: value.overlay_title_color ?? defaults.overlay_title_color,
    overlay_title_background_color:
      value.overlay_title_background_color ?? defaults.overlay_title_background_color,
    overlay_title_padding: value.overlay_title_padding ?? defaults.overlay_title_padding,
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readPreviewDraft(): Partial<AppSettings> {
  const draft: Partial<AppSettings> = {}
  const previewTitle = window.localStorage.getItem('overlay_title_preview')
  const previewEnabled = window.localStorage.getItem('overlay_title_preview_enabled')
  const previewSize = window.localStorage.getItem('overlay_title_preview_size')
  const previewColor = window.localStorage.getItem('overlay_title_preview_color')
  const previewBackgroundColor = window.localStorage.getItem('overlay_title_preview_background_color')
  const previewPadding = window.localStorage.getItem('overlay_title_preview_padding')

  if (previewTitle) {
    draft.overlay_title = previewTitle
  }
  if (previewEnabled === 'true' || previewEnabled === 'false') {
    draft.overlay_title_enabled = previewEnabled === 'true'
  }
  if (previewSize) {
    const parsed = Number(previewSize)
    if (Number.isFinite(parsed)) {
      draft.overlay_title_size = parsed
    }
  }
  if (previewColor) {
    draft.overlay_title_color = previewColor
  }
  if (previewBackgroundColor) {
    draft.overlay_title_background_color = previewBackgroundColor
  }
  if (previewPadding) {
    const parsed = Number(previewPadding)
    if (Number.isFinite(parsed)) {
      draft.overlay_title_padding = parsed
    }
  }

  return draft
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaults)
  const [message, setMessage] = useState<string>('')
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    fetchSettings()
      .then((loaded) => {
        const draft = readPreviewDraft()
        setSettings(withDefaults({ ...loaded, ...draft }))
        setHasHydrated(true)
      })
      .catch(() => {
        const draft = readPreviewDraft()
        setSettings(withDefaults(draft))
        setMessage('Failed to load settings; using defaults.')
        setHasHydrated(true)
      })
  }, [])

  useEffect(() => {
    window.localStorage.setItem('overlay_title_preview_active', 'true')
    return () => {
      window.localStorage.removeItem('overlay_title_preview_active')
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }
    window.localStorage.setItem('overlay_title_preview', settings.overlay_title)
    window.localStorage.setItem('overlay_title_preview_enabled', settings.overlay_title_enabled ? 'true' : 'false')
    window.localStorage.setItem('overlay_title_preview_size', String(settings.overlay_title_size))
    window.localStorage.setItem('overlay_title_preview_color', settings.overlay_title_color)
    window.localStorage.setItem('overlay_title_preview_background_color', settings.overlay_title_background_color)
    window.localStorage.setItem('overlay_title_preview_padding', String(settings.overlay_title_padding))
  }, [
    hasHydrated,
    settings.overlay_title,
    settings.overlay_title_enabled,
    settings.overlay_title_size,
    settings.overlay_title_color,
    settings.overlay_title_background_color,
    settings.overlay_title_padding,
  ])

  const save = async () => {
    try {
      const updated = await updateSettings(settings)
      const merged = withDefaults({ ...settings, ...updated })
      setSettings(merged)
      window.localStorage.setItem('overlay_title', merged.overlay_title)
      window.localStorage.setItem(
        'overlay_title_enabled',
        merged.overlay_title_enabled ? 'true' : 'false',
      )
      window.localStorage.setItem(
        'overlay_title_size',
        String(merged.overlay_title_size),
      )
      window.localStorage.setItem(
        'overlay_title_color',
        merged.overlay_title_color,
      )
      window.localStorage.setItem(
        'overlay_title_background_color',
        merged.overlay_title_background_color,
      )
      window.localStorage.setItem(
        'overlay_title_padding',
        String(merged.overlay_title_padding),
      )
      setMessage('Settings saved.')
    } catch {
      setMessage('Failed to save settings.')
    }
  }

  return (
    <section className="d2-panel d2-ui">
      <h2>Settings</h2>
      <p>Overlay 및 공개 설정을 관리합니다.</p>

      <label className="settings-field">
        <span className="d2-label">Overlay Item Count</span>
        <select
          className="d2-select"
          value={settings.overlay_item_limit}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              overlay_item_limit: Number(event.target.value),
            }))
          }
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select>
      </label>

      <label className="settings-field">
        <span className="d2-label">Overlay Position</span>
        <select
          className="d2-select"
          value={settings.overlay_position}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              overlay_position: event.target.value as AppSettings['overlay_position'],
            }))
          }
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
          <option value="bottom">Bottom</option>
        </select>
      </label>

      <label className="settings-field">
        <span className="d2-label">Overlay Opacity</span>
        <input
          type="number"
          min={0.1}
          max={1}
          step={0.1}
          className="d2-input"
          value={settings.overlay_opacity}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              overlay_opacity: Number(event.target.value),
            }))
          }
        />
      </label>

      <label className="settings-field">
        <span className="d2-label">Overlay Title</span>
        <input
          type="text"
          className="d2-input"
          value={settings.overlay_title}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              overlay_title: event.target.value,
            }))
          }
        />
      </label>

      <label className="settings-field settings-field--inline">
        <input
          type="checkbox"
          checked={settings.overlay_title_enabled}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              overlay_title_enabled: event.target.checked,
            }))
          }
        />
        <span className="d2-label">Show overlay title</span>
      </label>

      <div className="settings-grid settings-grid--title">
        <label className="settings-field">
          <span className="d2-label">Title Size ({settings.overlay_title_size}px)</span>
          <input
            type="range"
            min={12}
            max={36}
            step={1}
            value={settings.overlay_title_size}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_title_size: Number(event.target.value),
              }))
            }
          />
        </label>

        <label className="settings-field">
          <span className="d2-label">Title Color</span>
          <input
            type="color"
            className="settings-color"
            value={settings.overlay_title_color}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_title_color: event.target.value,
              }))
            }
          />
        </label>

        <label className="settings-field">
          <span className="d2-label">Title Background</span>
          <input
            type="color"
            className="settings-color"
            value={settings.overlay_title_background_color}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_title_background_color: event.target.value,
              }))
            }
          />
        </label>

        <label className="settings-field">
          <span className="d2-label">Title Padding ({settings.overlay_title_padding}px)</span>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={settings.overlay_title_padding}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_title_padding: Number(event.target.value),
              }))
            }
          />
        </label>
      </div>

      <label className="settings-field">
        <span className="d2-label">Theme</span>
        <select
          className="d2-select"
          value={settings.theme}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              theme: event.target.value as AppSettings['theme'],
            }))
          }
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <label className="settings-field settings-field--inline">
        <input
          type="checkbox"
          checked={settings.qr_public_enabled}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              qr_public_enabled: event.target.checked,
            }))
          }
        />
        <span className="d2-label">Enable QR public page</span>
      </label>

      <label className="settings-field">
        <span className="d2-label">QR Token</span>
        <input
          type="text"
          className="d2-input"
          value={settings.qr_token}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              qr_token: event.target.value,
            }))
          }
        />
      </label>

      <button
        type="button"
        className="d2-button d2-button--secondary d2-button--sm"
        onClick={() =>
          setSettings((prev) => ({
            ...prev,
            qr_token: generateToken(),
          }))
        }
      >
        Regenerate Token
      </button>

      <button type="button" className="d2-button d2-button--primary" onClick={save}>
        Save settings
      </button>

      {message ? <p>{message}</p> : null}
    </section>
  )
}
