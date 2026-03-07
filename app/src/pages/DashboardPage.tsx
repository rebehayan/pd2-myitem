import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRecentItems } from '../lib/api'
import type { ItemSummary } from '../lib/types'

export function DashboardPage() {
  const [items, setItems] = useState<ItemSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentItems().then(setItems).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    })
  }, [])

  return (
    <section className="panel">
      <h2>Dashboard</h2>
      <p>최근 획득 아이템을 확인하는 기본 뷰입니다.</p>
      {error ? <p>{error}</p> : null}
      <div className="grid">
        {items.map((item) => (
          <article key={item.id} className="panel item-card">
            <h3>{item.displayName}</h3>
            <p>Quality: {item.quality}</p>
            <p>Captured: {new Date(item.capturedAt).toLocaleString()}</p>
            <Link to={`/item/${item.id}`}>View Detail</Link>
          </article>
        ))}
      </div>
      {items.length === 0 && !error ? <p>No captured items yet.</p> : null}
    </section>
  )
}
