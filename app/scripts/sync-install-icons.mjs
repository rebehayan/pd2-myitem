import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(scriptDir, '..')
const projectRoot = path.resolve(appDir, '..')

const sourceDir = path.resolve(projectRoot, '_up_', 'public', 'icons')
const targetDir = path.resolve(appDir, 'public', 'icons')

const numberedSuffixPattern = /\s\(\d+\)\.[a-z0-9]+$/i

function toPosix(p) {
  return p.replaceAll('\\', '/')
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function syncIcons() {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    console.log('[icons:sync-install] source not found, skipping:', sourceDir)
    return
  }

  ensureDir(targetDir)

  const stack = ['']
  let copied = 0
  let skippedNumbered = 0
  let alreadyExists = 0

  while (stack.length > 0) {
    const relativeDir = stack.pop()
    if (relativeDir === undefined) {
      continue
    }

    const absoluteDir = path.join(sourceDir, relativeDir)
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true })

    for (const entry of entries) {
      const relativePath = path.join(relativeDir, entry.name)
      const absolutePath = path.join(sourceDir, relativePath)
      if (entry.isDirectory()) {
        stack.push(relativePath)
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      if (numberedSuffixPattern.test(entry.name)) {
        skippedNumbered += 1
        continue
      }

      const targetPath = path.join(targetDir, relativePath)
      if (fs.existsSync(targetPath)) {
        alreadyExists += 1
        continue
      }

      ensureDir(path.dirname(targetPath))
      fs.copyFileSync(absolutePath, targetPath)
      copied += 1
    }
  }

  console.log(
    `[icons:sync-install] copied=${copied} existed=${alreadyExists} skipped_numbered=${skippedNumbered} source=${toPosix(sourceDir)} target=${toPosix(targetDir)}`,
  )
}

syncIcons()
