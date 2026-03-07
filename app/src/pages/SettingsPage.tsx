import { useEffect, useState } from 'react'
import { fetchSettings, updateSettings } from '../lib/api'
import type { AppSettings } from '../lib/types'

const defaults: AppSettings = {
  overlay_item_limit: 10,
  overlay_position: 'right',
  overlay_opacity: 0.8,
  theme: 'light',
  qr_public_enabled: true,
  qr_token: '',
}

function generateToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaults)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    fetchSettings()
      .then((loaded) => {
        setSettings(loaded)
      })
      .catch(() => {
        setMessage('Failed to load settings; using defaults.')
      })
  }, [])

  const save = async () => {
    try {
      const updated = await updateSettings(settings)
      setSettings(updated)
      setMessage('Settings saved.')
    } catch {
      setMessage('Failed to save settings.')
    }
  }

  return (
    <section className="panel">
      <h2>Settings</h2>
      <p>Overlay 및 공개 설정을 관리합니다.</p>

      <label className="settings-field">
        Overlay Item Count
        <select
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
        Overlay Position
        <select
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
        Overlay Opacity
        <input
          type="number"
          min={0.1}
          max={1}
          step={0.1}
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
        Theme
        <select
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
        Enable QR public page
      </label>

      <label className="settings-field">
        QR Token
        <input
          type="text"
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
        className="button-secondary"
        onClick={() =>
          setSettings((prev) => ({
            ...prev,
            qr_token: generateToken(),
          }))
        }
      >
        Regenerate Token
      </button>

      <button type="button" className="button-primary" onClick={save}>
        Save settings
      </button>

      {message ? <p>{message}</p> : null}
    </section>
  )
}
