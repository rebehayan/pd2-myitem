export interface ItemSummary {
  id: string
  displayName: string
  quality: string
  quantity: number | null
  isCorrupted: boolean
  thumbnail: string | null
  capturedAt: string
}

export interface ItemStat {
  statName: string
  statValue: number
  rangeMin: number | null
  rangeMax: number | null
}

export interface ItemDetail extends ItemSummary {
  name: string | null
  type: string
  iLevel: number
  location: string
  stats: ItemStat[]
}
