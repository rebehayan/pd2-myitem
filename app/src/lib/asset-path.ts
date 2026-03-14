const baseUrl = import.meta.env.BASE_URL ?? '/'
const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

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
