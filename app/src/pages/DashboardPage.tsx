import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { clearItems, deleteItem, fetchItemDetail, fetchRecentItems, fetchSettings } from '../lib/api'
import type { AppSettings, ItemDetail, ItemSummary } from '../lib/types'

const dashboardPollMs = 1000

function buildDiscordText(item: ItemDetail): string {
  const title = `${item.displayName} (${item.quality} ${item.type})`
  const info = `iLvl ${item.iLevel} | Def ${item.defense ?? '-'}${item.isCorrupted ? ' | (Corrupted)' : ''}`
  const stats = item.stats.slice(0, 4).map((stat) => `${stat.statName} ${stat.statValue}`).join(' | ')
  return [title, info, stats].filter((line) => line.length > 0).join('\n')
}

function buildRedditText(item: ItemDetail): string {
  const lines = [`**${item.displayName}** *(${item.quality} ${item.type}${item.isCorrupted ? ', Corrupted' : ''})*`]
  lines.push(`- iLvl: ${item.iLevel}`)
  lines.push(`- Defense: ${item.defense ?? '-'}`)
  for (const stat of item.stats.slice(0, 6)) {
    const rangeText = stat.rangeMin !== null && stat.rangeMax !== null ? ` (${stat.rangeMin}-${stat.rangeMax})` : ''
    lines.push(`- ${stat.statName}: ${stat.statValue}${rangeText}`)
  }
  return lines.join('\n')
}

function buildCompactText(item: ItemDetail): string {
  const parts = [item.displayName]
  if (item.quantity !== null) {
    parts.push(`x${item.quantity}`)
  }
  parts.push(...item.stats.slice(0, 3).map((stat) => `${stat.statName.replaceAll(' ', '')}${stat.statValue}`))
  if (item.isCorrupted) {
    parts.push('Corr')
  }
  return parts.join(' / ')
}

export function DashboardPage() {
  const [items, setItems] = useState<ItemSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refreshItems = useCallback(async () => {
    const result = await fetchRecentItems()
    setItems(result)
    setSelectedId((prev) => {
      if (prev && result.some((item) => item.id === prev)) {
        return prev
      }
      return result[0]?.id ?? null
    })
    return result
  }, [])

  useEffect(() => {
    let disposed = false
    let loading = false

    const load = async () => {
      if (loading) {
        return
      }
      loading = true

      try {
        const result = await refreshItems()
        if (disposed) {
          return
        }

        setError(null)
        if (result.length === 0) {
          setSelectedItem(null)
        }
      } catch (err: unknown) {
        if (disposed) {
          return
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
      } finally {
        loading = false
      }
    }

    load()
    const timer = window.setInterval(load, dashboardPollMs)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [refreshItems])

  useEffect(() => {
    let disposed = false

    fetchSettings()
      .then((result) => {
        if (disposed) {
          return
        }
        setSettings(result)
      })
      .catch(() => {
        if (disposed) {
          return
        }
        setSettingsError('Failed to load QR settings.')
      })

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null)
      return
    }

    let disposed = false

    fetchItemDetail(selectedId)
      .then((item) => {
        if (disposed) {
          return
        }
        setSelectedItem(item)
      })
      .catch(() => {
        if (disposed) {
          return
        }
        setSelectedItem(null)
      })

    return () => {
      disposed = true
    }
  }, [selectedId])

  const filteredItems = useMemo(() => {
    const lowered = query.trim().toLowerCase()
    if (!lowered) {
      return items
    }

    return items.filter((item) => {
      return (
        item.displayName.toLowerCase().includes(lowered) ||
        item.type.toLowerCase().includes(lowered) ||
        item.quality.toLowerCase().includes(lowered)
      )
    })
  }, [items, query])

  const onCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedLabel(label)
      window.setTimeout(() => setCopiedLabel(null), 1200)
    } catch {
      setCopiedLabel(null)
    }
  }

  const onDeleteSelected = async () => {
    if (!selectedId || deleting) {
      return
    }
    if (!window.confirm('Delete selected item from the list?')) {
      return
    }

    try {
      setDeleting(true)
      setActionError(null)
      await deleteItem(selectedId)
      const latest = await refreshItems()
      if (latest.length === 0) {
        setSelectedItem(null)
      }
      setActionMessage('Selected item deleted.')
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete selected item.'
      setActionError(message)
    } finally {
      setDeleting(false)
    }
  }

  const onClearAll = async () => {
    if (deleting) {
      return
    }
    if (!window.confirm('Delete all captured items from the list?')) {
      return
    }

    try {
      setDeleting(true)
      setActionError(null)
      const deletedCount = await clearItems()
      await refreshItems()
      setSelectedItem(null)
      setActionMessage(`Deleted ${deletedCount} item(s).`)
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear item list.'
      setActionError(message)
    } finally {
      setDeleting(false)
    }
  }

  const qrPublicUrl = `${window.location.origin}/today`

  const qrTokenUrl = (() => {
    if (!settings?.qr_token) {
      return qrPublicUrl
    }
    return `${window.location.origin}/today?key=${encodeURIComponent(settings.qr_token)}`
  })()

  const qrLink = (() => {
    if (!settings) {
      return qrPublicUrl
    }
    if (!settings.qr_public_enabled && settings.qr_token) {
      return qrTokenUrl
    }
    return settings.qr_token ? qrTokenUrl : qrPublicUrl
  })()

  useEffect(() => {
    let disposed = false

    const generate = async () => {
      if (!showQr) {
        setQrDataUrl('')
        return
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrLink, {
          margin: 1,
          width: 256,
        })
        if (!disposed) {
          setQrDataUrl(dataUrl)
        }
      } catch {
        if (!disposed) {
          setQrDataUrl('')
        }
      }
    }

    generate()
    return () => {
      disposed = true
    }
  }, [qrLink, showQr])

  return (
    <section className="panel">
      <h2>Dashboard</h2>
      <p>아이템 검색, 상세 확인, 공유 텍스트 생성을 한 화면에서 처리합니다.</p>
      {error ? <p>{error}</p> : null}

      <div className="dashboard-search">
        <input
          type="text"
          placeholder="Search by name, type, quality"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <section className="panel dashboard-qr" aria-label="QR share panel">
        <div className="dashboard-qr__header">
          <h3>Today QR</h3>
          <button type="button" className="button-secondary" onClick={() => setShowQr((prev) => !prev)}>
            {showQr ? 'Hide QR' : 'Show QR'}
          </button>
        </div>
        <p>Viewer page link for mobile access.</p>
        <p>
          <strong>Share URL:</strong> {qrLink}
        </p>
        <button type="button" className="button-primary" onClick={() => onCopy('today-link', qrLink)}>
          Copy Today Link
        </button>
        {settingsError ? <p>{settingsError}</p> : null}
        {showQr && qrDataUrl ? <img src={qrDataUrl} alt="Today page QR code" className="dashboard-qr__image" /> : null}
      </section>

      <div className="dashboard-layout">
        <section className="panel dashboard-list" aria-label="Recent Items List">
          <h3>Recent Items</h3>
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dashboard-row${selectedId === item.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              {item.thumbnail ? <img className="dashboard-row__thumb" src={item.thumbnail} alt={item.displayName} /> : null}
              <div className="dashboard-row__content">
                <strong>{item.displayName}</strong>
                <span>{item.quality}</span>
                <span>Qty: {item.quantity ?? 1}</span>
                {item.isCorrupted ? <span className="dashboard-badge">Corrupted</span> : null}
              </div>
            </button>
          ))}
          {filteredItems.length === 0 ? <p>No matching items.</p> : null}
        </section>

        <section className="panel dashboard-detail" aria-label="Item Detail Panel">
          <h3>Item Detail</h3>
          {!selectedItem ? <p>Select an item to view details.</p> : null}
          {selectedItem ? (
            <>
              {selectedItem.thumbnail ? (
                <img className="item-thumbnail" src={selectedItem.thumbnail} alt={selectedItem.displayName} />
              ) : null}
              <p>Name: {selectedItem.name ?? selectedItem.displayName}</p>
              <p>Type: {selectedItem.type}</p>
              <p>Item Level: {selectedItem.iLevel}</p>
              <p>Defense: {selectedItem.defense ?? '-'}</p>
              <p>Location: {selectedItem.location}</p>
              <div className="panel">
                <h4>Stats</h4>
                {selectedItem.stats.length === 0 ? <p>No stats</p> : null}
                {selectedItem.stats.map((stat, idx) => (
                  <p key={`${stat.statName}-${idx}`}>
                    {stat.statName}: {stat.statValue}
                    {stat.rangeMin !== null && stat.rangeMax !== null ? ` (${stat.rangeMin}-${stat.rangeMax})` : ''}
                  </p>
                ))}
              </div>

                <div className="dashboard-share">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => onCopy('discord', buildDiscordText(selectedItem))}
                >
                  Copy Discord
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => onCopy('reddit', buildRedditText(selectedItem))}
                >
                  Copy Reddit
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => onCopy('compact', buildCompactText(selectedItem))}
                >
                  Copy Compact
                </button>
                {copiedLabel ? <p>Copied {copiedLabel} format.</p> : null}
                <div>
                  <button type="button" className="button-secondary" onClick={onDeleteSelected} disabled={deleting}>
                    Delete Selected
                  </button>
                  <button type="button" className="button-secondary" onClick={onClearAll} disabled={deleting}>
                    Clear List
                  </button>
                </div>
                {actionMessage ? <p>{actionMessage}</p> : null}
                {actionError ? <p>{actionError}</p> : null}
              </div>

              <Link to={`/item/${selectedItem.id}`}>Open full detail page</Link>
            </>
          ) : null}
        </section>
      </div>
    </section>
  )
}
