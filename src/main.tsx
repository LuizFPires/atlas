import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'
import App from './App'
import { TemaProvider } from './tema/tema'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemaProvider><App /></TemaProvider>
  </StrictMode>,
)
