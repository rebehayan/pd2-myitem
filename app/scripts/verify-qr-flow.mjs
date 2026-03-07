const baseUrl = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:4310'
const webUrl = process.env.VERIFY_WEB_BASE ?? ''
const qrKey = process.env.VERIFY_QR_KEY ?? ''
const expectPublicNoKey = (process.env.VERIFY_EXPECT_PUBLIC_NO_KEY ?? 'true').toLowerCase() === 'true'

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function fetchRaw(url) {
  return fetch(url, {
    headers: {
      Accept: 'application/json, text/html',
    },
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHealth(url, attempts = 20, delayMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetchRaw(url)
      if (res.status === 200) {
        const data = await res.json()
        if (data?.ok) {
          return
        }
      }
    } catch {
      // continue retry
    }
    await sleep(delayMs)
  }
  throw new Error(`API did not become healthy at ${url}`)
}

async function run() {
  const checks = []

  await waitForHealth(`${baseUrl}/api/health`)
  const healthRes = await fetchRaw(`${baseUrl}/api/health`)
  assertCondition(healthRes.status === 200, `Health check failed: ${healthRes.status}`)
  const healthData = await healthRes.json()
  assertCondition(Boolean(healthData?.ok), 'Health payload missing ok=true')
  checks.push('api/health -> 200')

  const publicUrl = `${baseUrl}/api/today/public`
  const noKeyRes = await fetchRaw(publicUrl)
  if (expectPublicNoKey) {
    assertCondition(noKeyRes.status === 200, `Expected public no-key access 200, got ${noKeyRes.status}`)
    const payload = await noKeyRes.json()
    assertCondition(Array.isArray(payload?.items), 'Public payload items is not an array')
    checks.push('api/today/public (no key) -> 200')
  } else {
    assertCondition(noKeyRes.status === 403, `Expected public no-key access 403, got ${noKeyRes.status}`)
    checks.push('api/today/public (no key) -> 403')
  }

  if (qrKey) {
    const keyRes = await fetchRaw(`${publicUrl}?key=${encodeURIComponent(qrKey)}`)
    assertCondition(keyRes.status === 200, `Expected token access 200, got ${keyRes.status}`)
    const payload = await keyRes.json()
    assertCondition(Array.isArray(payload?.items), 'Token payload items is not an array')
    checks.push('api/today/public (with key) -> 200')
  } else {
    checks.push('api/today/public (with key) -> skipped (VERIFY_QR_KEY not set)')
  }

  if (webUrl) {
    const todayRes = await fetchRaw(`${webUrl}/today${qrKey ? `?key=${encodeURIComponent(qrKey)}` : ''}`)
    assertCondition(todayRes.status === 200, `Expected /today page 200, got ${todayRes.status}`)
    const contentType = todayRes.headers.get('content-type') ?? ''
    assertCondition(contentType.includes('text/html'), `Expected text/html for /today, got ${contentType}`)
    checks.push('web /today -> 200 text/html')
  } else {
    checks.push('web /today -> skipped (VERIFY_WEB_BASE not set)')
  }

  console.log('[verify:qr] PASS')
  for (const check of checks) {
    console.log(`- ${check}`)
  }
}

run().catch((error) => {
  console.error('[verify:qr] FAIL')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
