import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchItemDetail } from '../lib/api'
import type { ItemDetail } from '../lib/types'

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
      <section className="panel">
        <h2>Item Detail</h2>
        <p>Invalid item id</p>
        <Link to="/">Back to dashboard</Link>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Item Detail</h2>
        <p>{error}</p>
        <Link to="/">Back to dashboard</Link>
      </section>
    )
  }

  if (!item) {
    return (
      <section className="panel">
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

  return (
    <section className="panel">
      <h2>{item.displayName}</h2>
      <p>Name: {item.name ?? '-'}</p>
      {item.thumbnail ? <img className="item-thumbnail" src={item.thumbnail} alt={item.displayName} /> : null}
      <p>Type: {item.type}</p>
      <p>Quality: {item.quality}</p>
      <p>Item Level: {item.iLevel}</p>
      <p>Defense: {item.defense ?? '-'}</p>
      <p>Location: {item.location}</p>
      <p>Captured: {new Date(item.capturedAt).toLocaleString()}</p>

      <button type="button" className="button-primary" onClick={onCopyShare}>
        {copied ? 'Copied' : 'Copy Share Text'}
      </button>

      <div className="panel">
        <h3>Stats</h3>
        {item.stats.length === 0 ? <p>No stats</p> : null}
        {item.stats.map((stat, index) => (
          <p key={`${stat.statName}-${index}`}>
            {stat.statName}: {stat.statValue}
            {stat.rangeMin !== null && stat.rangeMax !== null ? ` (${stat.rangeMin}-${stat.rangeMax})` : ''}
          </p>
        ))}
      </div>

      <Link to="/">Back to dashboard</Link>
    </section>
  )
}
