import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { clearItems, deleteItem, fetchItemDetail, fetchRecentItems, fetchSettings } from '../lib/api'
import { getItemVisualState } from '../lib/item-visual-state'
import type { AppSettings, ItemDetail, ItemSummary } from '../lib/types'
import { getStatToneClass } from '../lib/item-stat-tone'
import { useAuth } from '../lib/auth-context'
import { useUiLanguage } from '../lib/ui-language-context'
import { useItemCaptureRefresh } from '../lib/use-item-capture-refresh'
import { resolveItemTheme } from '../theme/resolveItemTheme'
import { withBasePathOptional } from '../lib/asset-path'

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
  const { language } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          title: '대시보드',
          subtitle: '아이템 검색, 상세 확인, 공유 텍스트 생성을 한 화면에서 처리합니다.',
          guidePrompt: '처음이라면 사용자 가이드에서 설정/운영 순서를 먼저 확인하세요.',
          openGuide: '사용자 가이드 열기',
          searchPlaceholder: 'Search by name, type, quality',
          qrTitle: '투데이 QR',
          showQr: 'QR 보기',
          hideQr: 'QR 숨기기',
          viewerLink: '모바일 접속용 뷰어 링크입니다.',
          shareUrl: '공유 URL',
          copyTodayLink: '투데이 링크 복사',
          qrLoginOnly: '로그인한 사용자만 공유 링크/QR을 사용할 수 있습니다.',
          recentItems: '최근 아이템',
          selectAll: '전체 선택',
          unselectAll: 'Unselect All',
          deleteChecked: '선택 삭제',
          noMatch: 'No matching items.',
          itemDetail: '아이템 상세',
          selectPrompt: 'Select an item to view details.',
          quality: 'Quality',
          qty: 'Qty',
          type: 'Type',
          itemLevel: 'Item Level',
          defense: 'Defense',
          location: 'Location',
          stats: 'Stats',
          noStats: 'No stats',
          copyDiscord: 'Copy Discord',
          copyReddit: 'Copy Reddit',
          copyCompact: 'Copy Compact',
          copiedFormat: 'Copied format',
          deleteSelected: 'Delete Selected',
          clearList: 'Clear List',
          openFull: 'Open full detail page',
          loadQrFail: 'QR 설정을 불러오지 못했습니다.',
          confirmDeleteSelected: 'Delete selected item from the list?',
          confirmDeleteChecked: 'Delete selected items?',
          confirmClearAll: 'Delete all captured items from the list?',
          selectedDeleted: 'Selected item deleted.',
          deletedItems: 'item(s) deleted.',
          deleteSelectedFail: 'Failed to delete selected item.',
          deleteCheckedFail: 'Failed to delete selected items.',
          clearFail: 'Failed to clear item list.',
          name: 'Name',
        }
      : {
          title: 'Dashboard',
          subtitle: 'Search items, inspect details, and generate share text in one place.',
          guidePrompt: 'New here? Open the user guide for setup and operation flow.',
          openGuide: 'Open User Guide',
          searchPlaceholder: 'Search by name, type, quality',
          qrTitle: 'Today QR',
          showQr: 'Show QR',
          hideQr: 'Hide QR',
          viewerLink: 'Viewer page link for mobile access.',
          shareUrl: 'Share URL',
          copyTodayLink: 'Copy Today Link',
          qrLoginOnly: 'Only signed-in users can use share link/QR.',
          recentItems: 'Recent Items',
          selectAll: 'Select All',
          unselectAll: 'Unselect All',
          deleteChecked: 'Delete Checked',
          noMatch: 'No matching items.',
          itemDetail: 'Item Detail',
          selectPrompt: 'Select an item to view details.',
          quality: 'Quality',
          qty: 'Qty',
          type: 'Type',
          itemLevel: 'Item Level',
          defense: 'Defense',
          location: 'Location',
          stats: 'Stats',
          noStats: 'No stats',
          copyDiscord: 'Copy Discord',
          copyReddit: 'Copy Reddit',
          copyCompact: 'Copy Compact',
          copiedFormat: 'Copied format',
          deleteSelected: 'Delete Selected',
          clearList: 'Clear List',
          openFull: 'Open full detail page',
          loadQrFail: 'Failed to load QR settings.',
          confirmDeleteSelected: 'Delete selected item from the list?',
          confirmDeleteChecked: 'Delete selected items?',
          confirmClearAll: 'Delete all captured items from the list?',
          selectedDeleted: 'Selected item deleted.',
          deletedItems: 'item(s) deleted.',
          deleteSelectedFail: 'Failed to delete selected item.',
          deleteCheckedFail: 'Failed to delete selected items.',
          clearFail: 'Failed to clear item list.',
          name: 'Name',
        }
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
        setSettingsError(text.loadQrFail)
      })

    return () => {
      disposed = true
    }
  }, [session, text.loadQrFail])

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
    if (!window.confirm(text.confirmDeleteSelected)) {
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
      setActionMessage(text.selectedDeleted)
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : text.deleteSelectedFail
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
    if (!window.confirm(`${text.confirmDeleteChecked} (${selectedIds.size})`)) {
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
      setActionMessage(`${selectedIds.size} ${text.deletedItems}`)
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : text.deleteCheckedFail
      setActionError(message)
    } finally {
      setDeleting(false)
    }
  }

  const onClearAll = async () => {
    if (deleting) {
      return
    }
    if (!window.confirm(text.confirmClearAll)) {
      return
    }

    try {
      setDeleting(true)
      setActionError(null)
      const deletedCount = await clearItems()
      await refreshItems()
      setSelectedItem(null)
      setActionMessage(`${deletedCount} ${text.deletedItems}`)
      window.setTimeout(() => setActionMessage(null), 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : text.clearFail
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
      <h2>{text.title}</h2>
      <p>{text.subtitle}</p>
      <div className="dashboard-list__actions">
        <span>{text.guidePrompt}</span>
        <Link to="/guide" className="d2-button d2-button--secondary d2-button--sm">
          {text.openGuide}
        </Link>
      </div>
      {error ? <p>{error}</p> : null}

      <div className="dashboard-search">
        <input
          type="text"
          placeholder={text.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="d2-input"
        />
      </div>

      <section className="d2-panel dashboard-qr" aria-label="QR share panel">
        <div className="dashboard-qr__header">
          <h3>{text.qrTitle}</h3>
          {session ? (
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={() => setShowQr((prev) => !prev)}
            >
              {showQr ? text.hideQr : text.showQr}
            </button>
          ) : null}
        </div>
        {session ? (
          <>
            <p>{text.viewerLink}</p>
            <p>
              <strong>{text.shareUrl}:</strong> {qrLink}
            </p>
            <button type="button" className="d2-button d2-button--primary" onClick={() => onCopy('today-link', qrLink)}>
              {text.copyTodayLink}
            </button>
            {settingsError ? <p>{settingsError}</p> : null}
            {showQr && qrDataUrl ? <img src={qrDataUrl} alt="Today page QR code" className="dashboard-qr__image" /> : null}
          </>
        ) : (
          <p>{text.qrLoginOnly}</p>
        )}
      </section>

      <div className="dashboard-layout">
        <section className="d2-panel dashboard-list" aria-label="Recent Items List">
          <h3>{text.recentItems}</h3>
          <div className="dashboard-list__actions">
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={onToggleAll}
              disabled={filteredItems.length === 0}
            >
              {filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id))
                ? text.unselectAll
                : text.selectAll}
            </button>
            <button
              type="button"
              className="d2-button d2-button--secondary d2-button--sm"
              onClick={onDeleteChecked}
              disabled={selectedIds.size === 0 || deleting}
            >
              {text.deleteChecked} ({selectedIds.size})
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
                    src={withBasePathOptional(item.thumbnail) ?? ''}
                    alt={item.displayName}
                  />
                ) : null}
                <div className="dashboard-row__content">
                  <strong className="item-theme-name">{item.displayName}</strong>
                  <span>{item.quality}</span>
                   <span>{text.qty}: {item.quantity ?? 1}</span>
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
          {filteredItems.length === 0 ? <p>{text.noMatch}</p> : null}
        </section>

        <section
          className={`d2-panel dashboard-detail${selectedTheme ? ' item-themed' : ''}`}
          style={selectedTheme?.style}
          aria-label="Item Detail Panel"
        >
           <h3>{text.itemDetail}</h3>
           {!selectedItem ? <p>{text.selectPrompt}</p> : null}
          {selectedItem ? (
            <>
              {selectedItem.thumbnail ? (
                <img
                  className={`item-thumbnail${selectedVisualState.isEthereal ? ' is-ethereal' : ''}`}
                  src={withBasePathOptional(selectedItem.thumbnail) ?? ''}
                  alt={selectedItem.displayName}
                />
              ) : null}
               <p>
                 {text.name}:{' '}
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
               <p>{text.type}: {selectedItem.type}</p>
               <p>{text.itemLevel}: {selectedItem.iLevel}</p>
               <p>{text.defense}: {selectedItem.defense ?? '-'}</p>
               <p>{text.location}: {selectedItem.location}</p>
               <div className="d2-panel">
                 <h4>{text.stats}</h4>
                 {selectedItem.stats.length === 0 ? <p>{text.noStats}</p> : null}
                {selectedItem.stats.map((stat) => (
                  <p
                    key={`${stat.statName}-${stat.statValue ?? 'null'}-${stat.rangeMin ?? 'null'}-${stat.rangeMax ?? 'null'}`}
                    className={`item-theme-stat${stat.isCorrupted ? ' is-corrupted' : ''}`}
                  >
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
                   {text.copyDiscord}
                </button>
                <button
                  type="button"
                  className="d2-button d2-button--secondary d2-button--sm"
                  onClick={() => onCopy('reddit', buildRedditText(selectedItem))}
                >
                   {text.copyReddit}
                </button>
                <button
                  type="button"
                  className="d2-button d2-button--secondary d2-button--sm"
                  onClick={() => onCopy('compact', buildCompactText(selectedItem))}
                >
                   {text.copyCompact}
                </button>
                 {copiedLabel ? <p>{text.copiedFormat}: {copiedLabel}</p> : null}
                <div>
                  <button
                    type="button"
                    className="d2-button d2-button--secondary d2-button--sm"
                    onClick={onDeleteSelected}
                    disabled={deleting}
                  >
                     {text.deleteSelected}
                  </button>
                  <button
                    type="button"
                    className="d2-button d2-button--secondary d2-button--sm"
                    onClick={onClearAll}
                    disabled={deleting}
                  >
                     {text.clearList}
                  </button>
                </div>
                {actionMessage ? <p>{actionMessage}</p> : null}
                {actionError ? <p>{actionError}</p> : null}
              </div>

               <Link to={`/item/${selectedItem.id}`}>{text.openFull}</Link>
            </>
          ) : null}
        </section>
      </div>
    </section>
  )
}
