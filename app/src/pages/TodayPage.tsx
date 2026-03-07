import { useEffect, useState } from 'react'
import { fetchTodayItems } from '../lib/api'
import type { ItemSummary } from '../lib/types'

export function TodayPage() {
  const [items, setItems] = useState<ItemSummary[]>([])

  useEffect(() => {
    fetchTodayItems().then(setItems).catch(() => setItems([]))
  }, [])

  return (
    <section className="panel">
      <h2>Today</h2>
      <p>오늘 획득한 아이템 목록입니다.</p>
      <div className="grid">
        {items.map((item) => (
          <article key={item.id} className="panel item-card">
            <h3>{item.displayName}</h3>
            <p>Qty: {item.quantity ?? 1}</p>
            <p>{new Date(item.capturedAt).toLocaleTimeString()}</p>
          </article>
        ))}
      </div>
      {items.length === 0 ? <p>No items captured today.</p> : null}
    </section>
  )
}
