export interface ItemSummary {
  id: string
  type: string
  displayName: string
  quality: string
  quantity: number | null
  isCorrupted: boolean
  thumbnail: string | null
  capturedAt: string
  keyStats?: string[]
  category?: string
  analysisProfile?: string
  analysisTags?: string[]
}

export interface TodayStats {
  totalItems: number
  uniqueItems: number
  runes: number
  materials: number
}

export interface TodayPublicItem {
  displayName: string
  quality: string
  quantity: number | null
  isCorrupted: boolean
  thumbnail: string | null
  capturedAt: string
  category?: string
  analysisProfile?: string
  analysisTags?: string[]
}

export interface TodayPublicPayload {
  date: string
  stats: TodayStats
  items: TodayPublicItem[]
}

export interface AppSettings {
  overlay_item_limit: number
  overlay_position: 'right' | 'left' | 'bottom'
  overlay_opacity: number
  overlay_title: string
  overlay_title_enabled: boolean
  overlay_title_size: number
  overlay_title_color: string
  overlay_title_background_color: string
  overlay_title_padding: number
  theme: 'light' | 'dark'
  qr_public_enabled: boolean
  qr_token: string
}

export interface ItemStat {
  statName: string
  statValue: number | null
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
