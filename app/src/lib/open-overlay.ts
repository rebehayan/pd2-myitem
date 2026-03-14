import { getOverlayUrl } from './asset-path'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function openOverlayInBrowser(): Promise<void> {
  const url = getOverlayUrl()
  if (isTauriRuntime()) {
    try {
      const shell = await import('@tauri-apps/plugin-shell')
      await shell.open(url)
      return
    } catch (error) {
      void error
    }
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer')
  if (!popup) {
    window.location.assign(url)
  }
}
