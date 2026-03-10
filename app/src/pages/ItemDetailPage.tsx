import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchItemDetail } from '../lib/api'
import { getItemVisualState } from '../lib/item-visual-state'
import type { ItemDetail } from '../lib/types'
import { getStatToneClass } from '../lib/item-stat-tone'
import { resolveItemTheme } from '../theme/resolveItemTheme'

export function ItemDetailPage() {
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
        <h2>Item Detail</h2>
        <p>Invalid item id</p>
        <Link to="/">Back to dashboard</Link>
      </section>
    )
  }

  if (error) {
    return (
      <section className="d2-panel d2-ui">
        <h2>Item Detail</h2>
        <p>{error}</p>
        <Link to="/">Back to dashboard</Link>
      </section>
    )
  }

  if (!item) {
    return (
      <section className="d2-panel d2-ui">
        <h2>Item Detail</h2>
        <p>Loading...</p>
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
        {item.isCorrupted ? <span className="item-theme-badge corrupted-badge">Corrupted</span> : null}
        {visualState.isEthereal ? <span className="item-theme-badge ethereal-badge">Ethereal</span> : null}
        {visualState.socketCount !== null ? (
          <span className="item-theme-badge socket-badge">Socketed ({visualState.socketCount})</span>
        ) : null}
      </div>
      <p>Name: {item.name ?? '-'}</p>
      {item.thumbnail ? (
        <img
          className={`item-thumbnail${visualState.isEthereal ? ' is-ethereal' : ''}`}
          src={item.thumbnail}
          alt={item.displayName}
        />
      ) : null}
      <p>Type: {item.type}</p>
      <p>Quality: {item.quality}</p>
      <p>Item Level: {item.iLevel}</p>
      <p>Defense: {item.defense ?? '-'}</p>
      <p>Location: {item.location}</p>
      <p>Captured: {new Date(item.capturedAt).toLocaleString()}</p>

      <button type="button" className="d2-button d2-button--primary" onClick={onCopyShare}>
        {copied ? 'Copied' : 'Copy Share Text'}
      </button>

      <div className="d2-panel">
        <h3>Stats</h3>
        {item.stats.length === 0 ? <p>No stats</p> : null}
        {item.stats.map((stat, index) => (
          <p key={`${stat.statName}-${index}`} className={`item-theme-stat${stat.isCorrupted ? ' is-corrupted' : ''}`}>
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

      <Link to="/">Back to dashboard</Link>
    </section>
  )
}
