import { useEffect, useState } from 'react'
import { fetchOverlayItems } from '../lib/api'
import type { ItemSummary } from '../lib/types'

export function OverlayPage() {
  const [items, setItems] = useState<ItemSummary[]>([])

  useEffect(() => {
    fetchOverlayItems()
      .then((res) => setItems(res))
      .catch(() => setItems([]))
  }, [])

  return (
    <section className="panel">
      <h2>Overlay</h2>
      <p>OBS Browser Source용 최근 5개 아이템 카드.</p>
      <div className="grid">
        {items.map((item) => (
          <article key={item.id} className="panel item-card">
            <h3>{item.displayName}</h3>
            <p>{item.quality}</p>
          </article>
        ))}
      </div>
      {items.length === 0 ? <p>No overlay data yet.</p> : null}
    </section>
  )
}
