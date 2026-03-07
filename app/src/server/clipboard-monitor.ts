import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { captureClipboardPayload } from './capture-service'

const execFileAsync = promisify(execFile)
const pollIntervalMs = 500
const processProbeCacheMs = 2000
const processTargets = ['pd2', 'diablo2']
const isDev = process.env.NODE_ENV !== 'production'

let lastProcessCheckAt = 0
let lastProcessCheckResult = false

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
  const now = Date.now()
  if (now - lastProcessCheckAt < processProbeCacheMs) {
    return lastProcessCheckResult
  }

  lastProcessCheckAt = now
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('tasklist', ['/fo', 'csv', '/nh'])
      const processNames = parseTasklistCsv(stdout).map((row) => row.imageName.toLowerCase())
      lastProcessCheckResult = processTargets.every((target) => processNames.some((name) => name.includes(target)))
      return lastProcessCheckResult
    }

    const { stdout } = await execFileAsync('ps', ['-A', '-o', 'comm='])
    const processNames = stdout
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0)
    lastProcessCheckResult = processTargets.every((target) => processNames.some((name) => name.includes(target)))
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

function isPd2ItemCandidate(parsed: unknown): parsed is { type: string } {
  if (!parsed || typeof parsed !== 'object') {
    return false
  }
  const maybeItem = parsed as { type?: unknown }
  return typeof maybeItem.type === 'string' && maybeItem.type.trim().length > 0
}

export function startClipboardMonitor(
  captureHandler: (payload: string) => { inserted: boolean; id: string | null } = captureClipboardPayload,
) {
  let lastValue = ''

  const timer = setInterval(async () => {
    try {
      const hasRequiredGames = await checkRequiredGameProcessesRunning()
      if (!hasRequiredGames) {
        return
      }

      const { default: clipboard } = await import('clipboardy')
      const current = (await clipboard.read()).trim()
      if (!current || current === lastValue) {
        return
      }

      if (!isJsonCandidate(current)) {
        lastValue = current
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(current) as unknown
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

      try {
        const result = captureHandler(current)
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
