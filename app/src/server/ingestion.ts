import { createHash } from 'node:crypto'
import { z } from 'zod'
import { saveParsedItem } from './repository'
import type { ParsedItem, RawClipboardItem } from './types'

const statSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  stat_id: z.number().int().optional(),
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
  iLevel: z.number().int(),
  location: z.string().min(1),
  quality: z.string().min(1),
  quantity: z.number().int().optional(),
  corrupted: z.boolean().optional(),
  stats: z.array(statSchema).optional(),
})

function normalizeItem(item: RawClipboardItem, rawJson: string): ParsedItem {
  const safeStats = item.stats ?? []
  const loweredStats = safeStats.map((entry) => entry.name.toLowerCase())
  const isCorrupted = Boolean(item.corrupted) || loweredStats.some((name) => name.includes('corrupt'))

  return {
    name: item.name ?? null,
    type: item.type,
    iLevel: item.iLevel,
    location: item.location,
    quality: item.quality,
    quantity: item.quantity ?? null,
    displayName: item.name && item.name.trim().length > 0 ? item.name : item.type,
    isCorrupted,
    iconKey: `${item.quality.toLowerCase()}-${item.type.toLowerCase().replaceAll(/\s+/g, '-')}`,
    stats: safeStats.map((stat) => ({
      statName: stat.name,
      statValue: stat.value,
      rangeMin: stat.range?.min ?? null,
      rangeMax: stat.range?.max ?? null,
      statId: stat.stat_id ?? null,
    })),
    fingerprint: createHash('sha1').update(rawJson).digest('hex'),
    rawJson,
  }
}

export function ingestClipboardJson(rawJson: string): { inserted: boolean; id: string | null } {
  const parsedUnknown = JSON.parse(rawJson) as unknown
  const parsedItem = itemSchema.parse(parsedUnknown)
  const normalized = normalizeItem(parsedItem, rawJson)
  return saveParsedItem(normalized)
}
