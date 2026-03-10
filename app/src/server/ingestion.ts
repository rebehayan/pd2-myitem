import { createHash } from 'node:crypto'
import { z } from 'zod'
import { saveParsedItem } from './repository'
import { resolveThumbnail } from './icon-mapping'
import { analyzeBySampleCases } from './item-analysis'
import type { ParsedItem, RawClipboardItem } from './types'
import type { SaveParsedItemResult } from './repository'

const statSchema = z.object({
  name: z.string().min(1),
  value: z.number().optional(),
  stat_id: z.number().int().optional(),
  corrupted: z.number().int().optional(),
  chance: z.number().int().optional(),
  level: z.number().int().optional(),
  range: z
    .object({
      min: z.number(),
      max: z.number(),
    })
    .optional(),
})

const itemSchema = z.object({
  name: z.string().optional(),
  type: z.string().min(1),
  iLevel: z.number().int().optional(),
  location: z.string().min(1).optional(),
  quality: z.string().min(1),
  defense: z.number().int().optional(),
  quantity: z.number().int().optional(),
  corrupted: z.union([z.boolean(), z.number().int()]).optional(),
  stats: z.array(statSchema).optional(),
})

function canonicalizeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(',')}]`
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, innerValue]) => `${JSON.stringify(key)}:${canonicalizeJson(innerValue)}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value)
}

function isCorrupted(item: RawClipboardItem): boolean {
  const safeStats = item.stats ?? []
  const byCorruptedFlag = safeStats.some((entry) => entry.corrupted === 1)
  const byCorruptName = safeStats.some((entry) => entry.name.trim().toLowerCase() === 'corrupt')
  const topLevelFlag = item.corrupted === true || item.corrupted === 1
  return byCorruptedFlag || byCorruptName || topLevelFlag
}

function unwrapSourceItem(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  if ('item' in value) {
    const nested = (value as { item?: unknown }).item
    if (nested && typeof nested === 'object') {
      return nested as Record<string, unknown>
    }
  }

  return value as Record<string, unknown>
}

function parseSocketCountFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return null
}

function detectSocketCount(item: RawClipboardItem, parsedSource: unknown): number | null {
  const source = unwrapSourceItem(parsedSource)
  if (source) {
    const direct =
      parseSocketCountFromValue(source.sockets) ??
      parseSocketCountFromValue(source.socket_count) ??
      parseSocketCountFromValue(source.socketCount)
    if (direct !== null) {
      return direct
    }
  }

  const socketPattern = /(?:socketed\s*\(?|\()\s*(\d+)\s*sockets?\)?/i
  for (const stat of item.stats ?? []) {
    const matched = socketPattern.exec(stat.name)
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

function detectEthereal(item: RawClipboardItem, parsedSource: unknown): boolean {
  const source = unwrapSourceItem(parsedSource)
  const sourceEthereal = source?.ethereal
  const bySource =
    sourceEthereal === true ||
    sourceEthereal === 1 ||
    (typeof sourceEthereal === 'string' && sourceEthereal.trim().toLowerCase() === 'true')
  const byStats = (item.stats ?? []).some((stat) => stat.name.trim().toLowerCase().includes('ethereal'))
  return bySource || byStats
}

function normalizeItem(item: RawClipboardItem, rawJson: string, parsedSource: unknown): ParsedItem {
  const safeStats = item.stats ?? []
  const corrupted = isCorrupted(item)
  const quantity = item.quantity ?? null
  const thumbnail = resolveThumbnail({
    baseType: item.type,
    itemName: item.name ?? null,
    quality: item.quality,
    quantity,
    isCorrupted: corrupted,
  })
  const analysis = analyzeBySampleCases(item)
  const isEthereal = detectEthereal(item, parsedSource)
  const socketCount = detectSocketCount(item, parsedSource)

  return {
    name: item.name ?? null,
    type: item.type,
    iLevel: item.iLevel ?? 0,
    location: item.location ?? 'Unknown',
    quality: item.quality,
    defense: item.defense ?? null,
    quantity,
    displayName: item.name ?? item.type,
    isCorrupted: corrupted,
    iconKey: thumbnail.iconKey,
    category: thumbnail.category,
    analysisProfile: analysis.profile,
    analysisTags: [
      ...analysis.tags,
      `thumbnail_source:${thumbnail.matchedBy}`,
      `thumbnail_frame:${thumbnail.qualityFrame}`,
      thumbnail.badges.corrupted ? 'thumbnail_badge:corrupted' : 'thumbnail_badge:none',
      thumbnail.badges.quantity ? 'thumbnail_badge:quantity' : 'thumbnail_badge:no_quantity',
      isEthereal ? 'ethereal' : 'non-ethereal',
      socketCount !== null ? 'socketed' : 'socketed:none',
      socketCount !== null ? `sockets:${socketCount}` : 'sockets:none',
    ],
    stats: safeStats.map((stat) => ({
      statName: stat.name,
      statValue: stat.value ?? null,
      rangeMin: stat.range?.min ?? null,
      rangeMax: stat.range?.max ?? null,
      statId: stat.stat_id ?? null,
      isCorrupted: stat.corrupted === 1 || stat.name.trim().toLowerCase() === 'corrupt',
    })),
    fingerprint: createHash('sha256').update(canonicalizeJson(parsedSource)).digest('hex'),
    rawJson,
  }
}

export async function ingestClipboardJson(rawJson: string): Promise<SaveParsedItemResult> {
  const parsedUnknown = JSON.parse(rawJson) as unknown
  const parsedItemResult = itemSchema.safeParse(parsedUnknown)
  let parsedItem: RawClipboardItem

  if (parsedItemResult.success) {
    parsedItem = parsedItemResult.data
  } else if (parsedUnknown && typeof parsedUnknown === 'object' && 'item' in parsedUnknown) {
    parsedItem = itemSchema.parse((parsedUnknown as { item?: unknown }).item)
  } else {
    throw parsedItemResult.error
  }
  const normalized = normalizeItem(parsedItem, rawJson, parsedUnknown)
  return saveParsedItem(normalized)
}
