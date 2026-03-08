export type ItemStatTone = 'skill' | 'res' | 'base' | 'default'

const skillKeywords = ['skill', 'skills', 'aura', 'auras']
const baseKeywords = ['strength', 'dexterity', 'vitality', 'energy']
const resKeywords = ['resist', 'resistance']

export function getStatToneClass(statName: string): string {
  const name = statName.trim().toLowerCase()
  if (!name) {
    return ''
  }

  if (resKeywords.some((keyword) => name.includes(keyword))) {
    return ' item-stat-res'
  }

  if (baseKeywords.some((keyword) => name.includes(keyword))) {
    return ' item-stat-base'
  }

  if (skillKeywords.some((keyword) => name.includes(keyword))) {
    return ' item-stat-skill'
  }

  return ''
}
