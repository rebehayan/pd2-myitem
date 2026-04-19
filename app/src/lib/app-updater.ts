const GITHUB_REPO_OWNER = 'rebehayan'
const GITHUB_REPO_NAME = 'pd2-myitem'
const LATEST_JSON_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/releases/latest.json`

interface ReleaseManifest {
  version: string
  currentVersion: string
  appUpdate: boolean
  dataUpdate: boolean
  releaseUrl: string
  downloadExe: string
  downloadInstaller: string
  date: string
  body: string
  data: {
    icons: boolean
    filter: boolean
  }
  changes: string[] | { ko?: string[]; en?: string[] }
}

export interface AppUpdateSummary {
  supported: boolean
  available: boolean
  appUpdate: boolean
  dataUpdate: boolean
  currentVersion?: string
  nextVersion?: string
  date?: string
  notes?: string
  changes?: string[]
  changesEn?: string[]
  changesKo?: string[]
  downloadExe?: string
  downloadInstaller?: string
  error?: string
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function getCurrentVersion(): string {
  return '0.1.2'
}

function parseVersion(version: string): number[] {
  return version.split('.').map((v) => parseInt(v, 10) || 0)
}

function isNewerVersion(current: string, next: string): boolean {
  const currentParts = parseVersion(current)
  const nextParts = parseVersion(next)
  for (let i = 0; i < Math.max(currentParts.length, nextParts.length); i++) {
    const cur = currentParts[i] || 0
    const next = nextParts[i] || 0
    if (next > cur) return true
    if (next < cur) return false
  }
  return false
}

export async function checkForAppUpdate(): Promise<AppUpdateSummary> {
  if (!isTauriRuntime()) {
    return { supported: false, available: false, appUpdate: false, dataUpdate: false }
  }

  const currentVersion = getCurrentVersion()

  try {
    const response = await fetch(LATEST_JSON_URL + '?t=' + Date.now(), {
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        supported: true,
        available: false,
        appUpdate: false,
        dataUpdate: false,
        error: `Failed to fetch manifest: ${response.status}`,
      }
    }

    const manifest = (await response.json()) as ReleaseManifest
    const hasAppUpdate = manifest.appUpdate && isNewerVersion(currentVersion, manifest.version)
    const hasDataUpdate = manifest.dataUpdate ?? false
    const available = hasAppUpdate || hasDataUpdate

    const changesObj = manifest.changes as { ko?: string[]; en?: string[] } | undefined

    return {
      supported: true,
      available,
      appUpdate: hasAppUpdate,
      dataUpdate: hasDataUpdate,
      currentVersion,
      nextVersion: manifest.version,
      date: manifest.date,
      notes: manifest.body,
      changes: changesObj?.ko ?? changesObj?.en ?? [],
      changesKo: changesObj?.ko ?? [],
      changesEn: changesObj?.en ?? [],
      downloadExe: manifest.downloadExe,
      downloadInstaller: manifest.downloadInstaller,
    }
  } catch (error) {
    return {
      supported: true,
      available: false,
      appUpdate: false,
      dataUpdate: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function downloadAndInstallUpdate(): Promise<AppUpdateSummary> {
  if (!isTauriRuntime()) {
    return { supported: false, available: false, appUpdate: false, dataUpdate: false }
  }

  const result = await checkForAppUpdate()

  if (!result.available || !result.downloadExe) {
    return result
  }

  if (result.appUpdate && result.downloadInstaller) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(result.downloadInstaller)
      return {
        ...result,
        notes: '설치 프로그램이 다운로드되었습니다. 파일을 실행하여 설치해주세요.',
      }
    } catch (error) {
      return {
        ...result,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return result
}

export async function openDownloadPage(): Promise<{ success: boolean; error?: string }> {
  if (!isTauriRuntime()) {
    return { success: false, error: 'Desktop app only' }
  }

  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(`https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}