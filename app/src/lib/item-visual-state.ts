import type { ItemStat } from './types'

function parseSocketCountFromTag(tags: string[]): number | null {
  for (const tag of tags) {
    const matched = /^sockets:(\d+)$/i.exec(tag.trim())
    if (!matched) {
      continue
    }
    const parsed = Number(matched[1])
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed
    }
  }
  return null
}

function parseSocketCountFromStats(stats: ItemStat[]): number | null {
  for (const stat of stats) {
    const text = stat.statName.trim()
    const matched = text.match(/(?:socketed\s*\(?|\()\s*(\d+)\s*sockets?\)?/i)
    if (!matched) {
      continue
    }
    const parsed = Number(matched[1])
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed
    }
  }
  return null
}

export function getItemVisualState(input: { analysisTags?: string[]; stats?: ItemStat[] }) {
  const tags = input.analysisTags ?? []
  const stats = input.stats ?? []
  const socketCountFromTag = parseSocketCountFromTag(tags)
  const socketCountFromStats = parseSocketCountFromStats(stats)
  const socketCount = socketCountFromTag ?? socketCountFromStats
  const hasEtherealTag = tags.some((tag) => tag.trim().toLowerCase() === 'ethereal')
  const hasEtherealStat = stats.some((stat) => stat.statName.trim().toLowerCase().includes('ethereal'))

  return {
    isEthereal: hasEtherealTag || hasEtherealStat,
    socketCount,
  }
}
