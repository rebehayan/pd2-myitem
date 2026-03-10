import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { clearItems, deleteItem, fetchItemDetail, fetchRecentItems, fetchSettings } from '../lib/api'
import { getItemVisualState } from '../lib/item-visual-state'
import type { AppSettings, ItemDetail, ItemSummary } from '../lib/types'
import { getStatToneClass } from '../lib/item-stat-tone'
import { useAuth } from '../lib/auth-context'
import { useItemCaptureRefresh } from '../lib/use-item-capture-refresh'
import { resolveItemTheme } from '../theme/resolveItemTheme'

function statInline(stat: ItemDetail['stats'][number]): string {
  if (stat.statValue === null) {
    return stat.statName
  }
  return `${stat.statName} ${stat.statValue}`
}

function buildDiscordText(item: ItemDetail): string {
  const title = `${item.displayName} (${item.quality} ${item.type})`
  const info = `iLvl ${item.iLevel} | Def ${item.defense ?? '-'}${item.isCorrupted ? ' | (Corrupted)' : ''}`
  const stats = item.stats.slice(0, 4).map(statInline).join(' | ')
  return [title, info, stats].filter((line) => line.length > 0).join('\n')
}

function buildRedditText(item: ItemDetail): string {
  const lines = [`**${item.displayName}** *(${item.quality} ${item.type}${item.isCorrupted ? ', Corrupted' : ''})*`]
  lines.push(`- iLvl: ${item.iLevel}`)
  lines.push(`- Defense: ${item.defense ?? '-'}`)
  for (const stat of item.stats.slice(0, 6)) {
    const rangeText = stat.rangeMin !== null && stat.rangeMax !== null ? ` (${stat.rangeMin}-${stat.rangeMax})` : ''
    if (stat.statValue === null) {
      lines.push(`- ${stat.statName}`)
    } else {
      lines.push(`- ${stat.statName}: ${stat.statValue}${rangeText}`)
    }
  }
  return lines.join('\n')
}

function buildCompactText(item: ItemDetail): string {
  const parts = [item.displayName]
  if (item.quantity !== null) {
    parts.push(`x${item.quantity}`)
  }
  parts.push(
    ...item.stats.slice(0, 3).map((stat) => {
      if (stat.statValue === null) {
        return stat.statName.replaceAll(' ', '')
      }
      return `${stat.statName.replaceAll(' ', '')}${stat.statValue}`
    }),
  )
  if (item.isCorrupted) {
    parts.push('Corr')
  }
  return parts.join(' / ')
}

export function DashboardPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<ItemSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
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
  const loadingRef = useRef(false)
  const mountedRef = useRef(true)

  const refreshItems = useCallback(async () => {
    const result = await fetchRecentItems()
    setItems(result)
    setSelectedIds((prev) => {
      const next = new Set(result.map((item) => item.id).filter((id) => prev.has(id)))
      return next
    })
    setSelectedId((prev) => {
      if (prev && result.some((item) => item.id === prev)) {
        return prev
      }
      return result[0]?.id ?? null
    })
    return result
  }, [])

  const loadItems = useCallback(async () => {
    if (loadingRef.current || !mountedRef.current) {
      return
    }
    loadingRef.current = true

    try {
      const result = await refreshItems()
      if (!mountedRef.current) {
        return
      }
      setError(null)
      if (result.length === 0) {
        setSelectedItem(null)
      }
    } catch (err: unknown) {
      if (!mountedRef.current) {
        return
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      loadingRef.current = false
    }
  }, [refreshItems])

  useEffect(() => {
    mountedRef.current = true
    void loadItems()
    return () => {
      mountedRef.current = false
    }
  }, [loadItems])

  useItemCaptureRefresh(loadItems, { enabled: true })

  useEffect(() => {
    if (!session) {
      setSettings(null)
      return
    }

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
  }, [session])

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

  const selectedTheme = useMemo(() => {
    if (!selectedItem) {
      return null
    }
    return resolveItemTheme({
      displayName: selectedItem.displayName,
      type: selectedItem.type,
      quality: selectedItem.quality,
      category: selectedItem.category,
      isCorrupted: selectedItem.isCorrupted,
      quantity: selectedItem.quantity,
      analysisProfile: selectedItem.analysisProfile,
      analysisTags: selectedItem.analysisTags,
      stats: selectedItem.stats,
    })
  }, [selectedItem])

  const selectedVisualState = useMemo(() => {
    if (!selectedItem) {
      return { isEthereal: false, socketCount: null }
    }
    return getItemVisualState({ analysisTags: selectedItem.analysisTags, stats: selectedItem.stats })
  }, [selectedItem])

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

  const onToggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const onToggleAll = () => {
    setSelectedIds((prev) => {
      const filteredIds = filteredItems.map((item) => item.id)
      const allSelected = filteredIds.every((id) => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        for (const id of filteredIds) {
          next.delete(id)
        }
        return next
      }
      const next = new Set(prev)
      for (const id of filteredIds) {
        next.add(id)
      }
      return next
    })
  }

  const onDeleteChecked = async () => {
    if (deleting || selectedIds.size === 0) {
      return
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected item(s)?`)) {
      return
    }

    try {
      setDeleting(true)
      setActionError(null)
      await Promise.all(Array.from(selectedIds).map((id) => deleteItem(id)))
      const latest = await refreshItems()
      if (latest.length === 0) {
        setSelectedItem(null)
      }
      setSelectedIds(new Set())
      setActionMessage(`Deleted ${selectedIds.size} item(s).`)
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete selected items.'
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
    <section className="d2-panel d2-ui">
      <h2>Dashboard</h2>
      <p>아이템 검색, 상세 확인, 공유 텍스트 생성을 한 화면에서 처리합니다.</p>
      {error ? <p>{error}</p> : null}

      <div className="dashboard-search">
        <input
          type="text"
          placeholder="Search by name, type, quality"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="d2-input"
        />
      </div>

      <section className="d2-panel dashboard-qr" aria-label="QR share panel">
        <div className="dashboard-qr__header">
          <h3>Today QR</h3>
          {session ? (
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={() => setShowQr((prev) => !prev)}
            >
              {showQr ? 'Hide QR' : 'Show QR'}
            </button>
          ) : null}
        </div>
        {session ? (
          <>
            <p>Viewer page link for mobile access.</p>
            <p>
              <strong>Share URL:</strong> {qrLink}
            </p>
            <button type="button" className="d2-button d2-button--primary" onClick={() => onCopy('today-link', qrLink)}>
              Copy Today Link
            </button>
            {settingsError ? <p>{settingsError}</p> : null}
            {showQr && qrDataUrl ? <img src={qrDataUrl} alt="Today page QR code" className="dashboard-qr__image" /> : null}
          </>
        ) : (
          <p>로그인한 사용자만 공유 링크/QR을 사용할 수 있습니다.</p>
        )}
      </section>

      <div className="dashboard-layout">
        <section className="d2-panel dashboard-list" aria-label="Recent Items List">
          <h3>Recent Items</h3>
          <div className="dashboard-list__actions">
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={onToggleAll}
              disabled={filteredItems.length === 0}
            >
              {filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id))
                ? 'Unselect All'
                : 'Select All'}
            </button>
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={onDeleteChecked}
              disabled={selectedIds.size === 0 || deleting}
            >
              Delete Checked ({selectedIds.size})
            </button>
          </div>
          {filteredItems.map((item) => {
            const theme = resolveItemTheme({
              displayName: item.displayName,
              type: item.type,
              quality: item.quality,
              category: item.category,
              isCorrupted: item.isCorrupted,
              quantity: item.quantity,
              analysisProfile: item.analysisProfile,
              analysisTags: item.analysisTags,
            })
            const visualState = getItemVisualState({ analysisTags: item.analysisTags })

            return (
              <button
                key={item.id}
                type="button"
                className={`dashboard-row item-themed${selectedId === item.id ? ' is-active' : ''}`}
                style={theme.style}
                onClick={() => setSelectedId(item.id)}
              >
                <input
                  type="checkbox"
                  className="dashboard-row__checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelected(item.id)}
                  onClick={(event) => event.stopPropagation()}
                />
                {item.thumbnail ? (
                  <img
                    className={`dashboard-row__thumb${visualState.isEthereal ? ' is-ethereal' : ''}`}
                    src={item.thumbnail}
                    alt={item.displayName}
                  />
                ) : null}
                <div className="dashboard-row__content">
                  <strong className="item-theme-name">{item.displayName}</strong>
                  <span>{item.quality}</span>
                  <span>Qty: {item.quantity ?? 1}</span>
                  <div className="item-theme-badges">
                    {item.isCorrupted ? <span className="item-theme-badge corrupted-badge">Corrupted</span> : null}
                    {visualState.isEthereal ? <span className="item-theme-badge ethereal-badge">Ethereal</span> : null}
                    {visualState.socketCount !== null ? (
                      <span className="item-theme-badge socket-badge">Socketed ({visualState.socketCount})</span>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
          {filteredItems.length === 0 ? <p>No matching items.</p> : null}
        </section>

        <section
          className={`d2-panel dashboard-detail${selectedTheme ? ' item-themed' : ''}`}
          style={selectedTheme?.style}
          aria-label="Item Detail Panel"
        >
          <h3>Item Detail</h3>
          {!selectedItem ? <p>Select an item to view details.</p> : null}
          {selectedItem ? (
            <>
              {selectedItem.thumbnail ? (
                <img
                  className={`item-thumbnail${selectedVisualState.isEthereal ? ' is-ethereal' : ''}`}
                  src={selectedItem.thumbnail}
                  alt={selectedItem.displayName}
                />
              ) : null}
              <p>
                Name:{' '}
                <strong className="item-theme-name">
                  {selectedItem.name ?? selectedItem.displayName}
                </strong>
              </p>
              {selectedTheme ? (
                <div className="item-theme-badges">
                  <span className="item-theme-badge">{selectedTheme.rule.label}</span>
                  {selectedItem.isCorrupted ? <span className="item-theme-badge corrupted-badge">Corrupted</span> : null}
                  {selectedVisualState.isEthereal ? <span className="item-theme-badge ethereal-badge">Ethereal</span> : null}
                  {selectedVisualState.socketCount !== null ? (
                    <span className="item-theme-badge socket-badge">Socketed ({selectedVisualState.socketCount})</span>
                  ) : null}
                </div>
              ) : null}
              <p>Type: {selectedItem.type}</p>
              <p>Item Level: {selectedItem.iLevel}</p>
              <p>Defense: {selectedItem.defense ?? '-'}</p>
              <p>Location: {selectedItem.location}</p>
              <div className="d2-panel">
                <h4>Stats</h4>
                {selectedItem.stats.length === 0 ? <p>No stats</p> : null}
                {selectedItem.stats.map((stat, idx) => (
                  <p key={`${stat.statName}-${idx}`} className={`item-theme-stat${stat.isCorrupted ? ' is-corrupted' : ''}`}>
                    {stat.statValue === null ? (
                      <span className={`item-theme-stat-label${getStatToneClass(stat.statName)}`}>
                        {stat.statName}
                      </span>
                    ) : (
                      <>
                        <span className={`item-theme-stat-label${getStatToneClass(stat.statName)}`}>
                          {stat.statName}:
                        </span>
                        <span className={`item-theme-stat-value${getStatToneClass(stat.statName)}`}>
                          {stat.statValue}
                          {stat.rangeMin !== null && stat.rangeMax !== null ? (
                            <span className="item-theme-stat-range"> ({stat.rangeMin}-{stat.rangeMax})</span>
                          ) : null}
                        </span>
                      </>
                    )}
                  </p>
                ))}
              </div>

                <div className="dashboard-share">
                <button
                  type="button"
                  className="d2-button d2-button--primary d2-button--sm"
                  onClick={() => onCopy('discord', buildDiscordText(selectedItem))}
                >
                  Copy Discord
                </button>
                <button
                  type="button"
                  className="d2-button d2-button--secondary d2-button--sm"
                  onClick={() => onCopy('reddit', buildRedditText(selectedItem))}
                >
                  Copy Reddit
                </button>
                <button
                  type="button"
                  className="d2-button d2-button--secondary d2-button--sm"
                  onClick={() => onCopy('compact', buildCompactText(selectedItem))}
                >
                  Copy Compact
                </button>
                {copiedLabel ? <p>Copied {copiedLabel} format.</p> : null}
                <div>
                  <button
                    type="button"
                    className="d2-button d2-button--secondary d2-button--sm"
                    onClick={onDeleteSelected}
                    disabled={deleting}
                  >
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    className="d2-button d2-button--secondary d2-button--sm"
                    onClick={onClearAll}
                    disabled={deleting}
                  >
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
