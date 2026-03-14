const baseUrl = import.meta.env.BASE_URL ?? '/'
const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
const apiBase = (import.meta.env.VITE_API_BASE ?? '').trim()
const normalizedApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase
const normalizedApiIconBase = normalizedApiBase.replace(/\/api$/i, '')

function withApiBase(path: string): string | null {
  if (!normalizedApiBase) {
    return null
  }
  const base = normalizedApiIconBase || normalizedApiBase
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  if (path.startsWith('/')) {
    return `${base}${path}`
  }
  return `${base}/${path}`
}

export function withBasePath(path: string): string {
  if (!path) {
    return path
  }
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path
  }
  if (path.startsWith(normalizedBase)) {
    return path
  }
  if (path.startsWith('/icons/') || path.startsWith('icons/')) {
    const apiResolved = withApiBase(path)
    if (apiResolved) {
      return apiResolved
    }
  }
  if (path.startsWith('/')) {
    return `${normalizedBase}${path.slice(1)}`
  }
  return `${normalizedBase}${path}`
}

export function withBasePathOptional(path?: string | null): string | null {
  if (!path) {
    return null
  }
  return withBasePath(path)
}

export function getRouterBasename(): string {
  const trimmed = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase
  return trimmed || '/'
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function getOverlayUrl(): string {
  if (isTauriRuntime()) {
    return 'http://127.0.0.1:4310/overlay'
  }
  return withBasePath('overlay')
}
