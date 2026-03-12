import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { UiLanguageContext, type UiLanguage, type UiLanguageContextValue } from './ui-language-context'

const STORAGE_KEY = 'ui_language'

function readStoredLanguage(): UiLanguage {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'ko' ? 'ko' : 'en'
}

export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<UiLanguage>(() => readStoredLanguage())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const value = useMemo<UiLanguageContextValue>(() => {
    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((prev) => (prev === 'en' ? 'ko' : 'en')),
    }
  }, [language])

  return <UiLanguageContext.Provider value={value}>{children}</UiLanguageContext.Provider>
}
