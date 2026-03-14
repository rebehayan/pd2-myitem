import uniqueImageMap from '../data/unique-image-map.json'
import iconMap from '../data/icon-map.json'
import categoryIconMap from '../data/category-icon-map.json'

type ResolveLocalThumbnailArgs = {
  name: string | null
  type: string
  quality: string
  category: string
  existingThumbnail?: string | null
}

const uniqueImageRecord = uniqueImageMap as Record<string, string>
const exactIconMap = iconMap as Record<string, string>
const fallbackCategoryIconMap = categoryIconMap as Record<string, string>

const localCategoryFallbackDefaults: Record<string, string> = {
  boots: 'non-weapons/Boots.webp',
  weapon: 'weapons/Crystal_Sword.webp',
  armor: 'non-weapons/Quilted_Armor.webp',
  helm: 'non-weapons/Great_Helm.webp',
  shield: 'non-weapons/Aerin_Shield.webp',
  gloves: 'non-weapons/Gauntlets.webp',
  belt: 'non-weapons/Belt.webp',
  jewelry: 'rings/Ring_1.webp',
  charm: 'charms_jewels/Grand_Charm_2.webp',
  material: 'maps/Worldstone_Shard.webp',
  rune: 'rune/RuneEl.webp',
  gem: 'charms_jewels/Jewel_blue.webp',
  jewel: 'charms_jewels/Jewel_blue.webp',
  map: 'maps/Map_Icon_City_of_Ureh.webp',
  quiver: 'quivers/Arrows.webp',
  misc: 'non-weapons/Quilted_Armor.webp',
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

let normalizedUniqueMapCache: Record<string, string> | null = null

function normalizeUniqueNameKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, ' ')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
}

function normalizeTypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[/',()-]/g, '_')
    .replaceAll(/\s+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
}

function getNormalizedUniqueMap(): Record<string, string> {
  if (normalizedUniqueMapCache) {
    return normalizedUniqueMapCache
  }

  const entries = Object.entries(uniqueImageRecord).map(([key, value]) => [normalizeUniqueNameKey(key), value] as const)
  normalizedUniqueMapCache = Object.fromEntries(entries)
  return normalizedUniqueMapCache
}

function normalizeThumbnailPath(path: string | null | undefined): string | null {
  if (!path) {
    return null
  }
  const trimmed = path.trim()
  if (!trimmed) {
    return null
  }
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || lower.startsWith('blob:')) {
    return trimmed
  }
  if (lower.startsWith('/icons/')) {
    return trimmed
  }
  if (lower.startsWith('icons/')) {
    return `/${trimmed}`
  }
  if (lower.startsWith('./icons/')) {
    return `/${trimmed.slice(2)}`
  }
  if (lower.includes('/icons/')) {
    const index = lower.indexOf('/icons/')
    return trimmed.slice(index)
  }
  return `/icons/${trimmed.replace(/^\/+/, '')}`
}

function toIconPath(path: string): string {
  return normalizeThumbnailPath(path) ?? '/icons/non-weapons/Quilted_Armor.webp'
}

function inferCategory(type: string, quantity: number | null): string {
  const normalized = type.trim().toLowerCase()

  if (normalized.includes('rune') || normalized.includes('룬')) {
    return 'rune'
  }
  if (normalized.includes('map') || normalized.includes('shard') || normalized.includes('맵') || normalized.includes('파편')) {
    return 'map'
  }
  if (quantity !== null && quantity > 1) {
    return 'material'
  }
  if (normalized.includes('ring') || normalized.includes('반지')) {
    return 'jewelry'
  }
  if (normalized.includes('amulet') || normalized.includes('necklace') || normalized.includes('목걸이')) {
    return 'jewelry'
  }
  if (normalized.includes('charm')) {
    return 'charm'
  }
  if (normalized.includes('jewel')) {
    return 'jewel'
  }
  if (normalized.includes('quiver') || normalized.includes('arrow') || normalized.includes('bolt')) {
    return 'quiver'
  }
  if (
    normalized.includes('boots') ||
    normalized.includes('greaves') ||
    normalized.includes('shoes') ||
    normalized.includes('sabatons')
  ) {
    return 'boots'
  }
  if (normalized.includes('glove') || normalized.includes('gauntlet') || normalized.includes('mitts') || normalized.includes('bracers')) {
    return 'gloves'
  }
  if (normalized.includes('belt') || normalized.includes('sash') || normalized.includes('girdle')) {
    return 'belt'
  }
  if (normalized.includes('helm') || normalized.includes('mask') || normalized.includes('circlet') || normalized.includes('crown')) {
    return 'helm'
  }
  if (normalized.includes('shield') || normalized.includes('rondache') || normalized.includes('totem')) {
    return 'shield'
  }
  if (
    normalized.includes('armor') ||
    normalized.includes('mail') ||
    normalized.includes('plate') ||
    normalized.includes('robe') ||
    normalized.includes('leather')
  ) {
    return 'armor'
  }
  if (
    normalized.includes('sword') ||
    normalized.includes('axe') ||
    normalized.includes('mace') ||
    normalized.includes('scepter') ||
    normalized.includes('club') ||
    normalized.includes('bow') ||
    normalized.includes('crossbow') ||
    normalized.includes('orb') ||
    normalized.includes('staff') ||
    normalized.includes('polearm') ||
    normalized.includes('javelin') ||
    normalized.includes('claw') ||
    normalized.includes('katar') ||
    normalized.includes('cestus') ||
    normalized.includes('blade') ||
    normalized.includes('talons') ||
    normalized.includes('spear') ||
    normalized.includes('wand') ||
    normalized.includes('dagger')
  ) {
    return 'weapon'
  }
  return 'misc'
}

function isGenericUnknown(path: string): boolean {
  const normalized = path.trim().replace(/^\/+/, '').toLowerCase()
  return normalized === 'icons/generic/item_unknown.svg' || normalized === 'generic/item_unknown.svg'
}

function hasKnownIconFolder(path: string): boolean {
  const normalized = path.trim().replace(/^\/+/, '').replace(/^icons\//i, '')
  const firstSlash = normalized.indexOf('/')
  if (firstSlash < 0) {
    return false
  }
  const folder = normalized.slice(0, firstSlash).toLowerCase()
  return [
    'amulets',
    'rings',
    'maps',
    'rune',
    'charms_jewels',
    'non-weapons',
    'weapons',
    'quivers',
    'generic',
  ].includes(folder)
}

function resolveRuneKey(type: string, name: string | null): string | null {
  const merged = `${normalizeTypeKey(type)}_${name ? normalizeTypeKey(name) : ''}`
  for (const rune of runeOrder) {
    if (merged.includes(`_${rune}_`) || merged.startsWith(`${rune}_`) || merged.endsWith(`_${rune}`) || merged === rune) {
      return rune
    }
  }

  const indexMatch = merged.match(/(?:^|_)(?:r|rune)_?(\d{1,2})(?:_|$)/)
  if (indexMatch?.[1]) {
    const idx = Number(indexMatch[1])
    if (Number.isInteger(idx) && idx >= 1 && idx <= runeOrder.length) {
      return runeOrder[idx - 1] ?? null
    }
  }
  return null
}

function formatRunePath(rune: string): string {
  return `rune/Rune${rune.charAt(0).toUpperCase()}${rune.slice(1)}.webp`
}

function resolveUniqueMappedPath(mapped: string, type: string, category: string): string {
  const trimmed = mapped.trim().replace(/^\/+/, '').replace(/^icons\//i, '')
  if (trimmed.includes('/')) {
    return trimmed
  }

  const normalizedType = normalizeTypeKey(type)
  if (normalizedType.includes('ring') || normalizedType.includes('반지')) {
    return `rings/${trimmed}`
  }
  if (normalizedType.includes('amulet') || normalizedType.includes('necklace') || normalizedType.includes('목걸이')) {
    return `amulets/${trimmed}`
  }
  if (category === 'jewelry') {
    return `rings/${trimmed}`
  }
  if (category === 'charm' || category === 'jewel') {
    return `charms_jewels/${trimmed}`
  }
  if (category === 'rune') {
    return `rune/${trimmed}`
  }
  if (category === 'map' || category === 'material') {
    return `maps/${trimmed}`
  }
  return `weapons/${trimmed}`
}

export function resolveLocalThumbnailPath(args: ResolveLocalThumbnailArgs): string {
  const existing = normalizeThumbnailPath(args.existingThumbnail)
  const isRootIconFile = existing ? /^\/icons\/[^/]+\.[a-z0-9]+$/i.test(existing) : false
  const isAbsolute = existing
    ? existing.startsWith('http://') || existing.startsWith('https://') || existing.startsWith('data:') || existing.startsWith('blob:')
    : false
  if (existing && isAbsolute) {
    return existing
  }
  if (existing && !existing.endsWith('/icons/generic/item_unknown.svg') && !isRootIconFile && hasKnownIconFolder(existing)) {
    return existing
  }

  const name = args.name?.trim() ?? ''
  const quality = args.quality.trim().toLowerCase()
  const category = args.category || inferCategory(args.type, null)

  const runeKey = resolveRuneKey(args.type, name || null)
  if (runeKey) {
    return toIconPath(formatRunePath(runeKey))
  }

  if (quality === 'unique' && name) {
    const mapped = getNormalizedUniqueMap()[normalizeUniqueNameKey(name)]
    if (mapped) {
      return toIconPath(resolveUniqueMappedPath(mapped, args.type, category))
    }
  }

  const normalizedType = normalizeTypeKey(args.type)

  const exactMapped = exactIconMap[normalizedType]
  if (exactMapped && !isGenericUnknown(exactMapped)) {
    return toIconPath(exactMapped)
  }

  if (normalizedType.includes('map') || normalizedType.includes('shard') || normalizedType.includes('맵') || normalizedType.includes('파편')) {
    return '/icons/maps/Worldstone_Shard.webp'
  }
  if (normalizedType.includes('ring') || normalizedType.includes('반지')) {
    return '/icons/rings/Ring_1.webp'
  }
  if (normalizedType.includes('amulet') || normalizedType.includes('necklace') || normalizedType.includes('목걸이')) {
    return '/icons/amulets/Amulet_1.webp'
  }
  if (normalizedType.includes('jewel')) {
    return '/icons/charms_jewels/Jewel_blue.webp'
  }
  if (normalizedType.includes('charm')) {
    return '/icons/charms_jewels/Grand_Charm_2.webp'
  }

  if (category === 'rune') {
    return '/icons/rune/RuneEl.webp'
  }
  if (category === 'map' || category === 'material') {
    return '/icons/maps/Worldstone_Shard.webp'
  }
  if (category === 'jewelry') {
    return '/icons/rings/Ring_1.webp'
  }
  if (category === 'charm') {
    return '/icons/charms_jewels/Grand_Charm_2.webp'
  }
  if (category === 'jewel') {
    return '/icons/charms_jewels/Jewel_blue.webp'
  }

  const categoryMapped = fallbackCategoryIconMap[category] ?? localCategoryFallbackDefaults[category]
  if (categoryMapped && !isGenericUnknown(categoryMapped)) {
    return toIconPath(categoryMapped)
  }

  const fallbackDefault = localCategoryFallbackDefaults[category]
  if (fallbackDefault) {
    return toIconPath(fallbackDefault)
  }

  return '/icons/non-weapons/Quilted_Armor.webp'
}
