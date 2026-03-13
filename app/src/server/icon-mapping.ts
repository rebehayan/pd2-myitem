import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type MatchedBy = 'unique' | 'type' | 'family' | 'category' | 'generic'
type QualityFrame = 'normal' | 'magic' | 'rare' | 'set' | 'unique'

type FamilyMapEntry = {
  family: string
  category: string
  subtype: string
  normal?: string
  exceptional?: string
  elite?: string
}

const shouldLogIconMiss = process.env.ENABLE_ICON_MISS_LOG !== 'false'

const defaultTypeMap: Record<string, string> = {
  light_plated_boots: 'generic/item_unknown.svg',
  worldstone_shard: 'maps/Worldstone_Shard.webp',
  ohm_rune: 'rune/RuneOhm.webp',
  ring: 'rings/Ring_1.webp',
  반지: 'rings/Ring_1.webp',
  amulet: 'amulets/Amulet_1.webp',
  necklace: 'amulets/Amulet_1.webp',
  목걸이: 'amulets/Amulet_1.webp',
  jewel: 'charms_jewels/Jewel_blue.webp',
  small_charm: 'charms_jewels/Grand_Charm_2.webp',
  large_charm: 'charms_jewels/Grand_Charm_2.webp',
  grand_charm: 'charms_jewels/Grand_Charm_2.webp',
}

const categoryPreferredFolders: Record<string, string[]> = {
  weapon: ['weapons'],
  armor: ['non-weapons'],
  helm: ['non-weapons'],
  shield: ['non-weapons'],
  gloves: ['non-weapons'],
  boots: ['non-weapons'],
  belt: ['non-weapons'],
  charm: ['charms_jewels'],
  gem: ['charms_jewels'],
  jewel: ['charms_jewels'],
  map: ['maps'],
  material: ['maps'],
  rune: ['rune'],
  quiver: ['quivers'],
  consumable: ['generic'],
  quest: ['generic'],
  misc: ['generic'],
}

const defaultCategoryMap: Record<string, string> = {
  boots: 'generic/item_unknown.svg',
  weapon: 'weapons/Crystal_Sword.webp',
  armor: 'generic/item_unknown.svg',
  helm: 'generic/item_unknown.svg',
  shield: 'generic/item_unknown.svg',
  gloves: 'generic/item_unknown.svg',
  belt: 'generic/item_unknown.svg',
  jewelry: 'rings/Ring_1.webp',
  charm: 'charms_jewels/Grand_Charm_2.webp',
  material: 'maps/Worldstone_Shard.webp',
  rune: 'rune/RuneEl.webp',
  gem: 'charms_jewels/Jewel_blue.webp',
  jewel: 'charms_jewels/Jewel_blue.webp',
  map: 'maps/Map_Icon_City_of_Ureh.webp',
  consumable: 'generic/item_unknown.svg',
  quest: 'generic/item_unknown.svg',
  misc: 'generic/item_unknown.svg',
  quiver: 'quivers/Arrows.webp',
}

let cachedTypeMap: Record<string, string> | null = null
let cachedCategoryMap: Record<string, string> | null = null
let cachedUniqueMap: Record<string, string> | null = null
let cachedIconRootDir: string | null | undefined
let cachedIconPathByFileName: Record<string, string[]> | null = null
let cachedIconPathByStem: Record<string, string[]> | null = null
let cachedIconPathSet: Set<string> | null = null
let cachedFamilyByType: Record<string, FamilyMapEntry> | null = null

const defaultUniqueMap: Record<string, string> = {
  goblin_toe: 'goblin_toe.png',
  harlequin_crest: 'harlequin_crest.png',
  stormshield: 'stormshield.png',
}

const runeOrder = [
  'el',
  'eld',
  'tir',
  'nef',
  'eth',
  'ith',
  'tal',
  'ral',
  'ort',
  'thul',
  'amn',
  'sol',
  'shael',
  'dol',
  'hel',
  'io',
  'lum',
  'ko',
  'fal',
  'lem',
  'pul',
  'um',
  'mal',
  'ist',
  'gul',
  'vex',
  'ohm',
  'lo',
  'sur',
  'ber',
  'jah',
  'cham',
  'zod',
]

function toPosixPath(value: string): string {
  return value.replaceAll('\\', '/')
}

function resolveIconRootDir(): string | null {
  if (cachedIconRootDir !== undefined) {
    return cachedIconRootDir
  }

  const currentFileDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'public', 'icons'),
    path.resolve(currentFileDir, '..', '..', 'public', 'icons'),
  ]

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) {
        cachedIconRootDir = candidate
        return cachedIconRootDir
      }
    } catch {
      continue
    }
  }

  cachedIconRootDir = null
  return null
}

function buildIconPathByFileName(): Record<string, string[]> {
  if (cachedIconPathByFileName) {
    return cachedIconPathByFileName
  }

  const iconRootDir = resolveIconRootDir()
  if (!iconRootDir) {
    cachedIconPathByFileName = {}
    return cachedIconPathByFileName
  }

  const index: Record<string, string[]> = {}
  const indexByStem: Record<string, string[]> = {}
  const pathSet = new Set<string>()
  const dirsToVisit: string[] = ['']

  while (dirsToVisit.length > 0) {
    const relativeDir = dirsToVisit.pop()
    if (relativeDir === undefined) {
      continue
    }

    const absoluteDir = path.join(iconRootDir, relativeDir)
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const relativePath = toPosixPath(path.join(relativeDir, entry.name))
      if (entry.isDirectory()) {
        dirsToVisit.push(relativePath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const key = entry.name.toLowerCase()
      if (!index[key]) {
        index[key] = []
      }
      index[key].push(relativePath)

      const stem = path.parse(entry.name).name.toLowerCase()
      if (!indexByStem[stem]) {
        indexByStem[stem] = []
      }
      indexByStem[stem].push(relativePath)

      pathSet.add(relativePath.toLowerCase())
    }
  }

  for (const key of Object.keys(index)) {
    index[key].sort()
  }
  for (const key of Object.keys(indexByStem)) {
    indexByStem[key].sort()
  }

  cachedIconPathByFileName = index
  cachedIconPathByStem = indexByStem
  cachedIconPathSet = pathSet
  return cachedIconPathByFileName
}

function buildIconPathByStem(): Record<string, string[]> {
  if (cachedIconPathByStem) {
    return cachedIconPathByStem
  }
  buildIconPathByFileName()
  return cachedIconPathByStem ?? {}
}

function getIconPathSet(): Set<string> {
  if (cachedIconPathSet) {
    return cachedIconPathSet
  }
  buildIconPathByFileName()
  return cachedIconPathSet ?? new Set<string>()
}

function iconAssetExists(relativePath: string): boolean {
  return getIconPathSet().has(relativePath.toLowerCase())
}

function resolveIconAssetPath(relativePath: string): string {
  const normalizedRaw = toPosixPath(relativePath).trim().replace(/^\/+/, '').replace(/^icons\//i, '')
  const safeParts = normalizedRaw.split('/').filter((part) => part.length > 0)
  if (safeParts.some((part) => part === '.' || part === '..')) {
    return 'generic/item_unknown.svg'
  }

  const normalized = safeParts.join('/')
  if (normalized.length === 0) {
    return 'generic/item_unknown.svg'
  }

  if (iconAssetExists(normalized)) {
    return normalized
  }

  const fileName = path.basename(normalized).toLowerCase()
  const fileNameMatch = buildIconPathByFileName()[fileName]?.[0]
  if (fileNameMatch) {
    return fileNameMatch
  }

  const stem = path.parse(fileName).name.toLowerCase()
  const stemMatch = buildIconPathByStem()[stem]?.[0]
  if (stemMatch) {
    return stemMatch
  }

  return 'generic/item_unknown.svg'
}

function normalizePathMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  const entries = Object.entries(raw as Record<string, unknown>)
  const validEntries = entries.filter((entry): entry is [string, string] => {
    return typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].trim().length > 0
  })
  const trimmedEntries = validEntries.map(([key, value]) => [key, value.trim()] as const)
  return Object.fromEntries(trimmedEntries)
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

function normalizeFamilyEntry(raw: unknown): FamilyMapEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const entry = raw as Partial<FamilyMapEntry>
  if (!entry.family || !entry.category || !entry.subtype) {
    return null
  }

  return {
    family: String(entry.family).trim(),
    category: String(entry.category).trim(),
    subtype: String(entry.subtype).trim(),
    normal: entry.normal ? String(entry.normal).trim() : undefined,
    exceptional: entry.exceptional ? String(entry.exceptional).trim() : undefined,
    elite: entry.elite ? String(entry.elite).trim() : undefined,
  }
}

function readFamilyMapFromJson(fileName: string): FamilyMapEntry[] {
  const currentFileDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(process.cwd(), 'data', fileName),
    path.resolve(currentFileDir, '..', '..', 'data', fileName),
  ]

  for (const filePath of candidates) {
    try {
      const rawText = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(rawText) as unknown
      if (!Array.isArray(parsed)) {
        continue
      }
      const normalized = parsed.map(normalizeFamilyEntry).filter((entry): entry is FamilyMapEntry => Boolean(entry))
      if (normalized.length > 0) {
        return normalized
      }
    } catch {
      continue
    }
  }

  return []
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

function buildFamilyByType(): Record<string, FamilyMapEntry> {
  if (cachedFamilyByType) {
    return cachedFamilyByType
  }

  const entries = [...readFamilyMapFromJson('armor-family-map.json'), ...readFamilyMapFromJson('weapon-family-map.json')]
  const byType: Record<string, FamilyMapEntry> = {}

  for (const entry of entries) {
    const typeNames = [entry.normal, entry.exceptional, entry.elite]
    for (const typeName of typeNames) {
      if (!typeName) {
        continue
      }
      byType[normalizeTypeKey(typeName)] = entry
    }
  }

  cachedFamilyByType = byType
  return cachedFamilyByType
}

function normalizeStemKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[/',()-]/g, ' ')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
}

function resolveRuneKeyFromText(text: string): string | null {
  const normalized = normalizeTypeKey(text)
  if (!normalized) {
    return null
  }
  const stripped = normalized.replace(/^rune_/, '').replace(/_rune$/, '')
  if (runeOrder.includes(stripped)) {
    return stripped
  }
  const parts = stripped.split('_')
  for (const part of parts) {
    if (runeOrder.includes(part)) {
      return part
    }
  }
  const runeCodeMatch = stripped.match(/(?:^|_)(?:r|rune)_?(\d{1,2})(?:_|$)/)
  if (runeCodeMatch?.[1]) {
    const index = Number(runeCodeMatch[1])
    if (Number.isFinite(index) && index >= 1 && index <= runeOrder.length) {
      return runeOrder[index - 1] ?? null
    }
  }
  return null
}

function formatRuneFileName(runeKey: string): string {
  return `rune/Rune${runeKey.charAt(0).toUpperCase()}${runeKey.slice(1)}.webp`
}

function resolveIconByStemCandidates(candidates: string[], preferredFolders: string[] = []): string | null {
  const index = buildIconPathByStem()
  const tried = new Set<string>()

  const getFolderName = (iconPath: string): string => {
    const firstSlash = iconPath.indexOf('/')
    if (firstSlash < 0) {
      return iconPath.toLowerCase()
    }
    return iconPath.slice(0, firstSlash).toLowerCase()
  }

  const pickByPreferredFolder = (matches: string[], preferredFolders: string[]): string | null => {
    if (matches.length === 0) {
      return null
    }
    if (preferredFolders.length === 0) {
      return matches[0] ?? null
    }

    const normalizedFolders = preferredFolders.map((folder) => folder.toLowerCase())
    for (const folder of normalizedFolders) {
      const inFolder = matches.find((match) => getFolderName(match) === folder)
      if (inFolder) {
        return inFolder
      }
    }

    return matches[0] ?? null
  }

  const resolveWithPreferredFolders = (key: string, preferredFolders: string[]): string | null => {
    const matches = index[key]
    if (!matches || matches.length === 0) {
      return null
    }
    return pickByPreferredFolder(matches, preferredFolders)
  }

  for (const candidate of candidates) {
    const raw = candidate.trim().toLowerCase()
    const normalized = normalizeStemKey(candidate)
    for (const key of [raw, normalized]) {
      if (!key || tried.has(key)) {
        continue
      }
      tried.add(key)
      const match = resolveWithPreferredFolders(key, preferredFolders)
      if (match) {
        return match
      }
    }
  }

  return null
}

function getPreferredIconFolders(args: { baseType: string; itemName: string | null; category: string }): string[] {
  if (args.category === 'jewelry') {
    const normalizedType = normalizeTypeKey(args.baseType)
    const normalizedName = args.itemName ? normalizeTypeKey(args.itemName) : ''
    const combined = `${normalizedType}_${normalizedName}`

    if (combined.includes('amulet') || combined.includes('necklace') || combined.includes('목걸이')) {
      return ['amulets', 'rings']
    }
    if (combined.includes('ring') || combined.includes('반지')) {
      return ['rings', 'amulets']
    }
    return ['rings', 'amulets']
  }

  return categoryPreferredFolders[args.category] ?? []
}

function getFamilyRepresentativeName(entry: FamilyMapEntry): string | null {
  if (entry.normal) {
    return entry.normal
  }
  if (entry.exceptional) {
    return entry.exceptional
  }
  if (entry.elite) {
    return entry.elite
  }
  return null
}

const categoryKeywordRules: Array<{ category: string; keywords: string[] }> = [
  { category: 'boots', keywords: ['boots', 'greaves'] },
  { category: 'gloves', keywords: ['gloves', 'gauntlets'] },
  { category: 'helm', keywords: ['helm', 'crown', 'mask', 'circlet'] },
  { category: 'shield', keywords: ['shield', 'aegis'] },
  { category: 'belt', keywords: ['belt', 'sash'] },
  { category: 'jewelry', keywords: ['ring', '반지', 'amulet', 'necklace', '목걸이'] },
  { category: 'charm', keywords: ['charm'] },
  { category: 'material', keywords: ['shard', 'essence', 'material', 'orb', 'scarab'] },
  { category: 'rune', keywords: ['rune'] },
  { category: 'gem', keywords: ['gem', 'skull'] },
  { category: 'jewel', keywords: ['jewel'] },
  { category: 'map', keywords: ['map'] },
  { category: 'quiver', keywords: ['quiver', 'arrow', 'bolt'] },
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
  const runeKey = resolveRuneKeyFromText(args.baseType) ?? (args.itemName ? resolveRuneKeyFromText(args.itemName) : null)
  const category = runeKey ? 'rune' : inferCategory(args.baseType)
  const preferredFolders = getPreferredIconFolders({ baseType: args.baseType, itemName: args.itemName, category })
  const qualityFrame = toQualityFrame(args.quality)
  const normalizedUniqueName = args.itemName ? normalizeUniqueNameKey(args.itemName) : ''

  if (runeKey) {
    return {
      iconPath: resolveIconAssetPath(formatRuneFileName(runeKey)),
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

  if (qualityFrame === 'unique' && normalizedUniqueName) {
    const uniqueImage = getUniqueImageMap()[normalizedUniqueName]
    if (uniqueImage) {
      return {
        iconPath: resolveIconAssetPath(uniqueImage),
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

  const pd2BaseIcon = resolveIconByStemCandidates([args.baseType], preferredFolders)
  if (pd2BaseIcon) {
    return {
      iconPath: pd2BaseIcon,
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

  const familyEntry = buildFamilyByType()[normalizedType]
  if (familyEntry) {
    const representative = getFamilyRepresentativeName(familyEntry)
    if (representative) {
      const familyIcon = resolveIconByStemCandidates([representative], preferredFolders)
      if (familyIcon) {
        return {
          iconPath: familyIcon,
          iconKey: normalizedType,
          category,
          matchedBy: 'family',
          qualityFrame,
          badges: {
            corrupted: args.isCorrupted,
            quantity: args.quantity !== null,
          },
        }
      }
    }
  }

  const exact = getExactTypeMap()[normalizedType]

  if (exact) {
    return {
      iconPath: resolveIconAssetPath(exact),
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
      iconPath: resolveIconAssetPath(byCategory),
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
    iconPath: resolveIconAssetPath('generic/item_unknown.svg'),
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
