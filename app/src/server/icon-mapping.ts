import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type MatchedBy = 'unique' | 'type' | 'category' | 'generic'
type QualityFrame = 'normal' | 'magic' | 'rare' | 'set' | 'unique'

const shouldLogIconMiss = process.env.ENABLE_ICON_MISS_LOG !== 'false'

const defaultTypeMap: Record<string, string> = {
  light_plated_boots: 'boots/light_plated_boots.png',
  worldstone_shard: 'material/worldstone_shard.png',
  ring: 'jewelry/ring.png',
  amulet: 'jewelry/amulet.png',
  small_charm: 'charm/small_charm.png',
  large_charm: 'charm/large_charm.png',
  grand_charm: 'charm/grand_charm.png',
}

const defaultCategoryMap: Record<string, string> = {
  boots: 'generic/boots.png',
  weapon: 'generic/weapon.png',
  armor: 'generic/armor.png',
  helm: 'generic/helm.png',
  shield: 'generic/shield.png',
  gloves: 'generic/gloves.png',
  belt: 'generic/belt.png',
  jewelry: 'generic/jewelry.png',
  charm: 'generic/charm.png',
  material: 'generic/material.png',
  rune: 'generic/rune.png',
  gem: 'generic/gem.png',
  jewel: 'generic/jewel.png',
  map: 'generic/map.png',
  consumable: 'generic/consumable.png',
  quest: 'generic/quest.png',
  misc: 'generic/misc.png',
}

let cachedTypeMap: Record<string, string> | null = null
let cachedCategoryMap: Record<string, string> | null = null
let cachedUniqueMap: Record<string, string> | null = null

const defaultUniqueMap: Record<string, string> = {
  goblin_toe: 'goblin_toe.png',
  harlequin_crest: 'harlequin_crest.png',
  stormshield: 'stormshield.png',
}

function normalizePathMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  const entries = Object.entries(raw as Record<string, unknown>)
  const validEntries = entries.filter((entry): entry is [string, string] => {
    return typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].trim().length > 0
  })
  return Object.fromEntries(validEntries)
}

function normalizeExactTypeMap(raw: unknown): Record<string, string> {
  const normalized = normalizePathMap(raw)
  const entries = Object.entries(normalized).map(([key, value]) => [normalizeTypeKey(key), value] as const)
  return Object.fromEntries(entries)
}

function normalizeCategoryMap(raw: unknown): Record<string, string> {
  const normalized = normalizePathMap(raw)
  const entries = Object.entries(normalized).map(([key, value]) => [key.trim().toLowerCase(), value] as const)
  return Object.fromEntries(entries)
}

function normalizeUniqueNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, ' ')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
}

function normalizeUniqueMap(raw: unknown): Record<string, string> {
  const normalized = normalizePathMap(raw)
  const entries = Object.entries(normalized).map(([key, value]) => {
    const normalizedKey = normalizeUniqueNameKey(key)
    return [normalizedKey, value] as const
  })
  return Object.fromEntries(entries)
}

function readMapFromJson(fileName: string): Record<string, string> | null {
  const currentFileDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'src', 'data', fileName),
    path.resolve(currentFileDir, '..', 'data', fileName),
  ]

  for (const filePath of candidates) {
    try {
      const rawText = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(rawText) as unknown
      return normalizePathMap(parsed)
    } catch {
      continue
    }
  }
  return null
}

function getExactTypeMap(): Record<string, string> {
  if (cachedTypeMap) {
    return cachedTypeMap
  }
  cachedTypeMap = normalizeExactTypeMap(readMapFromJson('icon-map.json') ?? defaultTypeMap)
  return cachedTypeMap
}

function getCategoryFallbackMap(): Record<string, string> {
  if (cachedCategoryMap) {
    return cachedCategoryMap
  }
  cachedCategoryMap = normalizeCategoryMap(readMapFromJson('category-icon-map.json') ?? defaultCategoryMap)
  return cachedCategoryMap
}

function getUniqueImageMap(): Record<string, string> {
  if (cachedUniqueMap) {
    return cachedUniqueMap
  }
  cachedUniqueMap = normalizeUniqueMap(readMapFromJson('unique-image-map.json') ?? defaultUniqueMap)
  return cachedUniqueMap
}

const categoryKeywordRules: Array<{ category: string; keywords: string[] }> = [
  { category: 'boots', keywords: ['boots', 'greaves'] },
  { category: 'gloves', keywords: ['gloves', 'gauntlets'] },
  { category: 'helm', keywords: ['helm', 'crown', 'mask', 'circlet'] },
  { category: 'shield', keywords: ['shield', 'aegis'] },
  { category: 'belt', keywords: ['belt', 'sash'] },
  { category: 'jewelry', keywords: ['ring', 'amulet'] },
  { category: 'charm', keywords: ['charm'] },
  { category: 'material', keywords: ['shard', 'essence', 'material'] },
  { category: 'rune', keywords: ['rune'] },
  { category: 'gem', keywords: ['gem', 'skull'] },
  { category: 'jewel', keywords: ['jewel'] },
  { category: 'map', keywords: ['map'] },
  { category: 'armor', keywords: ['armor', 'mail', 'plate'] },
  { category: 'weapon', keywords: ['sword', 'axe', 'mace', 'bow', 'staff', 'wand', 'dagger', 'spear'] },
]

function toQualityFrame(quality: string): QualityFrame {
  const normalized = quality.trim().toLowerCase()
  if (normalized === 'magic') {
    return 'magic'
  }
  if (normalized === 'rare') {
    return 'rare'
  }
  if (normalized === 'set') {
    return 'set'
  }
  if (normalized === 'unique') {
    return 'unique'
  }
  return 'normal'
}

export function normalizeTypeKey(baseType: string): string {
  return baseType
    .trim()
    .toLowerCase()
    .replaceAll(/[/',()-]/g, '_')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
}

export function inferCategory(baseType: string): string {
  const normalizedType = normalizeTypeKey(baseType)

  for (const rule of categoryKeywordRules) {
    if (rule.keywords.some((keyword) => normalizedType.includes(keyword))) {
      return rule.category
    }
  }

  return 'unknown'
}

export interface ThumbnailResolveResult {
  iconPath: string
  iconKey: string
  category: string
  matchedBy: MatchedBy
  qualityFrame: QualityFrame
  badges: {
    corrupted: boolean
    quantity: boolean
  }
}

export function resolveThumbnail(args: {
  baseType: string
  itemName: string | null
  quality: string
  quantity: number | null
  isCorrupted: boolean
}): ThumbnailResolveResult {
  const normalizedType = normalizeTypeKey(args.baseType)
  const category = inferCategory(args.baseType)
  const qualityFrame = toQualityFrame(args.quality)
  const normalizedUniqueName = args.itemName ? normalizeUniqueNameKey(args.itemName) : ''

  if (qualityFrame === 'unique' && normalizedUniqueName) {
    const uniqueImage = getUniqueImageMap()[normalizedUniqueName]
    if (uniqueImage) {
      return {
        iconPath: uniqueImage,
        iconKey: normalizedType,
        category,
        matchedBy: 'unique',
        qualityFrame,
        badges: {
          corrupted: args.isCorrupted,
          quantity: args.quantity !== null,
        },
      }
    }
    if (shouldLogIconMiss) {
      console.log(`[unique-image-miss] name="${args.itemName}"`)
    }
  }

  const exact = getExactTypeMap()[normalizedType]

  if (exact) {
    return {
      iconPath: exact,
      iconKey: normalizedType,
      category,
      matchedBy: 'type',
      qualityFrame,
      badges: {
        corrupted: args.isCorrupted,
        quantity: args.quantity !== null,
      },
    }
  }

  const byCategory = getCategoryFallbackMap()[category]
  if (byCategory) {
    if (shouldLogIconMiss) {
      console.log(`[icon-miss] type="${args.baseType}" category="${category}"`)
    }
    return {
      iconPath: byCategory,
      iconKey: normalizedType,
      category,
      matchedBy: 'category',
      qualityFrame,
      badges: {
        corrupted: args.isCorrupted,
        quantity: args.quantity !== null,
      },
    }
  }

  if (shouldLogIconMiss) {
    console.log(`[icon-miss] type="${args.baseType}" category="${category}"`)
  }
  return {
    iconPath: 'generic/item_unknown.png',
    iconKey: normalizedType,
    category,
    matchedBy: 'generic',
    qualityFrame,
    badges: {
      corrupted: args.isCorrupted,
      quantity: args.quantity !== null,
    },
  }
}
