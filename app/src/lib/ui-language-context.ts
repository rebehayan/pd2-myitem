import { createContext, useContext } from 'react'

export type UiLanguage = 'en' | 'ko'

export interface UiLanguageContextValue {
  language: UiLanguage
  setLanguage: (next: UiLanguage) => void
  toggleLanguage: () => void
}

export const UiLanguageContext = createContext<UiLanguageContextValue | undefined>(undefined)

export function useUiLanguage(): UiLanguageContextValue {
  const context = useContext(UiLanguageContext)
  if (!context) {
    throw new Error('useUiLanguage must be used within UiLanguageProvider')
  }
  return context
}
