import type { CSSProperties } from 'react'
import filterRules from '../data/filter-rules.json'
import filterTheme from '../data/filter-theme.json'

export interface ItemThemeInput {
  displayName: string
  type: string
  quality: string
  category?: string
  isCorrupted?: boolean
  quantity?: number | null
  analysisProfile?: string
  analysisTags?: string[]
  stats?: Array<{ statName: string }>
}

interface FilterRuleMatch {
  qualities?: string[]
  categories?: string[]
  profiles?: string[]
  tagsAny?: string[]
  tagsAll?: string[]
  nameIncludes?: string[]
  typeIncludes?: string[]
  statIncludes?: string[]
  corrupted?: boolean
}

interface FilterRule {
  id: string
  label: string
  priority: number
  theme: string
  match: FilterRuleMatch
}

export interface ItemThemeTokens {
  name: string
  accent: string
  text: string
  border: string
  background: string
  badgeBg: string
  badgeText: string
  glow: string
}

export interface ResolvedItemTheme {
  rule: FilterRule
  theme: ItemThemeTokens
  style: CSSProperties
}

const rules = (filterRules.rules as FilterRule[]).slice().sort((left, right) => right.priority - left.priority)
const themeMap = filterTheme.themes as Record<string, ItemThemeTokens>

const normalize = (value: string | undefined | null): string => (value ?? '').trim().toLowerCase()

function includesAny(haystack: string, needles: string[]): boolean {
  if (!haystack) {
    return false
  }
  return needles.some((needle) => needle && haystack.includes(needle))
}

function listIncludes(list: string[], targets: string[]): boolean {
  if (targets.length === 0) {
    return true
  }
  const normalized = new Set(list.map((entry) => normalize(entry)))
  return targets.some((entry) => normalized.has(normalize(entry)))
}

function listIncludesAll(list: string[], targets: string[]): boolean {
  if (targets.length === 0) {
    return true
  }
  const normalized = new Set(list.map((entry) => normalize(entry)))
  return targets.every((entry) => normalized.has(normalize(entry)))
}

function matchRule(item: ItemThemeInput, rule: FilterRule): boolean {
  const match = rule.match
  const quality = normalize(item.quality)
  const category = normalize(item.category)
  const profile = normalize(item.analysisProfile)
  const tags = (item.analysisTags ?? []).map(normalize)
  const nameStack = `${item.displayName} ${item.type}`.toLowerCase()
  const typeStack = normalize(item.type)
  const statNames = (item.stats ?? []).map((stat) => stat.statName.toLowerCase())

  if (match.qualities && !listIncludes([quality], match.qualities)) {
    return false
  }
  if (match.categories && !listIncludes([category], match.categories)) {
    return false
  }
  if (match.profiles && !listIncludes([profile], match.profiles)) {
    return false
  }
  if (match.tagsAny && !listIncludes(tags, match.tagsAny)) {
    return false
  }
  if (match.tagsAll && !listIncludesAll(tags, match.tagsAll)) {
    return false
  }
  if (match.nameIncludes && !includesAny(nameStack, match.nameIncludes.map(normalize))) {
    return false
  }
  if (match.typeIncludes && !includesAny(typeStack, match.typeIncludes.map(normalize))) {
    return false
  }
  if (match.statIncludes) {
    if (statNames.length === 0) {
      return false
    }
    const normalizedNeedles = match.statIncludes.map(normalize)
    const matched = statNames.some((stat) => includesAny(stat, normalizedNeedles))
    if (!matched) {
      return false
    }
  }
  if (match.corrupted !== undefined && Boolean(item.isCorrupted) !== match.corrupted) {
    return false
  }

  return true
}

function toThemeStyle(theme: ItemThemeTokens): CSSProperties {
  return {
    '--item-theme-accent': theme.accent,
    '--item-theme-text': theme.text,
    '--item-theme-border': theme.border,
    '--item-theme-bg': theme.background,
    '--item-theme-badge-bg': theme.badgeBg,
    '--item-theme-badge-text': theme.badgeText,
    '--item-theme-glow': theme.glow,
  }
}

export function resolveItemTheme(item: ItemThemeInput): ResolvedItemTheme {
  const matched = rules.find((rule) => matchRule(item, rule)) ?? rules[rules.length - 1]
  const theme = themeMap[matched.theme] ?? themeMap.default
  return {
    rule: matched,
    theme,
    style: toThemeStyle(theme),
  }
}
