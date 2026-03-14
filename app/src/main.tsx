import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { getRouterBasename } from './lib/asset-path'
import { UiLanguageProvider } from './lib/ui-language'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiLanguageProvider>
      <AuthProvider>
        <BrowserRouter basename={getRouterBasename()}>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </UiLanguageProvider>
  </StrictMode>,
)
