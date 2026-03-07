export interface RawItemStat {
  name: string
  value: number
  stat_id?: number
  range?: {
    min: number
    max: number
  }
}

export interface RawClipboardItem {
  name?: string
  type: string
  iLevel: number
  location: string
  quality: string
  quantity?: number
  corrupted?: boolean
  stats?: RawItemStat[]
}

export interface ParsedItem {
  name: string | null
  type: string
  iLevel: number
  location: string
  quality: string
  quantity: number | null
  displayName: string
  isCorrupted: boolean
  iconKey: string | null
  stats: {
    statName: string
    statValue: number
    rangeMin: number | null
    rangeMax: number | null
    statId: number | null
  }[]
  fingerprint: string
  rawJson: string
}
