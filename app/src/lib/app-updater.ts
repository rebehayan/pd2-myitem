interface UpdateLike {
  version: string
  currentVersion: string
  date?: string
  body?: string
  downloadAndInstall: () => Promise<void>
}

export interface AppUpdateSummary {
  supported: boolean
  available: boolean
  currentVersion?: string
  nextVersion?: string
  date?: string
  notes?: string
  error?: string
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function toUpdateLike(value: unknown): UpdateLike | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const candidate = value as Partial<UpdateLike>
  if (
    typeof candidate.version !== 'string' ||
    typeof candidate.currentVersion !== 'string' ||
    typeof candidate.downloadAndInstall !== 'function'
  ) {
    return null
  }
  return candidate as UpdateLike
}

async function checkRawUpdate(): Promise<UpdateLike | null> {
  if (!isTauriRuntime()) {
    return null
  }
  try {
    const updater = await import('@tauri-apps/plugin-updater')
    const update = await updater.check()
    return toUpdateLike(update)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`updater check failed: ${message}`)
  }
}

export async function checkForAppUpdate(): Promise<AppUpdateSummary> {
  if (!isTauriRuntime()) {
    return { supported: false, available: false }
  }
  try {
    const update = await checkRawUpdate()
    if (!update) {
      return { supported: true, available: false }
    }

    return {
      supported: true,
      available: true,
      currentVersion: update.currentVersion,
      nextVersion: update.version,
      date: update.date,
      notes: update.body,
    }
  } catch (error) {
    return {
      supported: true,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function downloadAndInstallUpdate(): Promise<AppUpdateSummary> {
  if (!isTauriRuntime()) {
    return { supported: false, available: false }
  }

  try {
    const update = await checkRawUpdate()
    if (!update) {
      return { supported: true, available: false }
    }

    await update.downloadAndInstall()
    return {
      supported: true,
      available: true,
      currentVersion: update.currentVersion,
      nextVersion: update.version,
      date: update.date,
      notes: update.body,
    }
  } catch (error) {
    return {
      supported: true,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
