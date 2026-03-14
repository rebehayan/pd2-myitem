import { useEffect, useState } from 'react'
import { fetchSettings, fetchSyncStatus, triggerSyncPush, updateSettings } from '../lib/api'
import { checkForAppUpdate, downloadAndInstallUpdate, type AppUpdateSummary } from '../lib/app-updater'
import type { AppSettings, SyncStatus } from '../lib/types'
import { defaultAppSettings } from '../lib/settings-defaults'
import { useUiLanguage } from '../lib/ui-language-context'

function withDefaults(value: Partial<AppSettings>): AppSettings {
  return {
    ...defaultAppSettings,
    ...value,
    overlay_title: value.overlay_title ?? defaultAppSettings.overlay_title,
    overlay_title_enabled: value.overlay_title_enabled ?? defaultAppSettings.overlay_title_enabled,
    overlay_title_size: value.overlay_title_size ?? defaultAppSettings.overlay_title_size,
    overlay_title_color: value.overlay_title_color ?? defaultAppSettings.overlay_title_color,
    overlay_title_background_color:
      value.overlay_title_background_color ?? defaultAppSettings.overlay_title_background_color,
    overlay_title_padding: value.overlay_title_padding ?? defaultAppSettings.overlay_title_padding,
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readPreviewDraft(): Partial<AppSettings> {
  const draft: Partial<AppSettings> = {}
  const previewTitle = window.localStorage.getItem('overlay_title_preview')
  const previewEnabled = window.localStorage.getItem('overlay_title_preview_enabled')
  const previewSize = window.localStorage.getItem('overlay_title_preview_size')
  const previewColor = window.localStorage.getItem('overlay_title_preview_color')
  const previewBackgroundColor = window.localStorage.getItem('overlay_title_preview_background_color')
  const previewPadding = window.localStorage.getItem('overlay_title_preview_padding')
  const previewMinimalMode = window.localStorage.getItem('overlay_minimal_mode_preview')

  if (previewTitle) {
    draft.overlay_title = previewTitle
  }
  if (previewEnabled === 'true' || previewEnabled === 'false') {
    draft.overlay_title_enabled = previewEnabled === 'true'
  }
  if (previewSize) {
    const parsed = Number(previewSize)
    if (Number.isFinite(parsed)) {
      draft.overlay_title_size = parsed
    }
  }
  if (previewColor) {
    draft.overlay_title_color = previewColor
  }
  if (previewBackgroundColor) {
    draft.overlay_title_background_color = previewBackgroundColor
  }
  if (previewPadding) {
    const parsed = Number(previewPadding)
    if (Number.isFinite(parsed)) {
      draft.overlay_title_padding = parsed
    }
  }
  if (previewMinimalMode === 'true' || previewMinimalMode === 'false') {
    draft.overlay_minimal_mode = previewMinimalMode === 'true'
  }

  return draft
}

export function SettingsPage() {
  const { language } = useUiLanguage()
  const text =
    language === 'ko'
      ? {
          title: '설정',
          subtitle: '오버레이 및 공개 설정을 관리합니다.',
          overlayTab: '오버레이',
          publicTab: '공개',
          loadFail: '설정을 불러오지 못해 기본값을 사용합니다.',
          saveOk: '설정을 저장했습니다.',
          saveFail: '설정 저장에 실패했습니다.',
          itemCount: '오버레이 아이템 수',
          opacity: '오버레이 투명도',
          minimal: '미니멀 오버레이 사용 (썸네일/배지 숨김)',
          overlayTitle: '오버레이 제목',
          showTitle: '오버레이 제목 표시',
          titleSize: '제목 크기',
          titleColor: '제목 색상',
          titleBg: '제목 배경',
          titlePadding: '제목 패딩',
          qrEnable: 'QR 공개 페이지 사용',
          qrToken: 'QR 토큰',
          regen: '토큰 재생성',
          syncTitle: '동기화 상태',
          syncPendingItems: '대기 아이템',
          syncFailedItems: '실패 아이템',
          syncQueuedOps: '큐 작업 수',
          syncFailedOps: '실패 작업 수',
          syncLastError: '최근 오류',
          syncNextRetry: '다음 재시도',
          syncRunning: '동기화 실행 중',
          syncRunNow: '지금 동기화 실행',
          syncRunDone: '동기화 실행 완료',
          syncUnavailable: '동기화 상태를 불러오지 못했습니다.',
          syncNone: '없음',
          updateTitle: '앱 업데이트',
          updateCheck: '업데이트 확인',
          updateInstall: '업데이트 다운로드/설치',
          updateNoSupport: '데스크톱 앱에서만 업데이트를 지원합니다.',
          updateChecking: '업데이트를 확인하는 중입니다...',
          updateLatest: '최신 버전입니다.',
          updateAvailable: '새 버전이 있습니다.',
          updateInstalled: '업데이트 설치가 완료되었습니다. 앱을 재시작하면 적용됩니다.',
          updateCheckFail: '업데이트 확인에 실패했습니다.',
          updateInstallFail: '업데이트 설치에 실패했습니다.',
          updateCurrent: '현재 버전',
          updateNext: '업데이트 버전',
          save: '설정 저장',
        }
      : {
          title: 'Settings',
          subtitle: 'Manage overlay and public sharing settings.',
          overlayTab: 'Overlay',
          publicTab: 'Public',
          loadFail: 'Failed to load settings; using defaults.',
          saveOk: 'Settings saved.',
          saveFail: 'Failed to save settings.',
          itemCount: 'Overlay Item Count',
          opacity: 'Overlay Opacity',
          minimal: 'Use minimal overlay (no thumbnail, no badges)',
          overlayTitle: 'Overlay Title',
          showTitle: 'Show overlay title',
          titleSize: 'Title Size',
          titleColor: 'Title Color',
          titleBg: 'Title Background',
          titlePadding: 'Title Padding',
          qrEnable: 'Enable QR public page',
          qrToken: 'QR Token',
          regen: 'Regenerate Token',
          syncTitle: 'Sync Status',
          syncPendingItems: 'Pending Items',
          syncFailedItems: 'Failed Items',
          syncQueuedOps: 'Queued Operations',
          syncFailedOps: 'Failed Operations',
          syncLastError: 'Last Error',
          syncNextRetry: 'Next Retry',
          syncRunning: 'Sync Running',
          syncRunNow: 'Run Sync Now',
          syncRunDone: 'Sync push finished',
          syncUnavailable: 'Failed to load sync status.',
          syncNone: 'None',
          updateTitle: 'App Update',
          updateCheck: 'Check for updates',
          updateInstall: 'Download and install update',
          updateNoSupport: 'Updates are available only in desktop app runtime.',
          updateChecking: 'Checking for updates...',
          updateLatest: 'You are on the latest version.',
          updateAvailable: 'A new version is available.',
          updateInstalled: 'Update installed. Restart app to apply changes.',
          updateCheckFail: 'Failed to check for updates.',
          updateInstallFail: 'Failed to install update.',
          updateCurrent: 'Current Version',
          updateNext: 'Update Version',
          save: 'Save settings',
        }
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncStatusMessage, setSyncStatusMessage] = useState('')
  const [syncPushMessage, setSyncPushMessage] = useState('')
  const [updateStatus, setUpdateStatus] = useState<AppUpdateSummary | null>(null)
  const [updateMessage, setUpdateMessage] = useState('')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [hasHydrated, setHasHydrated] = useState(false)
  const [activeTab, setActiveTab] = useState<'overlay' | 'sharing'>(() => {
    const stored = window.localStorage.getItem('settings_active_tab')
    return stored === 'sharing' ? 'sharing' : 'overlay'
  })

  useEffect(() => {
    fetchSettings()
      .then((loaded) => {
        const draft = readPreviewDraft()
        setSettings(withDefaults({ ...loaded, ...draft }))
        setHasHydrated(true)
      })
      .catch(() => {
        const draft = readPreviewDraft()
        setSettings(withDefaults(draft))
        setMessage(text.loadFail)
        setHasHydrated(true)
      })
  }, [text.loadFail])

  useEffect(() => {
    let disposed = false
    const loadSyncStatus = async () => {
      try {
        const status = await fetchSyncStatus()
        if (!disposed) {
          setSyncStatus(status)
          setSyncStatusMessage('')
        }
      } catch {
        if (!disposed) {
          setSyncStatus(null)
          setSyncStatusMessage(text.syncUnavailable)
        }
      }
    }

    void loadSyncStatus()
    const intervalId = window.setInterval(() => {
      void loadSyncStatus()
    }, 10000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [text.syncUnavailable])

  useEffect(() => {
    let disposed = false
    const initialCheck = async () => {
      try {
        const result = await checkForAppUpdate()
        if (disposed) {
          return
        }
        setUpdateStatus(result)
        if (!result.supported) {
          setUpdateMessage(text.updateNoSupport)
        } else if (result.available) {
          setUpdateMessage(text.updateAvailable)
        } else {
          setUpdateMessage(text.updateLatest)
        }
      } catch {
        if (!disposed) {
          setUpdateMessage(text.updateCheckFail)
        }
      }
    }

    void initialCheck()
    return () => {
      disposed = true
    }
  }, [text.updateAvailable, text.updateCheckFail, text.updateLatest, text.updateNoSupport])

  useEffect(() => {
    window.localStorage.setItem('overlay_title_preview_active', 'true')
    return () => {
      window.localStorage.removeItem('overlay_title_preview_active')
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }
    window.localStorage.setItem('settings_active_tab', activeTab)
    window.localStorage.setItem('overlay_title_preview', settings.overlay_title)
    window.localStorage.setItem('overlay_title_preview_enabled', settings.overlay_title_enabled ? 'true' : 'false')
    window.localStorage.setItem('overlay_title_preview_size', String(settings.overlay_title_size))
    window.localStorage.setItem('overlay_title_preview_color', settings.overlay_title_color)
    window.localStorage.setItem('overlay_title_preview_background_color', settings.overlay_title_background_color)
    window.localStorage.setItem('overlay_title_preview_padding', String(settings.overlay_title_padding))
    window.localStorage.setItem('overlay_minimal_mode_preview', settings.overlay_minimal_mode ? 'true' : 'false')
  }, [
    activeTab,
    hasHydrated,
    settings.overlay_title,
    settings.overlay_title_enabled,
    settings.overlay_title_size,
    settings.overlay_title_color,
    settings.overlay_title_background_color,
    settings.overlay_title_padding,
    settings.overlay_minimal_mode,
  ])

  const save = async () => {
    try {
      const updated = await updateSettings(settings)
      const merged = withDefaults({ ...settings, ...updated })
      setSettings(merged)
      window.localStorage.setItem('overlay_title', merged.overlay_title)
      window.localStorage.setItem(
        'overlay_title_enabled',
        merged.overlay_title_enabled ? 'true' : 'false',
      )
      window.localStorage.setItem(
        'overlay_title_size',
        String(merged.overlay_title_size),
      )
      window.localStorage.setItem(
        'overlay_title_color',
        merged.overlay_title_color,
      )
      window.localStorage.setItem(
        'overlay_title_background_color',
        merged.overlay_title_background_color,
      )
      window.localStorage.setItem(
        'overlay_title_padding',
        String(merged.overlay_title_padding),
      )
      window.localStorage.setItem('overlay_minimal_mode', merged.overlay_minimal_mode ? 'true' : 'false')
      setMessage(text.saveOk)
    } catch {
      setMessage(text.saveFail)
    }
  }

  const runSyncPush = async () => {
    try {
      const result = await triggerSyncPush()
      const status = await fetchSyncStatus()
      setSyncStatus(status)
      setSyncPushMessage(
        `${text.syncRunDone} (${result.processed}/${result.succeeded}/${result.failed}/${result.skipped})`,
      )
    } catch {
      setSyncPushMessage(text.syncUnavailable)
    }
  }

  const runCheckUpdate = async () => {
    setUpdateBusy(true)
    setUpdateMessage(text.updateChecking)
    try {
      const result = await checkForAppUpdate()
      setUpdateStatus(result)
      if (!result.supported) {
        setUpdateMessage(text.updateNoSupport)
      } else if (result.available) {
        setUpdateMessage(text.updateAvailable)
      } else {
        setUpdateMessage(text.updateLatest)
      }
    } catch {
      setUpdateMessage(text.updateCheckFail)
    } finally {
      setUpdateBusy(false)
    }
  }

  const runInstallUpdate = async () => {
    setUpdateBusy(true)
    try {
      const result = await downloadAndInstallUpdate()
      setUpdateStatus(result)
      if (!result.supported) {
        setUpdateMessage(text.updateNoSupport)
      } else if (!result.available) {
        setUpdateMessage(text.updateLatest)
      } else {
        setUpdateMessage(text.updateInstalled)
      }
    } catch {
      setUpdateMessage(text.updateInstallFail)
    } finally {
      setUpdateBusy(false)
    }
  }

  return (
    <section className="d2-panel d2-ui">
      <div className="d2-panel__header">
        <div>
          <h2 className="d2-panel__title">{text.title}</h2>
          <p className="d2-panel__subtitle">{text.subtitle}</p>
        </div>
        <div className="d2-tabs" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            className={`d2-tab${activeTab === 'overlay' ? ' is-active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'overlay'}
            aria-controls="settings-overlay"
            id="settings-overlay-tab"
            onClick={() => setActiveTab('overlay')}
          >
            {text.overlayTab}
          </button>
          <button
            type="button"
            className={`d2-tab${activeTab === 'sharing' ? ' is-active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'sharing'}
            aria-controls="settings-sharing"
            id="settings-sharing-tab"
            onClick={() => setActiveTab('sharing')}
          >
            {text.publicTab}
          </button>
        </div>
      </div>

      <div
        role="tabpanel"
        id="settings-overlay"
        aria-labelledby="settings-overlay-tab"
        hidden={activeTab !== 'overlay'}
      >
        <label className="settings-field">
          <span className="d2-label">{text.itemCount}</span>
          <select
            className="d2-select"
            value={settings.overlay_item_limit}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_item_limit: Number(event.target.value),
              }))
            }
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="d2-label">{text.opacity}</span>
          <input
            type="number"
            min={0.1}
            max={1}
            step={0.1}
            className="d2-input"
            value={settings.overlay_opacity}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_opacity: Number(event.target.value),
              }))
            }
          />
        </label>

        <label className="settings-field settings-field--inline">
          <input
            type="checkbox"
            checked={settings.overlay_minimal_mode}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_minimal_mode: event.target.checked,
              }))
            }
          />
          <span className="d2-label">{text.minimal}</span>
        </label>

        <label className="settings-field">
          <span className="d2-label">{text.overlayTitle}</span>
          <input
            type="text"
            className="d2-input"
            value={settings.overlay_title}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_title: event.target.value,
              }))
            }
          />
        </label>

        <label className="settings-field settings-field--inline">
          <input
            type="checkbox"
            checked={settings.overlay_title_enabled}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                overlay_title_enabled: event.target.checked,
              }))
            }
          />
          <span className="d2-label">{text.showTitle}</span>
        </label>

        <div className="settings-grid settings-grid--title">
          <label className="settings-field">
            <span className="d2-label">{text.titleSize} ({settings.overlay_title_size}px)</span>
            <input
              type="range"
              min={12}
              max={36}
              step={1}
              value={settings.overlay_title_size}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  overlay_title_size: Number(event.target.value),
                }))
              }
            />
          </label>

          <label className="settings-field">
            <span className="d2-label">{text.titleColor}</span>
            <input
              type="color"
              className="settings-color"
              value={settings.overlay_title_color}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  overlay_title_color: event.target.value,
                }))
              }
            />
          </label>

          <label className="settings-field">
            <span className="d2-label">{text.titleBg}</span>
            <input
              type="color"
              className="settings-color"
              value={settings.overlay_title_background_color}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  overlay_title_background_color: event.target.value,
                }))
              }
            />
          </label>

          <label className="settings-field">
            <span className="d2-label">{text.titlePadding} ({settings.overlay_title_padding}px)</span>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={settings.overlay_title_padding}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  overlay_title_padding: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
      </div>

      <div
        role="tabpanel"
        id="settings-sharing"
        aria-labelledby="settings-sharing-tab"
        hidden={activeTab !== 'sharing'}
      >
        <label className="settings-field settings-field--inline">
          <input
            type="checkbox"
            checked={settings.qr_public_enabled}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                qr_public_enabled: event.target.checked,
              }))
            }
          />
          <span className="d2-label">{text.qrEnable}</span>
        </label>

        <label className="settings-field">
          <span className="d2-label">{text.qrToken}</span>
          <input
            type="text"
            className="d2-input"
            value={settings.qr_token}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                qr_token: event.target.value,
              }))
            }
          />
        </label>

        <button
          type="button"
          className="d2-button d2-button--secondary d2-button--sm"
          onClick={() =>
            setSettings((prev) => ({
              ...prev,
              qr_token: generateToken(),
            }))
          }
        >
          {text.regen}
        </button>
      </div>

      <button type="button" className="d2-button d2-button--primary" onClick={save}>
        {text.save}
      </button>

      <section className="d2-panel" aria-label="Sync status panel">
        <h3>{text.syncTitle}</h3>
        {syncStatus ? (
          <div className="settings-grid settings-grid--title">
            <p>{text.syncPendingItems}: {syncStatus.pendingItems}</p>
            <p>{text.syncFailedItems}: {syncStatus.failedItems}</p>
            <p>{text.syncQueuedOps}: {syncStatus.queuedOperations}</p>
            <p>{text.syncFailedOps}: {syncStatus.failedOperations}</p>
            <p>{text.syncLastError}: {syncStatus.lastError ?? text.syncNone}</p>
            <p>{text.syncNextRetry}: {syncStatus.nextRetryAt ? new Date(syncStatus.nextRetryAt).toLocaleString() : text.syncNone}</p>
            <p>{text.syncRunning}: {syncStatus.running ? 'true' : 'false'}</p>
          </div>
        ) : null}
        <button type="button" className="d2-button d2-button--secondary d2-button--sm" onClick={runSyncPush}>
          {text.syncRunNow}
        </button>
        {syncPushMessage ? <p>{syncPushMessage}</p> : null}
        {syncStatusMessage ? <p>{syncStatusMessage}</p> : null}
      </section>

      <section className="d2-panel" aria-label="App update panel">
        <h3>{text.updateTitle}</h3>
        {updateStatus ? (
          <div className="settings-grid settings-grid--title">
            <p>{text.updateCurrent}: {updateStatus.currentVersion ?? text.syncNone}</p>
            <p>{text.updateNext}: {updateStatus.nextVersion ?? text.syncNone}</p>
          </div>
        ) : null}
        <div className="dashboard-list__actions">
          <button
            type="button"
            className="d2-button d2-button--secondary d2-button--sm"
            onClick={runCheckUpdate}
            disabled={updateBusy}
          >
            {text.updateCheck}
          </button>
          <button
            type="button"
            className="d2-button d2-button--primary d2-button--sm"
            onClick={runInstallUpdate}
            disabled={updateBusy}
          >
            {text.updateInstall}
          </button>
        </div>
        {updateMessage ? <p>{updateMessage}</p> : null}
      </section>

      {message ? <p>{message}</p> : null}
    </section>
  )
}
