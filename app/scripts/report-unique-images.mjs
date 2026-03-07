import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(currentDir, '..')

const strictMode = (process.env.UNIQUE_IMAGE_REPORT_STRICT ?? 'false').toLowerCase() === 'true'

const mapFilePath = path.join(appRoot, 'src', 'data', 'unique-image-map.json')
const iconRootPath = path.join(appRoot, 'public', 'icons')
const docsToScan = [
  path.resolve(appRoot, '..', 'docs', 'data', '10-json-spec.md'),
  path.resolve(appRoot, '..', 'docs', 'data', '13-sample-items.md'),
]

function normalizeUniqueNameKey(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf-8')
}

function loadUniqueMap() {
  const raw = JSON.parse(readText(mapFilePath))
  const entries = Object.entries(raw)
  return entries.map(([name, fileName]) => {
    const normalizedName = normalizeUniqueNameKey(name)
    const relativeIconPath = String(fileName)
    const fullIconPath = path.join(iconRootPath, relativeIconPath)
    return {
      name,
      normalizedName,
      relativeIconPath,
      fullIconPath,
      exists: fs.existsSync(fullIconPath),
    }
  })
}

function collectUniqueNamesFromDoc(filePath) {
  const text = readText(filePath)
  const lines = text.split(/\r?\n/)
  const names = []

  for (let i = 0; i < lines.length; i += 1) {
    if (!/"quality"\s*:\s*"Unique"/i.test(lines[i])) {
      continue
    }

    let foundName = null
    for (let j = i; j >= Math.max(0, i - 30); j -= 1) {
      const nameMatch = lines[j].match(/"name"\s*:\s*"([^"]+)"/i)
      if (nameMatch) {
        foundName = nameMatch[1]
        break
      }
    }

    let hasTypeField = false
    for (let j = i; j <= Math.min(lines.length - 1, i + 30); j += 1) {
      if (/"stats"\s*:\s*\[/i.test(lines[j])) {
        break
      }
      if (/"type"\s*:\s*"[^"]+"/i.test(lines[j])) {
        hasTypeField = true
        break
      }
    }

    if (hasTypeField && foundName) {
      names.push(foundName)
    }
  }

  return names
}

function main() {
  const mapEntries = loadUniqueMap()
  const mappedNames = new Set(mapEntries.map((entry) => entry.normalizedName))

  const extractedUniqueNames = docsToScan.flatMap((filePath) => {
    if (!fs.existsSync(filePath)) {
      return []
    }
    return collectUniqueNamesFromDoc(filePath)
  })

  const normalizedExtracted = Array.from(new Set(extractedUniqueNames.map((name) => normalizeUniqueNameKey(name))))
  const missingMapNames = normalizedExtracted.filter((name) => !mappedNames.has(name))
  const missingIconFiles = mapEntries.filter((entry) => !entry.exists)

  console.log('[report:unique-images] SUMMARY')
  console.log(`- map entries: ${mapEntries.length}`)
  console.log(`- extracted unique names from docs: ${normalizedExtracted.length}`)
  console.log(`- missing map entries: ${missingMapNames.length}`)
  console.log(`- missing icon files: ${missingIconFiles.length}`)

  if (missingMapNames.length > 0) {
    console.log('[report:unique-images] Missing unique map entries')
    for (const key of missingMapNames) {
      console.log(`- ${key}`)
    }
  }

  if (missingIconFiles.length > 0) {
    console.log('[report:unique-images] Missing icon files')
    for (const item of missingIconFiles) {
      console.log(`- ${item.name} -> ${item.relativeIconPath}`)
    }
  }

  if (strictMode && (missingMapNames.length > 0 || missingIconFiles.length > 0)) {
    console.error('[report:unique-images] FAIL (strict mode)')
    process.exit(1)
  }

  console.log('[report:unique-images] PASS')
}

main()
