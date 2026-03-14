import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchItemDetail } from '../lib/api'
import { getItemVisualState } from '../lib/item-visual-state'
import { useUiLanguage } from '../lib/ui-language-context'
import type { ItemDetail } from '../lib/types'
import { getStatToneClass } from '../lib/item-stat-tone'
import { resolveItemTheme } from '../theme/resolveItemTheme'
import { withBasePathOptional } from '../lib/asset-path'

export function ItemDetailPage() {
  const { language } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          title: 'Item Detail',
          invalid: 'Invalid item id',
          back: 'Back to dashboard',
          loading: 'Loading...',
          copied: 'Copied',
          copyShare: 'Copy Share Text',
          name: 'Name',
          type: 'Type',
          quality: 'Quality',
          itemLevel: 'Item Level',
          defense: 'Defense',
          location: 'Location',
          captured: 'Captured',
          stats: 'Stats',
          noStats: 'No stats',
          corrupted: 'Corrupted',
          ethereal: 'Ethereal',
          socketed: 'Socketed',
        }
      : {
          title: 'Item Detail',
          invalid: 'Invalid item id',
          back: 'Back to dashboard',
          loading: 'Loading...',
          copied: 'Copied',
          copyShare: 'Copy Share Text',
          name: 'Name',
          type: 'Type',
          quality: 'Quality',
          itemLevel: 'Item Level',
          defense: 'Defense',
          location: 'Location',
          captured: 'Captured',
          stats: 'Stats',
          noStats: 'No stats',
          corrupted: 'Corrupted',
          ethereal: 'Ethereal',
          socketed: 'Socketed',
        }
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<ItemDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const invalidId = !id

  useEffect(() => {
    if (invalidId) {
      return
    }

    fetchItemDetail(id)
      .then(setItem)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
      })
  }, [id, invalidId])

  if (invalidId) {
    return (
      <section className="d2-panel d2-ui">
        <h2>{text.title}</h2>
        <p>{text.invalid}</p>
        <Link to="/">{text.back}</Link>
      </section>
    )
  }

  if (error) {
    return (
      <section className="d2-panel d2-ui">
        <h2>{text.title}</h2>
        <p>{error}</p>
        <Link to="/">{text.back}</Link>
      </section>
    )
  }

  if (!item) {
    return (
      <section className="d2-panel d2-ui">
        <h2>{text.title}</h2>
        <p>{text.loading}</p>
      </section>
    )
  }

  const shareText = `${item.displayName} (${item.quality} ${item.type})`
  const onCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const theme = resolveItemTheme({
    displayName: item.displayName,
    type: item.type,
    quality: item.quality,
    category: item.category,
    isCorrupted: item.isCorrupted,
    quantity: item.quantity,
    analysisProfile: item.analysisProfile,
    analysisTags: item.analysisTags,
    stats: item.stats,
  })
  const visualState = getItemVisualState({ analysisTags: item.analysisTags, stats: item.stats })

  return (
    <section className="d2-panel d2-ui item-themed item-detail-panel" style={theme.style}>
      <h2 className="item-theme-name">{item.displayName}</h2>
      <div className="item-theme-badges">
        <span className="item-theme-badge">{theme.rule.label}</span>
        {item.isCorrupted ? <span className="item-theme-badge corrupted-badge">{text.corrupted}</span> : null}
        {visualState.isEthereal ? <span className="item-theme-badge ethereal-badge">{text.ethereal}</span> : null}
        {visualState.socketCount !== null ? (
          <span className="item-theme-badge socket-badge">{text.socketed} ({visualState.socketCount})</span>
        ) : null}
      </div>
      <p>{text.name}: {item.name ?? '-'}</p>
      {item.thumbnail ? (
        <img
          className={`item-thumbnail${visualState.isEthereal ? ' is-ethereal' : ''}`}
          src={withBasePathOptional(item.thumbnail) ?? ''}
          alt={item.displayName}
        />
      ) : null}
      <p>{text.type}: {item.type}</p>
      <p>{text.quality}: {item.quality}</p>
      <p>{text.itemLevel}: {item.iLevel}</p>
      <p>{text.defense}: {item.defense ?? '-'}</p>
      <p>{text.location}: {item.location}</p>
      <p>{text.captured}: {new Date(item.capturedAt).toLocaleString()}</p>

      <button type="button" className="d2-button d2-button--primary" onClick={onCopyShare}>
        {copied ? text.copied : text.copyShare}
      </button>

      <div className="d2-panel">
        <h3>{text.stats}</h3>
        {item.stats.length === 0 ? <p>{text.noStats}</p> : null}
        {item.stats.map((stat) => (
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

      <Link to="/">{text.back}</Link>
    </section>
  )
}
