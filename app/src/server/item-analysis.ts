import type { AnalysisProfile, RawClipboardItem } from './types'

interface AnalyzedStat {
  range?: {
    min: number
    max: number
  }
  corrupted?: number
  name: string
}

export interface ItemAnalysis {
  profile: AnalysisProfile
  tags: string[]
}

function hasCorruptedStat(stats: AnalyzedStat[]): boolean {
  return stats.some((stat) => stat.corrupted === 1 || stat.name.trim().toLowerCase() === 'corrupt')
}

export function analyzeBySampleCases(item: RawClipboardItem): ItemAnalysis {
  const quality = item.quality.trim().toLowerCase()
  const baseType = item.type.trim().toLowerCase()
  const stats = (item.stats ?? []) as AnalyzedStat[]
  const hasQuantity = item.quantity !== undefined
  const isCorrupted = hasCorruptedStat(stats) || item.corrupted === true || item.corrupted === 1

  const tags = new Set<string>()
  tags.add(`quality:${quality}`)
  tags.add(item.name ? 'named' : 'unnamed')
  if (hasQuantity) {
    tags.add('stack')
  }
  if (stats.length > 0) {
    tags.add('has_stats')
  }
  if (stats.some((stat) => stat.range !== undefined)) {
    tags.add('has_range_stat')
  }
  if (isCorrupted) {
    tags.add('corrupted')
  }

  let profile: AnalysisProfile = 'unknown'

  if (quality === 'normal' && hasQuantity) {
    profile = 'normal_material'
  } else if (quality === 'normal' && baseType.includes('rune')) {
    profile = 'normal_rune'
  } else if (quality === 'magic' && baseType.includes('charm')) {
    profile = 'charm'
  } else if (quality === 'magic') {
    profile = 'magic_item'
  } else if (quality === 'rare' && baseType === 'jewel') {
    profile = 'jewel'
  } else if (quality === 'rare') {
    profile = 'rare_item'
  } else if (quality === 'unique' && isCorrupted) {
    profile = 'corrupted_unique'
  } else if (quality === 'unique') {
    profile = 'unique_item'
  }

  tags.add(`profile:${profile}`)
  return {
    profile,
    tags: Array.from(tags),
  }
}
