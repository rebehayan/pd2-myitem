import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { captureClipboardPayload } from './capture-service'

const execFileAsync = promisify(execFile)
const pollIntervalMs = 500
const processProbeCacheMs = 2000
const processGroups: string[][] = [
  ['pd2', 'projectdiablo2', 'projectd2'],
  ['diablo2', 'projectdiablo2'],
]
const isDev = process.env.NODE_ENV !== 'production'
const processGateEnabled = process.env.CLIPBOARD_PROCESS_GATE !== 'false'

let lastProcessCheckAt = 0
let lastProcessCheckResult = false
let lastProcessGateBlockedLogAt = 0

interface ProcessRow {
  imageName: string
}

function parseTasklistCsv(csvText: string): ProcessRow[] {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replaceAll(/^"|"$/g, ''))
    .map((line) => {
      const cols = line.split('","')
      return { imageName: cols[0] ?? '' }
    })
}

async function checkRequiredGameProcessesRunning(): Promise<boolean> {
  if (!processGateEnabled) {
    return true
  }

  const now = Date.now()
  if (now - lastProcessCheckAt < processProbeCacheMs) {
    return lastProcessCheckResult
  }

  lastProcessCheckAt = now
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('tasklist', ['/fo', 'csv', '/nh'])
      const processNames = parseTasklistCsv(stdout).map((row) => row.imageName.toLowerCase())
      lastProcessCheckResult = processGroups.every((group) =>
        group.some((target) => processNames.some((name) => name.includes(target))),
      )
      return lastProcessCheckResult
    }

    const { stdout } = await execFileAsync('ps', ['-A', '-o', 'comm='])
    const processNames = stdout
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0)
    lastProcessCheckResult = processGroups.every((group) =>
      group.some((target) => processNames.some((name) => name.includes(target))),
    )
    return lastProcessCheckResult
  } catch (error) {
    if (isDev) {
      console.error('[clipboard] process check failed', error)
    }
    lastProcessCheckResult = false
    return false
  }
}

export async function isClipboardCaptureEnabledByProcessGate(): Promise<boolean> {
  return checkRequiredGameProcessesRunning()
}

function isJsonCandidate(text: string): boolean {
  return text.startsWith('{') && text.endsWith('}')
}

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim()
  if (isJsonCandidate(trimmed)) {
    return trimmed
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch?.[1]) {
    const fenced = fenceMatch[1].trim()
    if (isJsonCandidate(fenced)) {
      return fenced
    }
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1).trim()
    if (isJsonCandidate(sliced)) {
      return sliced
    }
  }

  return null
}

function unwrapItemCandidate(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') {
    return parsed
  }

  if ('item' in parsed) {
    return (parsed as { item?: unknown }).item
  }

  return parsed
}

function isPd2ItemCandidate(parsed: unknown): parsed is { type: string } {
  const candidate = unwrapItemCandidate(parsed)
  if (!candidate || typeof candidate !== 'object') {
    return false
  }
  const maybeItem = candidate as { type?: unknown }
  return typeof maybeItem.type === 'string' && maybeItem.type.trim().length > 0
}

function isStrongPd2ItemCandidate(parsed: unknown): parsed is { type: string; quality: string; location: string } {
  const candidate = unwrapItemCandidate(parsed)
  if (!candidate || typeof candidate !== 'object') {
    return false
  }
  const maybeItem = candidate as { type?: unknown; quality?: unknown; location?: unknown }
  return (
    typeof maybeItem.type === 'string' &&
    maybeItem.type.trim().length > 0 &&
    typeof maybeItem.quality === 'string' &&
    maybeItem.quality.trim().length > 0 &&
    typeof maybeItem.location === 'string' &&
    maybeItem.location.trim().length > 0
  )
}

export function startClipboardMonitor(
  captureHandler: (payload: string) => { inserted: boolean; id: string | null } = captureClipboardPayload,
) {
  let lastValue = ''

  const timer = setInterval(async () => {
    try {
      const hasRequiredGames = await checkRequiredGameProcessesRunning()

      const { default: clipboard } = await import('clipboardy')
      const current = (await clipboard.read()).trim()
      if (!current || current === lastValue) {
        return
      }

      const jsonPayload = extractJsonCandidate(current)
      if (!jsonPayload) {
        lastValue = current
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(jsonPayload) as unknown
      } catch {
        if (isDev) {
          console.log('[clipboard] invalid json ignored')
        }
        lastValue = current
        return
      }

      if (!isPd2ItemCandidate(parsed)) {
        if (isDev) {
          console.log('[clipboard] non-pd2 payload ignored')
        }
        lastValue = current
        return
      }

      if (!hasRequiredGames && !isStrongPd2ItemCandidate(parsed)) {
        if (isDev && Date.now() - lastProcessGateBlockedLogAt > 5000) {
          console.log('[clipboard] process gate blocked capture (waiting for PD2/Diablo2)')
          lastProcessGateBlockedLogAt = Date.now()
        }
        return
      }

      if (!hasRequiredGames && isDev) {
        console.log('[clipboard] process gate bypassed by strong PD2 item payload')
      }

      try {
        const result = captureHandler(jsonPayload)
        lastValue = current
        if (isDev && result.inserted) {
          console.log('[clipboard] new item captured')
        }
        if (isDev && !result.inserted) {
          console.log('[clipboard] duplicate ignored')
        }
      } catch (error) {
        if (isDev) {
          console.error('[clipboard] ingest failed', error)
        }
      }
    } catch (error) {
      if (isDev) {
        console.error('[clipboard] monitor error', error)
      }
    }
  }, pollIntervalMs)

  return () => clearInterval(timer)
}
