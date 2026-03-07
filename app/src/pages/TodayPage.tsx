import { useEffect, useState } from 'react'
import { fetchTodayItems, fetchTodayStats } from '../lib/api'
import type { ItemSummary, TodayStats } from '../lib/types'

export function TodayPage() {
  const [items, setItems] = useState<ItemSummary[]>([])
  const [stats, setStats] = useState<TodayStats | null>(null)

  useEffect(() => {
    fetchTodayItems().then(setItems).catch(() => setItems([]))
    fetchTodayStats().then(setStats).catch(() => setStats(null))
  }, [])

  return (
    <section className="panel">
      <h2>Today</h2>
      <p>오늘 획득한 아이템 목록입니다.</p>
      {stats ? (
        <div className="panel">
          <p>Total: {stats.totalItems}</p>
          <p>Unique: {stats.uniqueItems}</p>
          <p>Runes: {stats.runes}</p>
          <p>Materials: {stats.materials}</p>
        </div>
      ) : null}
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
