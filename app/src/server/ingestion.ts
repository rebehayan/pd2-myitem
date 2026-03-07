import { createHash } from 'node:crypto'
import { z } from 'zod'
import { saveParsedItem } from './repository'
import { resolveThumbnail } from './icon-mapping'
import { analyzeBySampleCases } from './item-analysis'
import type { ParsedItem, RawClipboardItem } from './types'
import type { SaveParsedItemResult } from './repository'

const statSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  stat_id: z.number().int().optional(),
  corrupted: z.number().int().optional(),
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

function normalizeItem(item: RawClipboardItem, rawJson: string, parsedSource: unknown): ParsedItem {
  const safeStats = item.stats ?? []
  const corrupted = isCorrupted(item)
  const quantity = item.quantity ?? null
  const thumbnail = resolveThumbnail({
    baseType: item.type,
    quality: item.quality,
    quantity,
    isCorrupted: corrupted,
  })
  const analysis = analyzeBySampleCases(item)

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
    ],
    stats: safeStats.map((stat) => ({
      statName: stat.name,
      statValue: stat.value,
      rangeMin: stat.range?.min ?? null,
      rangeMax: stat.range?.max ?? null,
      statId: stat.stat_id ?? null,
      isCorrupted: stat.corrupted === 1 || stat.name.trim().toLowerCase() === 'corrupt',
    })),
    fingerprint: createHash('sha256').update(canonicalizeJson(parsedSource)).digest('hex'),
    rawJson,
  }
}

export function ingestClipboardJson(rawJson: string): SaveParsedItemResult {
  const parsedUnknown = JSON.parse(rawJson) as unknown
  const parsedItem = itemSchema.parse(parsedUnknown)
  const normalized = normalizeItem(parsedItem, rawJson, parsedUnknown)
  return saveParsedItem(normalized)
}
