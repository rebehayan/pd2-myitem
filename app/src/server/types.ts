export type AnalysisProfile =
  | 'normal_material'
  | 'normal_rune'
  | 'magic_item'
  | 'rare_item'
  | 'unique_item'
  | 'corrupted_unique'
  | 'charm'
  | 'jewel'
  | 'unknown'

export interface RawItemStat {
  name: string
  value: number
  stat_id?: number
  corrupted?: number
  range?: {
    min: number
    max: number
  }
}

export interface RawClipboardItem {
  name?: string
  type: string
  iLevel?: number
  location?: string
  quality: string
  defense?: number
  quantity?: number
  corrupted?: boolean | number
  stats?: RawItemStat[]
}

export interface ParsedItem {
  name: string | null
  type: string
  iLevel: number
  location: string
  quality: string
  defense: number | null
  quantity: number | null
  displayName: string
  isCorrupted: boolean
  iconKey: string | null
  category: string
  analysisProfile: AnalysisProfile
  analysisTags: string[]
  stats: {
    statName: string
    statValue: number
    rangeMin: number | null
    rangeMax: number | null
    statId: number | null
    isCorrupted: boolean
  }[]
  fingerprint: string
  rawJson: string
}
