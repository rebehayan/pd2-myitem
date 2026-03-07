export interface ItemSummary {
  id: string
  displayName: string
  quality: string
  quantity: number | null
  isCorrupted: boolean
  thumbnail: string | null
  capturedAt: string
}

export interface TodayStats {
  totalItems: number
  uniqueItems: number
  runes: number
  materials: number
}

export interface AppSettings {
  overlay_item_limit: number
  overlay_position: 'right' | 'left' | 'bottom'
  overlay_opacity: number
  theme: 'light' | 'dark'
  qr_public_enabled: boolean
  qr_token: string
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
  defense: number | null
  stats: ItemStat[]
}
